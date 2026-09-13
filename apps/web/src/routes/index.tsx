import { MoodForm } from "@/components/mood-form";
import { PlaylistGrid } from "@/components/playlist-grid";
import { PlaylistModal } from "@/components/playlist-modal";
import { fetchMoodPlaylists, type Playlist } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { createFileRoute } from "@tanstack/react-router";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { status } = useAuth();
  const [mood, setMood] = useQueryState("q", parseAsString.withDefault(""));
  const [loading, setLoading] = useState(false);
  const [vibeSummary, setVibeSummary] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(
    null
  );
  const [resultsEntered, setResultsEntered] = useState(false);
  const autoSubmitted = useRef(false);

  async function runSearch(trimmedMood: string) {
    setLoading(true);
    setPlaylists([]);
    setVibeSummary(null);

    try {
      const data = await fetchMoodPlaylists(trimmedMood);
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
      toast.error("Error", {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit() {
    const trimmed = mood.trim();
    if (!trimmed || loading) return;

    runSearch(trimmed);
  }

  // If the page loads with a mood already in the URL — e.g. returning from a
  // successful Spotify login, or a shared/back-navigated link — pick up
  // where the user left off and run that search automatically, once we know
  // whether the user is authenticated (not while auth status is still
  // loading, so we don't fire a search that then can't be attributed to a
  // signed-in session).
  useEffect(() => {
    if (autoSubmitted.current) return;
    if (status === "loading") return;

    autoSubmitted.current = true;
    const trimmed = mood.trim();
    if (trimmed) {
      runSearch(trimmed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const hasResults = playlists.length > 0 || loading || Boolean(vibeSummary);

  // Mount the results pane one frame "before" its entrance state so the
  // opacity/translate change is picked up as a CSS transition rather than
  // appearing instantly.
  useEffect(() => {
    if (!hasResults) {
      setResultsEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setResultsEntered(true));
    return () => cancelAnimationFrame(id);
  }, [hasResults]);

  return (
    <main className="w-full px-4 sm:px-6">
      <div
        className={`mx-auto flex w-full flex-col gap-8 transition-all duration-500 ease-out lg:flex-row lg:items-start ${
          hasResults ? "max-w-5xl pt-10" : "max-w-2xl pt-[22vh]"
        }`}
      >
        <div
          className={`flex w-full flex-col transition-all duration-500 ease-out ${
            hasResults
              ? "lg:sticky lg:top-8 lg:w-[380px] lg:shrink-0 lg:self-start"
              : "items-center text-center"
          }`}
        >
          <div className={`mb-6 ${hasResults ? "" : "text-center"}`}>
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
        </div>

        {hasResults && (
          <div
            className={`min-w-0 flex-1 pb-16 transition-all duration-500 ease-out ${
              resultsEntered
                ? "translate-x-0 opacity-100"
                : "translate-x-6 opacity-0"
            }`}
          >
            {vibeSummary && (
              <p className="mb-4 text-ink-500 italic text-sm">
                "{vibeSummary}"
              </p>
            )}

            {loading && playlists.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-ink-500">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Finding playlists…
              </div>
            ) : (
              <PlaylistGrid
                playlists={playlists}
                onSelect={setSelectedPlaylist}
              />
            )}
          </div>
        )}
      </div>

      <PlaylistModal
        playlist={selectedPlaylist}
        onClose={() => setSelectedPlaylist(null)}
      />
    </main>
  );
}
