import { extractApiErrorMessage } from "./errors";

// Client Credentials flow (app-only, no user login) — powers anonymous public
// playlist search. Token is cached in module scope for the life of the
// isolate; a cold start just re-fetches one, which is cheap and not
// rate-limited tightly.
let cachedAppToken: { value: string; expiresAt: number } | null = null;

async function getAppAccessToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  if (cachedAppToken && cachedAppToken.expiresAt > Date.now()) {
    return cachedAppToken.value;
  }

  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Spotify auth failed (${res.status}):`, text);
    throw new Error(`Spotify auth failed: ${extractApiErrorMessage(text)}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedAppToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedAppToken.value;
}

export interface SpotifyPlaylistResult {
  id: string;
  name: string;
  description: string;
  url: string;
  imageUrl: string | null;
  owner: string;
  trackCount: number;
  matchedQuery: string;
}

// Spotify's documented search `limit` max is 50, but apps without extended
// API access get a 400 "Invalid limit" above 10 (confirmed empirically) —
// 10 is the value that works for every app regardless of quota tier.
// `offset` pages through the rest; each page's items come back pre-sorted
// by Spotify's own relevance/popularity ranking for that query.
const SPOTIFY_SEARCH_PAGE_SIZE = 10;
// Safety cap so a single query can't page forever — 6 pages (60 results) is
// already more than the minimum below, even from a single query alone.
const MAX_PAGES_PER_QUERY = 6;
const MIN_TOTAL_RESULTS = 50;

async function fetchPlaylistSearchPage(
  query: string,
  token: string,
  limit: number,
  offset: number,
): Promise<{
  items: SpotifyPlaylistResult[];
  total: number;
  rawCount: number;
}> {
  const params = new URLSearchParams({
    q: query,
    type: "playlist",
    limit: String(limit),
    offset: String(offset),
  });

  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Spotify search failed (${res.status}):`, text);
    throw new Error(`Spotify search failed: ${extractApiErrorMessage(text)}`);
  }

  const data = (await res.json()) as any;
  const rawItems = ((data?.playlists?.items ?? []) as any[]).filter(Boolean);
  const items = rawItems
    // NOTE: a playlist search result's track-count sub-object is keyed
    // "items" (confirmed empirically), not "tracks" — that field name is
    // only used by the full playlist-details endpoint. Getting this wrong
    // silently defaults every result to a track count of 0. Still guard
    // against a missing/zero count rather than showing a broken card.
    .filter((p) => typeof p.items?.total === "number" && p.items.total > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: (p.description || "").replace(/<[^>]*>/g, ""),
      url: p.external_urls?.spotify ?? "",
      imageUrl: p.images?.[0]?.url ?? null,
      owner: p.owner?.display_name ?? "Spotify",
      trackCount: p.items.total,
      matchedQuery: query,
    }));

  return {
    items,
    total: data?.playlists?.total ?? rawItems.length,
    rawCount: rawItems.length,
  };
}

interface QueryPageState {
  query: string;
  items: SpotifyPlaylistResult[]; // accumulated so far, in Spotify's rank order
  nextOffset: number;
  total: number;
  exhausted: boolean;
}

// Runs one search per mood-derived query phrase, paginating each (via
// Spotify's offset) until we have at least `minTotal` unique playlists
// combined. Results are merged round-robin by rank across queries — each
// query's top (most relevant/popular) hit is taken before any query's
// second-tier hits — rather than concatenated query-by-query, so the most
// popular/relevant playlists surface first regardless of which query found
// them.
export async function findPlaylistsForQueries(
  queries: string[],
  clientId: string,
  clientSecret: string,
  minTotal = MIN_TOTAL_RESULTS,
): Promise<SpotifyPlaylistResult[]> {
  const token = await getAppAccessToken(clientId, clientSecret);

  const states: QueryPageState[] = queries.map((query) => ({
    query,
    items: [],
    nextOffset: 0,
    total: Infinity,
    exhausted: false,
  }));

  async function fetchNextPage(state: QueryPageState) {
    if (state.exhausted) return;
    const { items, total, rawCount } = await fetchPlaylistSearchPage(
      state.query,
      token,
      SPOTIFY_SEARCH_PAGE_SIZE,
      state.nextOffset,
    );
    state.items.push(...items);
    state.total = total;
    state.nextOffset += SPOTIFY_SEARCH_PAGE_SIZE;
    // Use the raw (pre-filter) count to detect "no more results" — a page
    // that came back with zero *valid* playlists (all filtered out for
    // missing track counts) doesn't mean Spotify is out of results.
    if (
      rawCount === 0 ||
      state.nextOffset >= state.total ||
      state.nextOffset / SPOTIFY_SEARCH_PAGE_SIZE >= MAX_PAGES_PER_QUERY
    ) {
      state.exhausted = true;
    }
  }

  const seen = new Set<string>();
  const combined: SpotifyPlaylistResult[] = [];

  function mergeByRank() {
    let rank = 0;
    while (combined.length < minTotal) {
      let sawSlot = false;
      for (const state of states) {
        const item = state.items[rank];
        if (!item) continue;
        sawSlot = true;
        if (item.id && !seen.has(item.id)) {
          seen.add(item.id);
          combined.push(item);
          if (combined.length >= minTotal) return;
        }
      }
      if (!sawSlot) break; // no query has anything left at this rank tier
      rank++;
    }
  }

  // First page of every query, in parallel — usually enough on its own.
  await Promise.all(states.map((s) => fetchNextPage(s)));
  mergeByRank();

  // If still short, fetch further pages for whichever queries have more.
  let guard = 0;
  while (combined.length < minTotal && guard < MAX_PAGES_PER_QUERY) {
    const fetchable = states.filter((s) => !s.exhausted);
    if (fetchable.length === 0) break;
    await Promise.all(fetchable.map((s) => fetchNextPage(s)));
    mergeByRank();
    guard++;
  }

  return combined;
}

// NOTE: we deliberately don't fetch a playlist's track list via Spotify's
// Web API (`/v1/playlists/{id}/tracks`). Confirmed empirically: it returns a
// blanket 403 for this app's quota tier regardless of scope or token type —
// Spotify restricts that endpoint (and even the tracks summary on the plain
// playlist-details endpoint) to apps approved for "Extended Quota Mode".
// The playlist detail modal instead embeds Spotify's official public player
// widget (open.spotify.com/embed/playlist/{id}), which needs no API access.

// --- Authorization Code flow (real user login) ---

export interface SpotifyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<SpotifyTokenResponse> {
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Spotify token exchange failed (${res.status}):`, text);
    throw new Error(
      `Spotify token exchange failed: ${extractApiErrorMessage(text)}`,
    );
  }

  return res.json();
}

export async function refreshSpotifyAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<
  Omit<SpotifyTokenResponse, "refresh_token"> & { refresh_token?: string }
> {
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Spotify token refresh failed (${res.status}):`, text);
    throw new Error(
      `Spotify token refresh failed: ${extractApiErrorMessage(text)}`,
    );
  }

  return res.json();
}

export interface SpotifyProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  images?: { url: string }[];
}

export async function fetchSpotifyProfile(
  accessToken: string,
): Promise<SpotifyProfile> {
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Spotify profile fetch failed (${res.status}):`, text);
    throw new Error(
      `Spotify profile fetch failed: ${extractApiErrorMessage(text)}`,
    );
  }

  return res.json();
}
