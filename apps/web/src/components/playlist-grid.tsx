import type { Playlist } from "@/lib/api-client";

export function PlaylistGrid({ playlists }: { playlists: Playlist[] }) {
  if (playlists.length === 0) return null;

  return (
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
            <div className="truncate font-medium text-ink-900">{p.name}</div>
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
  );
}
