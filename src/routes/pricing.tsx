import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { compiledCss } from "../app/compiledCss";
import { Container } from "../components/Container";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CREDIT_PACKS, IMAGE_PRICING, VIDEO_PRICING } from "../data/pricing";

const router = new Hono<{ Bindings: Env; Variables: Variables }>();

router.get("/pricing", (c) => {
  const email = c.get("userEmail") || null;
  const auth = email ? "1" : "0";

  const plans = [
    { id: "free", name: "Free", monthly: 0, credits: 0, cta: "Start", features: ["1 standard video", "3 bundled images", "Watermark"] },
    {
      id: "pro",
      name: "Pro",
      monthly: 19,
      credits: 24,
      cta: "Start free trial",
      features: ["12 standard clips or 4 premium", "Commercial use", "Priority queue"],
      highlight: false,
    },
    {
      id: "pro-plus",
      name: "Pro+",
      monthly: 49,
      credits: 80,
      cta: "Start free trial",
      features: ["40 standard or 13 premium", "1080p / 4K available", "Priority rendering"],
      highlight: true,
    },
    {
      id: "scale",
      name: "Scale",
      monthly: 149,
      credits: 300,
      cta: "Get started",
      features: ["150 standard or 50 premium", "Priority support", "Team seats (soon)"],
      highlight: false,
    },
  ] as const;

  return c.html(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Pricing</title>
        <style dangerouslySetInnerHTML={{ __html: compiledCss }} />
      </head>
      <body class="font-sans bg-bg text-text" data-auth={auth}>
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
                <div class="flex items-center gap-3">
                  <a href="/pricing" class="text-sm text-text2 hover:text-text">
                    Pricing
                  </a>
                  {email ? (
                    <form method="post" action="/logout">
                      <button class="text-sm text-text2 hover:text-text">Sign out</button>
                    </form>
                  ) : (
                    <a href="/login" class="text-sm text-text2 hover:text-text">
                      Login
                    </a>
                  )}
                  <a href={email ? "/#app" : "/login"}>
                    <Button type="button">Get started</Button>
                  </a>
                </div>
              </div>
            </Container>
          </header>

          <main class="relative z-10 py-12 md:py-16">
            <Container>
              <div class="max-w-[640px]">
                <div class="text-xs uppercase tracking-wide text-text2/70 mb-3">Pricing</div>
                <h1 class="text-4xl md:text-6xl font-semibold tracking-tight">Simple, fair pricing</h1>
                <p class="mt-4 text-base md:text-lg text-text2 leading-relaxed">
                  Credits keep things predictable. Save 20% with yearly.
                </p>
              </div>

              <div class="mt-8 flex items-center gap-3 text-sm text-text2">
                <span>Monthly</span>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input id="billing" type="checkbox" class="sr-only peer" />
                  <span class="w-12 h-7 rounded-full bg-surface border border-border peer-checked:bg-surface2 transition" />
                  <span class="absolute left-1 top-1 h-5 w-5 rounded-full bg-white border border-border shadow-sm transition peer-checked:translate-x-5" />
                </label>
                <span>
                  Yearly <span class="text-text2/70">(−20%)</span>
                </span>
              </div>

              <section class="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {plans.map((p) => (
                  <Card className={(p as any).highlight ? "shadow-md ring-1 ring-accent/25" : ""}>
                    <div class="p-6">
                      <div class="flex items-start justify-between">
                        <div>
                          <div class="text-lg font-semibold">{p.name}</div>
                          <div class="text-sm text-text2">{p.id === "free" ? "Forever" : `${p.credits} credits / month`}</div>
                        </div>
                        {(p as any).highlight ? (
                          <div class="text-xs rounded-full bg-surface2 border border-border px-2 py-1 text-text2">Popular</div>
                        ) : null}
                      </div>

                      <div class="mt-6">
                        <div class="text-4xl font-semibold tracking-tight">
                          <span class="price" data-monthly={p.monthly}>
                            ${p.monthly.toFixed(2)}
                          </span>
                        </div>
                        <div class="text-sm text-text2">{p.id === "free" ? "" : "per month"}</div>
                      </div>

                      <div class="mt-6">
                        <Button
                          type="button"
                          variant={(p as any).highlight ? "primary" : "secondary"}
                          className="w-full"
                          data-plan={p.id}
                        >
                          {p.cta}
                        </Button>
                      </div>

                      <ul class="mt-6 space-y-2 text-sm text-text2">
                        {p.features.map((f) => (
                          <li class="flex gap-2">
                            <span class="text-accent">✓</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Card>
                ))}
              </section>

              <section class="mt-10">
                <div class="flex items-end justify-between gap-6 flex-wrap">
                  <div>
                    <h2 class="text-2xl font-semibold tracking-tight">Credit packs</h2>
                    <p class="mt-2 text-sm text-text2">For teams or bursts, no subscription required.</p>
                  </div>
                </div>

                <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {CREDIT_PACKS.map((p) => (
                    <Card>
                      <div class="p-5 flex items-center justify-between gap-4">
                        <div>
                          <div class="font-semibold">{p.name}</div>
                          <div class="text-sm text-text2">{p.credits} credits</div>
                        </div>
                        <Button type="button" variant="secondary" data-pack={p.id}>
                          Buy
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>

              <section class="mt-10">
                <Card>
                  <div class="p-6">
                    <div class="text-xs uppercase tracking-wide text-text2/70 mb-3">How credits work</div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-text2">
                      <ul class="space-y-2">
                        <li>
                          Standard video (5s, 720p): <strong class="text-text">{VIDEO_PRICING.creditMap.standardClip}</strong>{" "}
                          credits
                        </li>
                        <li>
                          Premium video (5s, 720p): <strong class="text-text">{VIDEO_PRICING.creditMap.premiumClip}</strong>{" "}
                          credits
                        </li>
                        <li>
                          Extra second: <strong class="text-text">{VIDEO_PRICING.creditMap.extraSecond}</strong> credit
                        </li>
                      </ul>
                      <ul class="space-y-2">
                        <li>
                          Image set (4×1MP): <strong class="text-text">{IMAGE_PRICING.creditMap.set1mp}</strong> credit
                        </li>
                        <li>
                          Image set (4×2MP): <strong class="text-text">{IMAGE_PRICING.creditMap.set2mp}</strong> credits
                        </li>
                        <li>
                          Image set (4×4MP): <strong class="text-text">{IMAGE_PRICING.creditMap.set4mp}</strong> credits
                        </li>
                      </ul>
                    </div>
                    <div class="mt-4 text-xs text-text2/70">1080p +30%, 4K +120% credits. Commercial use included.</div>
                  </div>
                </Card>
              </section>
            </Container>
          </main>
        </div>

        <script dangerouslySetInnerHTML={{ __html: js }} />
      </body>
    </html>,
  );
});

const js = `(() => {
  const auth = document.body.dataset.auth === '1';
  const billing = document.getElementById('billing');
  const yearlyDiscount = 0.8;

  const update = () => {
    const yearly = billing && billing.checked;
    document.querySelectorAll('.price').forEach((el) => {
      const m = parseFloat(el.getAttribute('data-monthly') || '0') || 0;
      const v = yearly ? Math.round(m * yearlyDiscount * 100) / 100 : m;
      el.textContent = '$' + v.toFixed(2);
    });
  };
  billing && billing.addEventListener('change', update);
  update();

  const post = async (url, body) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) });
    if (res.status === 401) { window.location.href = '/login'; return; }
    return res;
  };

  document.querySelectorAll('[data-plan]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const plan = btn.getAttribute('data-plan');
      if (!auth) { window.location.href = '/login'; return; }
      await post('/api/subscribe', { plan, billing: (billing && billing.checked) ? 'yearly' : 'monthly' });
      alert('Checkout coming soon.');
    });
  });

  document.querySelectorAll('[data-pack]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-pack');
      if (!auth) { window.location.href = '/login'; return; }
      await post('/api/purchase/credit-pack', { id });
      alert('Checkout coming soon.');
    });
  });
})();`;

export default router;
