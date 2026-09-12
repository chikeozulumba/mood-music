import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryState, parseAsString } from "nuqs";
import { toast } from "sonner";
import { MoodForm } from "@/components/mood-form";
import { PlaylistGrid } from "@/components/playlist-grid";
import { fetchMoodPlaylists, type Playlist } from "@/lib/api-client";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [mood, setMood] = useQueryState("q", parseAsString.withDefault(""));
  const [loading, setLoading] = useState(false);
  const [vibeSummary, setVibeSummary] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const autoSubmitted = useRef(false);

  async function handleSubmit() {
    const trimmed = mood.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setPlaylists([]);
    setVibeSummary(null);

    try {
      const data = await fetchMoodPlaylists(trimmed);
      setVibeSummary(data.vibeSummary ?? null);
      setPlaylists(data.playlists);

      if (data.playlists.length === 0) {
        toast.warning("No playlists matched that mood.", {
          description: "Try describing it a different way.",
        });
      }
    } catch (err) {
      const message =
        err instanceof TypeError
          ? "Network error — check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  // If the page loads with a mood already in the URL (shared/back-navigated
  // link), automatically run that search once.
  useEffect(() => {
    if (autoSubmitted.current) return;
    autoSubmitted.current = true;
    if (mood.trim()) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasResults = playlists.length > 0 || loading || vibeSummary;

  return (
    <main className="flex flex-col items-center px-4 sm:px-6">
      <div
        className={`w-full max-w-2xl flex flex-col ${
          hasResults ? "pt-8" : "min-h-[70vh] justify-center"
        }`}
      >
        <div className="mb-6 text-center">
          <h1 className="font-serif text-3xl sm:text-4xl text-ink-900 mb-2">
            Mood Music
          </h1>
          <p className="text-ink-500 text-sm sm:text-base">
            Describe how you're feeling — Spotify finds the playlists.
          </p>
        </div>

        <MoodForm
          mood={mood}
          onMoodChange={setMood}
          onSubmit={handleSubmit}
          loading={loading}
        />

        {vibeSummary && (
          <p className="mt-6 text-center text-ink-500 italic text-sm">
            "{vibeSummary}"
          </p>
        )}

        <PlaylistGrid playlists={playlists} />
      </div>
    </main>
  );
}
