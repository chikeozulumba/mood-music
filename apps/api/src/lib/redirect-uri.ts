// Spotify requires the `redirect_uri` sent to /authorize (and again during
// the token exchange) to exactly match one of the URIs registered in the
// Spotify app dashboard. Since this app is reachable from more than one
// origin (custom domain, .site domain, local dev), we pick the redirect_uri
// dynamically from the request's Referer — but only ever for an origin on
// this explicit allowlist, so an arbitrary Referer can't redirect the OAuth
// flow somewhere unregistered/untrusted.

const ALLOWED_EXACT_ORIGINS = [
  "https://moodmusic.chikeozulumba.com",
  "https://moodmusic.site",
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_EXACT_ORIGINS.includes(origin)) return true;

  try {
    const url = new URL(origin);
    // Any port — local dev's Worker/Vite port can vary.
    return url.protocol === "http:" && url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

// `refererHeader` is the incoming request's Referer (the page the user
// clicked "Log in with Spotify" from). Falls back to `fallback` (the static
// SPOTIFY_REDIRECT_URI env var) when there's no Referer, it's malformed, or
// its origin isn't on the allowlist.
export function resolveRedirectUri(
  refererHeader: string | undefined,
  fallback: string
): string {
  if (!refererHeader) return fallback;

  try {
    const origin = new URL(refererHeader).origin;
    if (isAllowedOrigin(origin)) {
      return `${origin}/api/auth/callback`;
    }
  } catch {
    // Malformed Referer — ignore and fall through.
  }

  return fallback;
}
