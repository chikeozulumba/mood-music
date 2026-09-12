import { getCookie } from "hono/cookie";
import type { Context } from "hono";
import type { Env } from "../env";
import type { UserState } from "../durable-objects/user-state";

export const SESSION_COOKIE = "session_id";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function getCurrentUserStub(
  c: Context<{ Bindings: Env }>
): Promise<DurableObjectStub<UserState> | null> {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (!sessionId) return null;

  const spotifyUserId = await c.env.SESSIONS.get(`session:${sessionId}`);
  if (!spotifyUserId) return null;

  return c.env.USER_STATE.getByName(spotifyUserId);
}
