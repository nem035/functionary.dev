import type { Context, Next } from "hono";
import { makeLogger } from "./logger";
import type { Env, Variables } from "../types";
import { parseSessionToken } from "./auth";

export async function withRequestContext(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const requestId = crypto.randomUUID();
  const log = makeLogger(requestId);
  c.set("requestId", requestId);
  c.set("log", log);
  // Attach user from session cookie if present
  const cookie = c.req.header("cookie") || "";
  const session = readCookie(cookie, "session");
  const email = await parseSessionToken(c.env, session).catch(() => null);
  if (email) c.set("userEmail", email);
  await next();
}

export function requireAuthUi() {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const email = c.get("userEmail");
    if (!email) return c.redirect("/login");
    await next();
  };
}

export function requireAuthApi() {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const email = c.get("userEmail");
    if (!email) return c.json({ error: "unauthorized" }, 401);
    await next();
  };
}

function readCookie(header: string, name: string) {
  const parts = header.split(/;\s*/);
  for (const p of parts) {
    const [k, ...rest] = p.split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}
