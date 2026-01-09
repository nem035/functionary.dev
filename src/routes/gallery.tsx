import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { compiledCss } from "../app/compiledCss";
import { Container } from "../components/Container";
import { Button } from "../components/Button";
import { Card } from "../components/Card";

const router = new Hono<{ Bindings: Env; Variables: Variables }>();

router.get("/gallery", async (c) => {
  const email = c.get("userEmail") || null;
  const [images, videos] = await Promise.all([listKeys(c.env, "generated/", 48), listKeys(c.env, "videos/", 24)]);

  return c.html(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Gallery</title>
        <style dangerouslySetInnerHTML={{ __html: compiledCss }} />
      </head>
      <body class="font-sans bg-bg text-text">
        <div class="relative min-h-screen overflow-hidden">
          <div class="pointer-events-none absolute -top-24 -right-24 h-[520px] w-[520px] rounded-full blur-3xl opacity-25 bg-gradient-to-br from-accent2 to-accent" />
          <div class="pointer-events-none absolute -bottom-28 -left-28 h-[560px] w-[560px] rounded-full blur-3xl opacity-20 bg-gradient-to-tr from-[#F3E8D8] to-surface2" />

          <header class="relative z-10">
            <Container>
              <div class="flex items-center justify-between py-6">
                <a href="/" class="inline-flex items-center gap-2 font-semibold tracking-tight">
                  <span class="h-8 w-8 rounded-lg bg-surface2 border border-border" />
                  Product Studio
                </a>
                <div class="flex items-center gap-3">
                  <a href="/pricing" class="text-sm text-text2 hover:text-text">
                    Pricing
                  </a>
                  {email ? (
                    <form method="post" action="/logout">
                      <button class="text-sm text-text2 hover:text-text">Sign out</button>
                    </form>
                  ) : null}
                  <a href="/#app">
                    <Button type="button">New</Button>
                  </a>
                </div>
              </div>
            </Container>
          </header>

          <main class="relative z-10 py-8">
            <Container>
              <div class="flex items-end justify-between gap-6 flex-wrap">
                <div>
                  <div class="text-xs uppercase tracking-wide text-text2/70 mb-3">Gallery</div>
                  <h1 class="text-4xl font-semibold tracking-tight">Recent generations</h1>
                  <p class="mt-3 text-text2">Images and videos saved to your R2 bucket.</p>
                </div>
              </div>

              <section class="mt-8">
                <div class="text-xs uppercase tracking-wide text-text2/70 mb-3">Images</div>
                {images.length === 0 ? (
                  <Card className="p-6 text-text2">No images yet.</Card>
                ) : (
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {images.map((k) => (
                      <a
                        class="rounded-xl border border-border bg-surface overflow-hidden shadow-sm hover:-translate-y-[1px] transition"
                        href={`/api/file?key=${encodeURIComponent(k)}`}
                        target="_blank"
                      >
                        <img class="block w-full h-40 object-cover" src={`/api/file?key=${encodeURIComponent(k)}`} />
                      </a>
                    ))}
                  </div>
                )}
              </section>

              <section class="mt-10">
                <div class="text-xs uppercase tracking-wide text-text2/70 mb-3">Videos</div>
                {videos.length === 0 ? (
                  <Card className="p-6 text-text2">No videos yet.</Card>
                ) : (
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {videos.map((k) => (
                      <Card className="p-3 shadow-md">
                        <video class="w-full rounded-lg" controls src={`/api/file?key=${encodeURIComponent(k)}`} />
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            </Container>
          </main>
        </div>
      </body>
    </html>,
  );
});

async function listKeys(env: Env, prefix: string, limit: number) {
  const out: string[] = [];
  let cursor: string | undefined;
  while (out.length < limit) {
    const res = await env.ASSETS.list({ prefix, cursor });
    for (const o of res.objects) {
      out.push(o.key);
      if (out.length >= limit) break;
    }
    if (!res.truncated) break;
    cursor = res.cursor;
  }
  return out;
}

export default router;
