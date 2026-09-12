# Mood Music

Type a mood or a description of your day, and get back real Spotify playlists that match.

## How it works

```
User types mood
      │
      ▼
POST /api/mood-playlists
      │
      ├─► Claude (Anthropic SDK)
      │     Forced tool-call returns strict JSON:
      │       { vibeSummary, searchQueries: [3-5 short phrases] }
      │
      ▼
Spotify Web API — Client Credentials flow
      │   (no user login needed; this is read-only public search)
      │   one /v1/search?type=playlist call per query, results merged + deduped
      ▼
JSON response → rendered as playlist cards in the UI
```

Two API calls happen server-side, in this order, inside a single route handler
(`app/api/mood-playlists/route.ts`):

1. **`lib/anthropic.ts`** — sends the raw mood text to Claude with a single
   tool defined (`submit_mood_queries`) and `tool_choice` forced to that tool,
   so the response is always parseable JSON — no prompt-engineering a "please
   respond in JSON" instruction and hoping it's followed.
2. **`lib/spotify.ts`** — gets an app-only access token via Spotify's
   [Client Credentials flow](https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow)
   (cached in memory until it expires), then calls the Search API once per
   query term and merges/dedupes the results.

The Spotify secret and the Anthropic key **only ever live on the server**
(Next.js route handler) — the browser never sees them.

## Setup

1. **Get a Spotify app.** Go to the
   [Spotify Developer Dashboard](https://developer.spotify.com/dashboard),
   create an app, and copy the Client ID and Client Secret. No redirect URI
   is needed for this flow — Client Credentials doesn't do user login.
2. **Get an Anthropic API key** from the
   [Claude Console](https://console.anthropic.com).
3. Copy the env template and fill it in:
   ```bash
   cp .env.local.example .env.local
   ```
4. Install and run:
   ```bash
   npm install
   npm run dev
   ```
5. Open http://localhost:3000, type a mood, hit "Find playlists."

## Notes / things you'll likely want to change

- **Model name**: `lib/anthropic.ts` uses `claude-sonnet-5`. If you're on an
  older API key/org without access to it, swap in whichever model string
  your account has (check the [Models docs](https://docs.claude.com/en/docs/about-claude/models/overview)).
- **Token cache**: the in-memory Spotify token cache assumes a single server
  instance. If you deploy to a serverless/multi-instance platform, move it to
  Redis or similar, or just accept the extra token requests (they're cheap
  and not rate-limited tightly).
- **Rate limits**: each mood query triggers 1 Claude call + up to 5 Spotify
  search calls. Fine for personal use; add caching/debouncing before putting
  this in front of real traffic.
- **This returns existing playlists**, not a generated one. If you'd rather
  have Claude pick individual tracks and have the app create a brand-new
  playlist on the user's account, that requires the Authorization Code flow
  (real user login + `playlist-modify-public` scope) instead of Client
  Credentials — a materially different auth setup, happy to build that
  version if you want it instead.
