# Mood Music

Type a mood or a description of your day, and get back real Spotify playlists
that match. Log in with Spotify to keep a history of your past searches.

## Architecture

A pnpm monorepo with two apps deployed as a single Cloudflare Worker:

```
apps/
├── web/   Vite + React + TanStack Router + nuqs (the SPA)
└── api/   Hono running on Cloudflare Workers (the API)
```

```
Browser
  │
  ├─► GET /                      → apps/web's built SPA (Cloudflare static assets)
  │
  └─► /api/*                     → apps/api's Hono app
        ├─► POST /api/mood-playlists
        │     ├─► Claude (raw fetch, forced tool-call JSON)
        │     └─► Spotify Search API (Client Credentials — no login needed)
        │
        ├─► GET  /api/auth/login    → redirect to Spotify's OAuth consent screen
        ├─► GET  /api/auth/callback → exchanges code for tokens, creates a session
        ├─► POST /api/auth/logout
        ├─► GET  /api/auth/me
        └─► GET  /api/history       → this user's past mood searches
```

In production, `apps/api`'s Worker serves `apps/web`'s built static files
*and* runs the API from the same Worker/domain (Cloudflare's `[assets]`
binding with `run_worker_first = ["/api/*"]`), so everything is same-origin —
no CORS, and cookie-based sessions just work. In local dev, Vite proxies
`/api/*` to `wrangler dev`, keeping that same same-origin property.

### Data storage

- **Workers KV** (`MOOD_MUSIC_SESSIONS` namespace) serves two purposes,
  distinguished by key prefix:
  - `session:*` maps an opaque session-id cookie to a Spotify user id.
  - `cache:mood:*` caches mood-search results (Claude's interpretation +
    the Spotify playlists found), keyed by a SHA-256 hash of the
    normalized mood text, for 24 hours — so the same mood never re-hits
    Claude or Spotify.
- **Durable Objects** (one `UserState` instance per Spotify user, addressed by
  their Spotify user id): stores that user's Spotify OAuth tokens (with
  auto-refresh) and their full mood-search history (mood text, Claude's vibe
  summary, and the playlists returned), using the DO's own transactional
  storage.
- **Spotify search pagination**: each Claude-derived search phrase is paged
  through Spotify's search endpoint (50 results per page, up to 4 pages) and
  merged round-robin by rank across phrases — so the most relevant/popular
  hit from every phrase surfaces before any phrase's second-tier hits — until
  at least 50 unique playlists are collected.

Mood search works for everyone, logged in or not — logging in only adds
history persistence and the `/history` page.

## Setup

### 1. Spotify app

You already have a Spotify app from the original version of this project
(Client ID + Secret in the repo root's `.env.local` — that file is unused by
the new API but was left in place). In the
[Spotify Developer Dashboard](https://developer.spotify.com/dashboard), add
these **Redirect URIs** to that app's settings — one per origin the app is
actually reachable from:

- `http://127.0.0.1:<any port>/api/auth/callback` (local dev — register the
  exact port(s) you use, e.g. `:8787` and/or Vite's `:5173`)
- `https://moodmusic.chikeozulumba.com/api/auth/callback`
- `https://moodmusic.site/api/auth/callback`
- `https://<your-worker>.workers.dev/api/auth/callback` (fallback default —
  see below; keep this registered too)

`SPOTIFY_REDIRECT_URI` (`wrangler.toml` / `apps/api/.env.local`) is only the
**fallback**. `apps/api/src/lib/redirect-uri.ts` picks the actual
redirect_uri per-request from the incoming `Referer` header, but only when
its origin is on the allowlist there (currently the two domains above, plus
`http://127.0.0.1:<any port>`) — any other Referer (or none) falls back to
the static env var. Adding another domain the app is served from means
updating that allowlist *and* registering the new URI in Spotify's
dashboard. The two custom domains also need to actually be routed to this
Worker via Cloudflare (custom domain / route configuration) — this repo
doesn't do that for you.

### 2. Cloudflare

```bash
pnpm dlx wrangler login
cd apps/api
wrangler kv namespace create MOOD_MUSIC_SESSIONS
wrangler kv namespace create MOOD_MUSIC_SESSIONS --preview
```

Paste the two returned namespace ids into `apps/api/wrangler.toml`'s
`[[kv_namespaces]]` block (`id` / `preview_id`).

### 3. Local secrets

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

Fill in `apps/api/.dev.vars` with the same three values already in the repo
root's `.env.local` (`ANTHROPIC_API_KEY`, `SPOTIFY_CLIENT_ID`,
`SPOTIFY_CLIENT_SECRET`). `wrangler dev` reads `.dev.vars` automatically; it's
gitignored.

### 4. Install and run

```bash
pnpm install
pnpm dev   # runs `vite` (http://localhost:5173) and `wrangler dev` (http://127.0.0.1:8787) together
```

Open http://localhost:5173.

## Deploying

```bash
pnpm deploy   # builds apps/web, then `wrangler deploy` from apps/api
              # (uploads the built SPA + the Worker together)
```

Before your first production deploy, set the same three secrets Cloudflare-side:

```bash
cd apps/api
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put SPOTIFY_CLIENT_ID
wrangler secret put SPOTIFY_CLIENT_SECRET
```

And update `SPOTIFY_REDIRECT_URI` in `apps/api/wrangler.toml`'s `[vars]` to
your production Worker URL once you know it.

## Notes

- **Weekly search limit**: logged-in users get 10 fresh Claude calls per
  rolling 7 days on the app's shared `ANTHROPIC_API_KEY` (tracked per-user
  in their `UserState` Durable Object). Results served from the mood-search
  cache never count against it, since they don't touch Claude at all. A
  user can add their own Anthropic key from the profile menu (→ "Anthropic
  API key") to bypass the limit entirely — their key is stored on their
  account and used only for their own searches instead of the shared one.
- **Anthropic model**: `apps/api/src/lib/anthropic.ts` uses `claude-sonnet-5`.
  Swap it if your account doesn't have access to that model.
- **Anonymous Spotify token cache**: the app-only (Client Credentials) search
  token is cached in module scope per Worker isolate — cheap to re-fetch on a
  cold start, no shared cache needed for this traffic pattern.
- **Scope**: Spotify login only requests `user-read-email user-read-private`
  (identity only) — this app never reads or modifies a user's library or
  playlists, only searches Spotify's public catalog.
- **PWA**: `apps/web` is installable (Add to Home Screen / desktop install
  prompt) via `vite-plugin-pwa` — manifest + a Workbox-generated service
  worker precache the app shell for offline loading. The icon is an
  original design (not Spotify's logo, which their brand guidelines
  reserve for things like a "Listen on Spotify" badge, not a third-party
  app's own icon) — source at `apps/web/public/pwa/icon-master.svg`. The
  service worker only runs in production builds (`pnpm build`), not
  `vite dev`, so it won't fight with Vite's HMR locally; `/api/*` is
  explicitly excluded from the SW's navigation fallback and was verified
  to pass through to the network untouched.
