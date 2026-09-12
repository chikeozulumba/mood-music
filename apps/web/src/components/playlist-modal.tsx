import { useEffect } from "react";
import type { Playlist } from "@/lib/api-client";

interface PlaylistModalProps {
  playlist: Playlist | null;
  onClose: () => void;
}

// Spotify's Web API blocks track-listing endpoints for apps without
// "Extended Quota Mode" approval, even with a fully-scoped user token
// (confirmed empirically — 403 regardless). Their official public embed
// widget needs no API access/approval and already shows everything —
// cover, name, owner, and the full track list with artists and previews —
// so we show it directly instead of wrapping it in our own duplicate
// header/metadata chrome.
export function PlaylistModal({ playlist, onClose }: PlaylistModalProps) {
  useEffect(() => {
    if (!playlist) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [playlist, onClose]);

  if (!playlist) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4 py-8"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Spotify player: ${playlist.name}`}
        className="relative w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink-500 transition-colors hover:text-ink-900"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M6 6l12 12M18 6L6 18"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <iframe
          key={playlist.id}
          src={`https://open.spotify.com/embed/playlist/${encodeURIComponent(playlist.id)}?utm_source=generator`}
          width="100%"
          height="600"
          style={{ borderRadius: 12, border: 0 }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          title={`Spotify player: ${playlist.name}`}
        />
      </div>
    </div>
  );
}
