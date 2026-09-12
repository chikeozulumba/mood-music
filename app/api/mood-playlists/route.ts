import { NextRequest, NextResponse } from "next/server";
import { interpretMood } from "@/lib/anthropic";
import { findPlaylistsForQueries } from "@/lib/spotify";

export async function POST(req: NextRequest) {
  try {
    const { mood } = await req.json();

    if (!mood || typeof mood !== "string" || !mood.trim()) {
      return NextResponse.json(
        { error: "Please provide a non-empty 'mood' string." },
        { status: 400 }
      );
    }

    // 1. Claude: free text -> vibe summary + concrete Spotify search queries
    const { vibeSummary, searchQueries } = await interpretMood(mood);

    // 2. Spotify: run the searches, merge + dedupe the results
    const playlists = await findPlaylistsForQueries(searchQueries);

    return NextResponse.json({ vibeSummary, searchQueries, playlists });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
