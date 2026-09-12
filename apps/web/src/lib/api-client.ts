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

// Defensive cleanup: if an error string is itself a raw JSON blob (e.g. an
// upstream API error that slipped through unformatted), pull out just the
// human-readable message instead of showing the JSON verbatim in a toast.
function toFriendlyErrorMessage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return raw;

  try {
    const parsed = JSON.parse(trimmed) as any;
    if (typeof parsed?.error_description === "string") return parsed.error_description;
    if (typeof parsed?.error?.message === "string") return parsed.error.message;
    if (typeof parsed?.error === "string") return parsed.error;
    if (typeof parsed?.message === "string") return parsed.message;
  } catch {
    // Not actually valid JSON — fall through and show it as-is.
  }
  return raw;
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
    const rawMessage = data?.error || `Request failed with status ${res.status}.`;
    throw new Error(toFriendlyErrorMessage(rawMessage));
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

export async function fetchAnthropicKeyStatus(): Promise<{
  hasOwnKey: boolean;
}> {
  const res = await fetch("/api/settings/anthropic-key", {
    credentials: "same-origin",
  });
  return parseJsonResponse(res);
}

export async function saveAnthropicKey(
  apiKey: string
): Promise<{ hasOwnKey: boolean }> {
  const res = await fetch("/api/settings/anthropic-key", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ apiKey }),
  });
  return parseJsonResponse(res);
}

export async function clearAnthropicKey(): Promise<{ hasOwnKey: boolean }> {
  const res = await fetch("/api/settings/anthropic-key", {
    method: "DELETE",
    credentials: "same-origin",
  });
  return parseJsonResponse(res);
}
