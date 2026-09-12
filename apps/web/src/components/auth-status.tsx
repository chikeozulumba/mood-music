import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { fetchMe, logout, type UserProfile } from "@/lib/api-client";

export function AuthStatus() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((data) => {
        if (cancelled) return;
        setProfile(data.authenticated ? data.profile : null);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    setLoading(true);
    await logout();
    setProfile(null);
    setLoading(false);
  }

  if (loading) {
    return <div className="h-8 w-24" />;
  }

  if (!profile) {
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
      {profile.avatarUrl ? (
        <img
          src={profile.avatarUrl}
          alt=""
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <div className="h-8 w-8 rounded-full bg-cream-200" />
      )}
      <span className="text-ink-700">{profile.displayName ?? "You"}</span>
      <button
        onClick={handleLogout}
        className="text-ink-500 hover:text-ink-900"
      >
        Log out
      </button>
    </div>
  );
}
