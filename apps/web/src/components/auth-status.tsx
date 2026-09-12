import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AnthropicKeyModal } from "@/components/anthropic-key-modal";

export function AuthStatus() {
  const { status, profile, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
  }

  if (status === "loading") {
    return <div className="h-8 w-24" />;
  }

  if (status === "unauthenticated" || !profile) {
    return (
      <a
        href="/api/auth/login"
        className="rounded-full bg-clay-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-clay-700"
      >
        Log in with Spotify
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link to="/history" className="text-ink-700 hover:text-ink-900">
        History
      </Link>

      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-clay-600/40"
        >
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.displayName ?? "Account"}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-cream-200" />
          )}
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 z-10 mt-2 w-52 overflow-hidden rounded-xl border border-ink-900/10 bg-white shadow-card"
          >
            <div className="truncate border-b border-ink-900/5 px-3 py-2 text-ink-700">
              {profile.displayName ?? "You"}
            </div>
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setKeyModalOpen(true);
              }}
              className="block w-full px-3 py-2 text-left text-ink-500 hover:bg-cream-100 hover:text-ink-900"
            >
              Anthropic API key
            </button>
            <button
              role="menuitem"
              onClick={handleLogout}
              className="block w-full px-3 py-2 text-left text-ink-500 hover:bg-cream-100 hover:text-ink-900"
            >
              Log out
            </button>
          </div>
        )}
      </div>

      <AnthropicKeyModal
        open={keyModalOpen}
        onClose={() => setKeyModalOpen(false)}
      />
    </div>
  );
}
