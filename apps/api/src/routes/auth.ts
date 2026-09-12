import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Env } from "../env";
import {
  getCurrentUserStub,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "../lib/session";
import { exchangeCodeForTokens, fetchSpotifyProfile } from "../lib/spotify";
import { resolveRedirectUri } from "../lib/redirect-uri";

const OAUTH_STATE_COOKIE = "spotify_oauth_state";
const REDIRECT_URI_COOKIE = "spotify_redirect_uri";

const auth = new Hono<{ Bindings: Env }>();

auth.get("/login", (c) => {
  const state = crypto.randomUUID();
  const redirectUri = resolveRedirectUri(
    c.req.header("referer"),
    c.env.SPOTIFY_REDIRECT_URI
  );

  setCookie(c, OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 600,
    path: "/",
  });

  // Remembered so /callback's token exchange sends the *exact* same
  // redirect_uri Spotify saw on /authorize — required for the exchange to
  // succeed, and not re-derivable there since the referer on the callback
  // request is Spotify's own domain, not this app's.
  setCookie(c, REDIRECT_URI_COOKIE, redirectUri, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 600,
    path: "/",
  });

  setCookie(c, "referer", c.req.header("referer") ?? "/", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 600,
    path: "/",
  });

  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", c.env.SPOTIFY_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "user-read-email user-read-private");
  url.searchParams.set("state", state);

  return c.redirect(url.toString());
});

auth.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  const expectedState = getCookie(c, OAUTH_STATE_COOKIE);
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/" });

  const redirectUri = getCookie(c, REDIRECT_URI_COOKIE) ?? c.env.SPOTIFY_REDIRECT_URI;
  deleteCookie(c, REDIRECT_URI_COOKIE, { path: "/" });

  if (error) {
    return c.text(`Spotify login was cancelled or failed: ${error}`, 400);
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return c.text("Invalid or expired login attempt. Please try again.", 400);
  }

  try {
    const tokens = await exchangeCodeForTokens(
      code,
      c.env.SPOTIFY_CLIENT_ID,
      c.env.SPOTIFY_CLIENT_SECRET,
      redirectUri,
    );

    const profile = await fetchSpotifyProfile(tokens.access_token);

    const stub = c.env.USER_STATE.getByName(profile.id);
    await stub.saveTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope,
    });
    await stub.saveProfile({
      spotifyUserId: profile.id,
      displayName: profile.display_name,
      email: profile.email,
      avatarUrl: profile.images?.[0]?.url ?? null,
    });

    const sessionId = crypto.randomUUID();
    await c.env.MOOD_MUSIC_SESSIONS.put(`session:${sessionId}`, profile.id, {
      expirationTtl: SESSION_TTL_SECONDS,
    });

    setCookie(c, SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    });

    const referer = getCookie(c, "referer");
    deleteCookie(c, "referer", { path: "/" });
    return c.redirect(referer ?? "/");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.text(`Login failed: ${message}`, 502);
  }
});

auth.post("/logout", async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (sessionId) {
    await c.env.MOOD_MUSIC_SESSIONS.delete(`session:${sessionId}`);
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

auth.get("/me", async (c) => {
  const stub = await getCurrentUserStub(c);
  if (!stub) {
    return c.json({ authenticated: false as const });
  }

  const profile = await stub.getProfile();
  if (!profile) {
    return c.json({ authenticated: false as const });
  }

  return c.json({ authenticated: true as const, profile });
});

export default auth;
