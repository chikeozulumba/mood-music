import { Hono } from "hono";
import type { Env } from "../env";
import { interpretMood } from "../lib/anthropic";
import { findPlaylistsForQueries, type SpotifyPlaylistResult } from "../lib/spotify";
import { getCurrentUserStub } from "../lib/session";
import { hashMoodText, MOOD_CACHE_TTL_SECONDS } from "../lib/cache";

const moodPlaylists = new Hono<{ Bindings: Env }>();

const WEEKLY_SHARED_KEY_LIMIT = 10;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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
    const moodHash = await hashMoodText(mood);
    const cacheKey = `cache:mood:${moodHash}`;
    const cachedRaw = await c.env.MOOD_MUSIC_SESSIONS.get(cacheKey);

    let result: MoodPlaylistsResult;
    let servedFromCache = false;

    const stub = await getCurrentUserStub(c);

    if (cachedRaw) {
      // Cache hits never touch Claude, so they never cost anything against
      // the shared-key quota — free for everyone regardless of key/login.
      result = JSON.parse(cachedRaw) as MoodPlaylistsResult;
      servedFromCache = true;
    } else {
      const ownApiKey = stub ? await stub.getOwnAnthropicKey() : undefined;
      const usingOwnKey = Boolean(ownApiKey);

      if (!usingOwnKey && stub) {
        const { allowed, count } = await stub.tryConsumeSharedKeyQuota(
          WEEKLY_SHARED_KEY_LIMIT,
          WEEK_MS
        );
        if (!allowed) {
          return c.json(
            {
              error: `You've used all ${WEEKLY_SHARED_KEY_LIMIT} of your free searches this week. Add your own Anthropic API key in your profile menu to keep searching, or wait for your weekly limit to reset.`,
              code: "WEEKLY_LIMIT_REACHED",
              limit: WEEKLY_SHARED_KEY_LIMIT,
              count,
            },
            429
          );
        }
      }

      // 1. Claude: free text -> vibe summary + concrete Spotify search queries
      const { vibeSummary, searchQueries } = await interpretMood(
        mood,
        usingOwnKey ? (ownApiKey as string) : c.env.ANTHROPIC_API_KEY
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

    // 3. If logged in, persist this search to the user's history — but only
    // when it's a genuinely fresh result (not served from cache) AND this
    // user hasn't already recorded the same mood search recently, so a
    // cache hit or a double-submit never creates a duplicate history row.
    if (stub && !servedFromCache) {
      const alreadyRecorded = await stub.hasRecentHistoryForMood(moodHash);
      if (!alreadyRecorded) {
        await stub.addHistoryEntry(
          { moodText: mood, ...result },
          moodHash,
          MOOD_CACHE_TTL_SECONDS * 1000
        );
      }
    }

    return c.json(result);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

export default moodPlaylists;
