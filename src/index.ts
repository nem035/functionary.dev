import { Hono } from "hono";
import type { Env, Variables } from "./types";
import { withRequestContext, requireAuthApi, requireAuthUi } from "./lib/middleware";
import ui from "./routes/ui";
import api from "./routes/api";
import gallery from "./routes/gallery";
import auth from "./routes/auth";
import pricing from "./routes/pricing";
import demo from "./routes/demo";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", (c, next) => withRequestContext(c, next));

// Public routes
app.route("/", auth);
app.route("/", ui);
app.route("/", pricing);
app.route("/", demo);

// Auth gates
app.use("/api/*", (c, n) => requireAuthApi()(c, n));
app.use("/gallery", (c, n) => requireAuthUi()(c, n));

// Protected routes
app.route("/", api);
app.route("/", gallery);

export default { fetch: app.fetch };
