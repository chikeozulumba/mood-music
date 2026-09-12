import { Hono } from "hono";
import type { Env } from "../env";
import { interpretMood } from "../lib/anthropic";
import { findPlaylistsForQueries, type SpotifyPlaylistResult } from "../lib/spotify";
import { getCurrentUserStub } from "../lib/session";
import { moodCacheKey, MOOD_CACHE_TTL_SECONDS } from "../lib/cache";

const moodPlaylists = new Hono<{ Bindings: Env }>();

interface MoodPlaylistsResult {
  vibeSummary: string;
  searchQueries: string[];
  playlists: SpotifyPlaylistResult[];
}

moodPlaylists.post("/", async (c) => {
  try {
    const body = await c.req.json<{ mood?: unknown }>();
    const mood = body?.mood;

    if (!mood || typeof mood !== "string" || !mood.trim()) {
      return c.json({ error: "Please provide a non-empty 'mood' string." }, 400);
    }

    // A hash of the (normalized) mood text keys a cache entry so repeat
    // searches for the same mood never re-hit Claude or Spotify.
    const cacheKey = await moodCacheKey(mood);
    const cachedRaw = await c.env.MOOD_MUSIC_SESSIONS.get(cacheKey);

    let result: MoodPlaylistsResult;

    if (cachedRaw) {
      result = JSON.parse(cachedRaw) as MoodPlaylistsResult;
    } else {
      // 1. Claude: free text -> vibe summary + concrete Spotify search queries
      const { vibeSummary, searchQueries } = await interpretMood(
        mood,
        c.env.ANTHROPIC_API_KEY
      );

      // 2. Spotify: paginate + merge + dedupe the results (min 50, ranked by
      // Spotify's own relevance/popularity ordering per query)
      const playlists = await findPlaylistsForQueries(
        searchQueries,
        c.env.SPOTIFY_CLIENT_ID,
        c.env.SPOTIFY_CLIENT_SECRET
      );

      result = { vibeSummary, searchQueries, playlists };

      await c.env.MOOD_MUSIC_SESSIONS.put(cacheKey, JSON.stringify(result), {
        expirationTtl: MOOD_CACHE_TTL_SECONDS,
      });
    }

    // 3. If logged in, persist this search to the user's history.
    const stub = await getCurrentUserStub(c);
    if (stub) {
      await stub.addHistoryEntry({ moodText: mood, ...result });
    }

    return c.json(result);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

export default moodPlaylists;
