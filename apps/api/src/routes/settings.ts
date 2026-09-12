import { Hono } from "hono";
import type { Env } from "../env";
import { getCurrentUserStub } from "../lib/session";

const settings = new Hono<{ Bindings: Env }>();

settings.get("/anthropic-key", async (c) => {
  const stub = await getCurrentUserStub(c);
  if (!stub) return c.json({ error: "Not authenticated" }, 401);

  const key = await stub.getOwnAnthropicKey();
  return c.json({ hasOwnKey: Boolean(key) });
});

settings.put("/anthropic-key", async (c) => {
  const stub = await getCurrentUserStub(c);
  if (!stub) return c.json({ error: "Not authenticated" }, 401);

  const body = await c.req.json<{ apiKey?: unknown }>();
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";

  if (!apiKey) {
    return c.json({ error: "Please provide an API key." }, 400);
  }
  if (!apiKey.startsWith("sk-ant-") || apiKey.length > 200) {
    return c.json(
      { error: "That doesn't look like a valid Anthropic API key (should start with 'sk-ant-')." },
      400
    );
  }

  await stub.saveOwnAnthropicKey(apiKey);
  return c.json({ hasOwnKey: true });
});

settings.delete("/anthropic-key", async (c) => {
  const stub = await getCurrentUserStub(c);
  if (!stub) return c.json({ error: "Not authenticated" }, 401);

  await stub.clearOwnAnthropicKey();
  return c.json({ hasOwnKey: false });
});

export default settings;
