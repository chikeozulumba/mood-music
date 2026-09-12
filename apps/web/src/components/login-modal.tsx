import { useEffect } from "react";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export function LoginModal({ open, onClose }: LoginModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="login-modal-title"
          className="font-serif text-xl text-ink-900 mb-2"
        >
          Connect Spotify
        </h2>
        <p className="text-sm text-ink-500 mb-6">
          Log in with Spotify to search for playlists and keep a history of
          your moods.
        </p>
        <div className="flex flex-col gap-2">
          <a
            href="/api/auth/login"
            className="rounded-full bg-clay-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-clay-700"
          >
            Log in with Spotify
          </a>
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm text-ink-500 hover:text-ink-900"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
