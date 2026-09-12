"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface Playlist {
  id: string;
  name: string;
  description: string;
  url: string;
  imageUrl: string | null;
  owner: string;
  trackCount: number;
  matchedQuery: string;
}

export default function Home() {
  const [mood, setMood] = useState("");
  const [loading, setLoading] = useState(false);
  const [vibeSummary, setVibeSummary] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [mood]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = mood.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setPlaylists([]);
    setVibeSummary(null);

    try {
      const res = await fetch("/api/mood-playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: trimmed }),
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          "The server sent back an unexpected response. Please try again.",
        );
      }

      if (!res.ok) {
        throw new Error(
          data?.error || `Request failed with status ${res.status}.`,
        );
      }

      if (!Array.isArray(data.playlists)) {
        throw new Error("The server response was missing playlist data.");
      }

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const hasResults = playlists.length > 0 || loading || vibeSummary;

  return (
    <main className="min-h-screen flex flex-col items-center px-4 sm:px-6">
      <div
        className={`w-full max-w-2xl flex flex-col ${
          hasResults ? "pt-16" : "min-h-screen justify-center"
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

        <form onSubmit={handleSubmit} className="w-full">
          <div className="relative rounded-3xl bg-white border border-ink-900/10 shadow-input focus-within:border-clay-600/40 transition-colors">
            <textarea
              ref={textareaRef}
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="e.g. it's raining, I'm on my third coffee, and I have three deadlines today"
              className="w-full resize-none bg-transparent px-5 pt-4 pb-14 text-[15px] leading-6 text-ink-900 placeholder:text-ink-300 focus:outline-none"
            />
            <div className="absolute bottom-3 right-3">
              <button
                type="submit"
                disabled={loading || !mood.trim()}
                aria-label="Find playlists"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-clay-600 text-white transition-colors hover:bg-clay-700 disabled:bg-ink-300 disabled:cursor-not-allowed"
              >
                {loading ? (
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
                ) : (
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path
                      d="M12 19V5M5 12l7-7 7 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </form>

        {vibeSummary && (
          <p className="mt-6 text-center text-ink-500 italic text-sm">
            "{vibeSummary}"
          </p>
        )}

        {playlists.length > 0 && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 pb-16">
            {playlists.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="flex gap-3 rounded-2xl bg-white border border-ink-900/5 p-3 shadow-card transition-shadow hover:shadow-md"
              >
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="h-16 w-16 flex-shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 flex-shrink-0 rounded-xl bg-cream-200" />
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium text-ink-900">
                    {p.name}
                  </div>
                  <div className="truncate text-xs text-ink-500">
                    {p.owner} · {p.trackCount} tracks
                  </div>
                  <div className="truncate text-xs text-ink-300">
                    matched: "{p.matchedQuery}"
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
