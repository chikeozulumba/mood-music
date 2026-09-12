import { Hono } from "hono";
import type { Env } from "../env";
import { interpretMood } from "../lib/anthropic";
import { findPlaylistsForQueries } from "../lib/spotify";
import { getCurrentUserStub } from "../lib/session";

const moodPlaylists = new Hono<{ Bindings: Env }>();

moodPlaylists.post("/", async (c) => {
  try {
    const body = await c.req.json<{ mood?: unknown }>();
    const mood = body?.mood;

    if (!mood || typeof mood !== "string" || !mood.trim()) {
      return c.json({ error: "Please provide a non-empty 'mood' string." }, 400);
    }

    // 1. Claude: free text -> vibe summary + concrete Spotify search queries
    const { vibeSummary, searchQueries } = await interpretMood(
      mood,
      c.env.ANTHROPIC_API_KEY
    );

    // 2. Spotify: run the searches, merge + dedupe the results
    const playlists = await findPlaylistsForQueries(
      searchQueries,
      c.env.SPOTIFY_CLIENT_ID,
      c.env.SPOTIFY_CLIENT_SECRET
    );

    // 3. If logged in, persist this search to the user's history.
    const stub = await getCurrentUserStub(c);
    if (stub) {
      await stub.addHistoryEntry({ moodText: mood, vibeSummary, searchQueries, playlists });
    }

    return c.json({ vibeSummary, searchQueries, playlists });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

export default moodPlaylists;
