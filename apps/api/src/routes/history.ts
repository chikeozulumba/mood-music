import { Hono } from "hono";
import type { Env } from "../env";
import { getCurrentUserStub } from "../lib/session";

const history = new Hono<{ Bindings: Env }>();

history.get("/", async (c) => {
  const stub = await getCurrentUserStub(c);
  if (!stub) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  const entries = await stub.listHistory(20);
  return c.json({ entries });
});

export default history;
