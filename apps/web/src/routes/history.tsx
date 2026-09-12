import { PlaylistModal } from "@/components/playlist-modal";
import { fetchHistory, type HistoryEntry, type Playlist } from "@/lib/api-client";
import { formatDateRange, formatTimeOfDay } from "@/lib/format";
import { groupHistoryIntoCatalogues } from "@/lib/history-catalogues";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/history")({
  component: History,
});

type State =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "ready"; entries: HistoryEntry[] };

function History() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(
    null
  );
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    fetchHistory()
      .then((data) => setState({ status: "ready", entries: data.entries }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (message.toLowerCase().includes("not authenticated")) {
          setState({ status: "unauthenticated" });
        } else {
          setState({ status: "error", message });
        }
      });
  }, []);

  // Same entrance animation as the home page's results pane — mount one
  // frame "before" the visible state so it's picked up as a transition.
  useEffect(() => {
    if (state.status === "loading") return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [state.status]);

  const catalogues =
    state.status === "ready" ? groupHistoryIntoCatalogues(state.entries) : [];

  return (
    <main className="w-full px-4 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pt-10 lg:flex-row lg:items-start">
        <div className="flex w-full flex-col lg:sticky lg:top-8 lg:w-[380px] lg:shrink-0 lg:self-start">
          <div className="mb-6">
            <h1 className="font-serif text-3xl sm:text-4xl text-ink-900 mb-2">
              Your history
            </h1>
            <p className="text-ink-500 text-sm sm:text-base">
              Past searches, grouped by similar terms and sorted by date.
            </p>
          </div>
        </div>

        <div
          className={`min-w-0 flex-1 pb-16 transition-all duration-500 ease-out ${
            entered ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"
          }`}
        >
          {state.status === "loading" && (
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
              Loading…
            </div>
          )}

          {state.status === "unauthenticated" && (
            <div className="rounded-2xl border border-ink-900/10 bg-white p-6 text-center">
              <p className="text-ink-700 mb-4">
                Log in with Spotify to see your past mood searches.
              </p>
              <a
                href="/api/auth/login"
                className="inline-block rounded-full bg-clay-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-clay-700"
              >
                Log in with Spotify
              </a>
            </div>
          )}

          {state.status === "error" && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.message}
            </p>
          )}

          {state.status === "ready" && catalogues.length === 0 && (
            <p className="text-ink-500 text-sm">
              No searches yet — try describing a mood on the home page.
            </p>
          )}

          {state.status === "ready" && catalogues.length > 0 && (
            <div className="flex flex-col gap-5">
              {catalogues.map((catalogue) => (
                <div
                  key={catalogue.id}
                  className="rounded-2xl border border-ink-900/10 bg-white p-4 sm:p-5"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <h2 className="truncate font-serif text-lg capitalize text-ink-900">
                      {catalogue.label}
                    </h2>
                    <span className="shrink-0 rounded-full bg-cream-100 px-2.5 py-1 text-xs text-ink-500">
                      {formatDateRange(catalogue.entries)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-5">
                    {catalogue.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="relative border-l-2 border-cream-200 pl-4"
                      >
                        <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-clay-600" />
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-sm text-ink-900">
                            {entry.moodText}
                          </p>
                          <time className="shrink-0 text-xs text-ink-300">
                            {formatTimeOfDay(entry.createdAt)}
                          </time>
                        </div>
                        <p className="mt-0.5 text-xs italic text-ink-500">
                          "{entry.vibeSummary}"
                        </p>
                        {entry.playlists.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {entry.playlists.slice(0, 6).map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setSelectedPlaylist(p)}
                                className="rounded-full bg-cream-100 px-2.5 py-1 text-xs text-ink-700 transition-colors hover:bg-cream-200"
                              >
                                {p.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PlaylistModal
        playlist={selectedPlaylist}
        onClose={() => setSelectedPlaylist(null)}
      />
    </main>
  );
}
