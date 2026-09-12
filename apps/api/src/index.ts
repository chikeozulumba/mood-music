import { Hono } from "hono";
import type { Env } from "./env";
import auth from "./routes/auth";
import moodPlaylists from "./routes/mood-playlists";
import history from "./routes/history";
import settings from "./routes/settings";

const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.route("/auth", auth);
app.route("/mood-playlists", moodPlaylists);
app.route("/history", history);
app.route("/settings", settings);

export { UserState } from "./durable-objects/user-state";
export default app;
