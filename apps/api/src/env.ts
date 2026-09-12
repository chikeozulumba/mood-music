import type { UserState } from "./durable-objects/user-state";

export interface Env {
  USER_STATE: DurableObjectNamespace<UserState>;
  MOOD_MUSIC_SESSIONS: KVNamespace;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  SPOTIFY_REDIRECT_URI: string;
  ANTHROPIC_API_KEY: string;
}
