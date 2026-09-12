import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { fetchHistory, type HistoryEntry } from "@/lib/api-client";

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

  return (
    <main className="flex flex-col items-center px-4 sm:px-6 pb-16">
      <div className="w-full max-w-2xl pt-8">
        <h1 className="font-serif text-2xl text-ink-900 mb-6">Your history</h1>

        {state.status === "loading" && (
          <p className="text-ink-500 text-sm">Loading…</p>
        )}

        {state.status === "unauthenticated" && (
          <div className="rounded-2xl bg-white border border-ink-900/5 p-6 text-center shadow-card">
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

        {state.status === "ready" && state.entries.length === 0 && (
          <p className="text-ink-500 text-sm">
            No searches yet — try describing a mood on the home page.
          </p>
        )}

        {state.status === "ready" && state.entries.length > 0 && (
          <ul className="flex flex-col gap-4">
            {state.entries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-2xl bg-white border border-ink-900/5 p-4 shadow-card"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-ink-900">{entry.moodText}</p>
                  <time className="shrink-0 text-xs text-ink-300">
                    {new Date(entry.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="mt-1 text-sm italic text-ink-500">
                  "{entry.vibeSummary}"
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.playlists.slice(0, 6).map((p) => (
                    <a
                      key={p.id}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-cream-100 px-3 py-1 text-xs text-ink-700 hover:bg-cream-200"
                    >
                      {p.name}
                    </a>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
