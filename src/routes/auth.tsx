import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { compiledCss } from "../app/compiledCss";
import { Container } from "../components/Container";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { createMagicToken, verifyMagicToken, createSessionToken, buildSetCookie, clearCookie } from "../lib/auth";

const router = new Hono<{ Bindings: Env; Variables: Variables }>();

router.get("/login", (c) => {
  return c.html(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Sign in</title>
        <style dangerouslySetInnerHTML={{ __html: compiledCss }} />
      </head>
      <body class="font-sans bg-bg text-text">
        <div class="relative min-h-screen overflow-hidden">
          <div class="pointer-events-none absolute -top-24 -right-24 h-[520px] w-[520px] rounded-full blur-3xl opacity-35 bg-gradient-to-br from-accent2 to-accent" />
          <div class="pointer-events-none absolute -bottom-28 -left-28 h-[560px] w-[560px] rounded-full blur-3xl opacity-30 bg-gradient-to-tr from-[#F3E8D8] to-surface2" />

          <header class="relative z-10">
            <Container>
              <div class="flex items-center justify-between py-6">
                <a href="/" class="inline-flex items-center gap-2 font-semibold tracking-tight">
                  <span class="h-8 w-8 rounded-lg bg-surface2 border border-border" />
                  Product Studio
                </a>
                <a href="/pricing" class="text-sm text-text2 hover:text-text">
                  Pricing
                </a>
              </div>
            </Container>
          </header>

          <main class="relative z-10 py-10">
            <Container>
              <div class="max-w-[560px]">
                <div class="text-xs uppercase tracking-wide text-text2/70 mb-3">Login</div>
                <h1 class="text-4xl font-semibold tracking-tight">Magic link sign in</h1>
                <p class="mt-3 text-text2">
                  Enter your email. We’ll send a link that signs you in instantly.
                </p>
              </div>

              <div class="mt-8 max-w-[560px]">
                <Card className="shadow-md p-6">
                  <form method="post" action="/login" class="space-y-4">
                    <div>
                      <div class="text-xs uppercase tracking-wide text-text2/70 mb-2">Email</div>
                      <input
                        type="email"
                        name="email"
                        required
                        placeholder="you@shop.com"
                        class="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                      />
                    </div>
                    <Button type="submit" className="w-full">
                      Send magic link
                    </Button>
                    <div class="text-xs text-text2/70">
                      Tip: set <span class="font-mono">SESSION_SECRET</span> and optionally{" "}
                      <span class="font-mono">RESEND_API_KEY</span>/<span class="font-mono">RESEND_FROM</span>.
                    </div>
                  </form>
                </Card>
              </div>
            </Container>
          </main>
        </div>
      </body>
    </html>,
  );
});

router.post("/login", async (c) => {
  const form = await c.req.formData();
  const email = String(form.get("email") || "").toLowerCase().trim();
  if (!email || !email.includes("@")) return c.text("Invalid email", 400);

  if (!c.env.SESSION_SECRET) {
    return c.html(
      `<p>SESSION_SECRET is not set. Run <code>wrangler secret put SESSION_SECRET</code> and try again.</p>`,
      500,
    );
  }

  const token = await createMagicToken(c.env, email);
  const link = `${c.env.APP_BASE_URL}/magic?token=${encodeURIComponent(token)}`;

  if (c.env.RESEND_API_KEY && c.env.RESEND_FROM) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: c.env.RESEND_FROM,
          to: email,
          subject: "Your magic link",
          html: `<p>Click to sign in: <a href="${link}">${link}</a></p>`,
        }),
      });
    } catch {
      // Fall through to showing the link (dev-friendly)
    }
  }

  return c.html(
    `<div style="font-family: ui-sans-serif, system-ui; padding: 24px;">
      <p>Magic link sent.</p>
      <p><a href="${link}">Continue</a></p>
    </div>`,
  );
});

router.get("/magic", async (c) => {
  const url = new URL(c.req.url);
  const token = url.searchParams.get("token");
  if (!token) return c.text("Missing token", 400);
  const email = await verifyMagicToken(c.env, token);
  if (!email) return c.text("Invalid or expired link", 400);
  const session = await createSessionToken(c.env, email);
  const set = buildSetCookie("session", session, 60 * 60 * 24 * 30);
  return new Response(null, { status: 302, headers: { Location: "/", "Set-Cookie": set } });
});

router.post("/logout", async () => {
  return new Response(null, { status: 302, headers: { Location: "/", "Set-Cookie": clearCookie("session") } });
});

export default router;
