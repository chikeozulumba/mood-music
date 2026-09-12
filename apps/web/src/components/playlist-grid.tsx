import type { Playlist } from "@/lib/api-client";
import { estimateDuration } from "@/lib/format";

interface PlaylistGridProps {
  playlists: Playlist[];
  onSelect: (playlist: Playlist) => void;
}

export function PlaylistGrid({ playlists, onSelect }: PlaylistGridProps) {
  if (playlists.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {playlists.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p)}
          className="flex flex-col overflow-hidden rounded-2xl border border-ink-900/10 bg-white text-left transition-colors hover:border-clay-600/40"
        >
          <div className="aspect-square w-full bg-cream-200">
            {p.imageUrl && (
              <img
                src={p.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            )}
          </div>

          <div className="flex flex-1 flex-col gap-2 p-3">
            <div className="truncate font-medium text-ink-900">{p.name}</div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
              <span className="flex items-center gap-1">
                <svg
                  className="h-3.5 w-3.5 text-ink-300"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    d="M9 18V5l12-2v13"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                {p.trackCount} songs
              </span>
              <span className="flex items-center gap-1">
                <svg
                  className="h-3.5 w-3.5 text-ink-300"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path
                    d="M12 7v5l3 3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {estimateDuration(p.trackCount)}
              </span>
            </div>

            <div className="mt-auto flex items-center gap-1 text-xs text-ink-300">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  d="M20 21a8 8 0 10-16 0"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="truncate">{p.owner}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
