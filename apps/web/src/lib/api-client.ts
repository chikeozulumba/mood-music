export interface Playlist {
  id: string;
  name: string;
  description: string;
  url: string;
  imageUrl: string | null;
  owner: string;
  trackCount: number;
  matchedQuery: string;
}

export interface UserProfile {
  spotifyUserId: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface HistoryEntry {
  id: string;
  moodText: string;
  vibeSummary: string;
  searchQueries: string[];
  playlists: Playlist[];
  createdAt: number;
}

export interface MoodPlaylistsResponse {
  vibeSummary: string;
  searchQueries: string[];
  playlists: Playlist[];
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(
      "The server sent back an unexpected response. Please try again."
    );
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}.`);
  }

  return data as T;
}

export async function fetchMoodPlaylists(
  mood: string
): Promise<MoodPlaylistsResponse> {
  const res = await fetch("/api/mood-playlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ mood }),
  });

  const data = await parseJsonResponse<MoodPlaylistsResponse>(res);

  if (!Array.isArray(data.playlists)) {
    throw new Error("The server response was missing playlist data.");
  }

  return data;
}

export async function fetchMe(): Promise<
  { authenticated: false } | { authenticated: true; profile: UserProfile }
> {
  const res = await fetch("/api/auth/me", { credentials: "same-origin" });
  return parseJsonResponse(res);
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
}

export async function fetchHistory(): Promise<{ entries: HistoryEntry[] }> {
  const res = await fetch("/api/history", { credentials: "same-origin" });
  return parseJsonResponse(res);
}
