import { extractApiErrorMessage } from "./errors";

// Client Credentials flow (app-only, no user login) — powers anonymous public
// playlist search. Token is cached in module scope for the life of the
// isolate; a cold start just re-fetches one, which is cheap and not
// rate-limited tightly.
let cachedAppToken: { value: string; expiresAt: number } | null = null;

async function getAppAccessToken(
  clientId: string,
  clientSecret: string
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

async function searchPlaylistsForQuery(
  query: string,
  token: string,
  limit = 5
): Promise<SpotifyPlaylistResult[]> {
  const params = new URLSearchParams({
    q: query,
    type: "playlist",
    limit: String(limit),
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
  const items = (data?.playlists?.items ?? []) as any[];

  return items
    .filter(Boolean)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: (p.description || "").replace(/<[^>]*>/g, ""),
      url: p.external_urls?.spotify ?? "",
      imageUrl: p.images?.[0]?.url ?? null,
      owner: p.owner?.display_name ?? "Spotify",
      trackCount: p.tracks?.total ?? 0,
      matchedQuery: query,
    }));
}

export async function findPlaylistsForQueries(
  queries: string[],
  clientId: string,
  clientSecret: string,
  perQueryLimit = 5,
  totalLimit = 12
): Promise<SpotifyPlaylistResult[]> {
  const token = await getAppAccessToken(clientId, clientSecret);

  const resultsPerQuery = await Promise.all(
    queries.map((q) => searchPlaylistsForQuery(q, token, perQueryLimit))
  );

  const seen = new Set<string>();
  const combined: SpotifyPlaylistResult[] = [];

  for (const results of resultsPerQuery) {
    for (const playlist of results) {
      if (!playlist.id || seen.has(playlist.id)) continue;
      seen.add(playlist.id);
      combined.push(playlist);
    }
  }

  return combined.slice(0, totalLimit);
}

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
  redirectUri: string
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
    throw new Error(`Spotify token exchange failed: ${extractApiErrorMessage(text)}`);
  }

  return res.json();
}

export async function refreshSpotifyAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<Omit<SpotifyTokenResponse, "refresh_token"> & { refresh_token?: string }> {
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
    throw new Error(`Spotify token refresh failed: ${extractApiErrorMessage(text)}`);
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
  accessToken: string
): Promise<SpotifyProfile> {
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Spotify profile fetch failed (${res.status}):`, text);
    throw new Error(`Spotify profile fetch failed: ${extractApiErrorMessage(text)}`);
  }

  return res.json();
}
