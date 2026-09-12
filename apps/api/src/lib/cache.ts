// Caches mood-search results (Claude's interpretation + the Spotify
// playlists found) so the same mood text never has to hit Claude/Spotify
// twice. Lives in the same KV namespace as sessions, distinguished by the
// "cache:mood:" key prefix.

const CACHE_KEY_PREFIX = "cache:mood:";
export const MOOD_CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours

function normalizeMoodText(mood: string): string {
  return mood.trim().toLowerCase().replace(/\s+/g, " ");
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function moodCacheKey(mood: string): Promise<string> {
  const hash = await sha256Hex(normalizeMoodText(mood));
  return `${CACHE_KEY_PREFIX}${hash}`;
}
