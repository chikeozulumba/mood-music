// Handles Spotify's Client Credentials flow (no end-user login required —
// this is all we need for read-only public playlist search) and wraps the
// Search API. Token is cached in memory for the life of the server process;
// swap for Redis/etc. if you deploy with multiple instances.

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getSpotifyToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET environment variables."
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

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
    throw new Error(`Spotify auth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    value: data.access_token,
    // shave 60s off so we never use a token right as it expires
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.value;
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

// Searches Spotify for public playlists matching a single query string.
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
    throw new Error(`Spotify search failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const items = (data?.playlists?.items ?? []) as any[];

  return items
    .filter(Boolean) // Spotify's search occasionally returns null entries
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: (p.description || "").replace(/<[^>]*>/g, ""), // strip stray HTML
      url: p.external_urls?.spotify ?? "",
      imageUrl: p.images?.[0]?.url ?? null,
      owner: p.owner?.display_name ?? "Spotify",
      trackCount: p.tracks?.total ?? 0,
      matchedQuery: query,
    }));
}

// Runs one search per query term, then dedupes by playlist id (keeping the
// first — i.e. best-ranked — match) and returns a flat, capped list.
export async function findPlaylistsForQueries(
  queries: string[],
  perQueryLimit = 5,
  totalLimit = 12
): Promise<SpotifyPlaylistResult[]> {
  const token = await getSpotifyToken();

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
