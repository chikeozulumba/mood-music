import type { Playlist } from "@/lib/api-client";

export function PlaylistGrid({ playlists }: { playlists: Playlist[] }) {
  if (playlists.length === 0) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      {playlists.map((p) => (
        <a
          key={p.id}
          href={p.url}
          target="_blank"
          rel="noreferrer"
          className="flex gap-3 rounded-2xl border border-ink-900/10 bg-white p-3 transition-colors hover:border-clay-600/40 hover:bg-cream-100"
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
