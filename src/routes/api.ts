import { Hono } from "hono";
import type { Env, Variables } from "../types";
import { UploadInit, GenerateImagesInput, GenerateVideoInput, mapProviderError } from "../lib/errors";
import { getImageProvider } from "../lib/providers/image";
import { getVideoProvider } from "../lib/providers/video";
import { fal } from "@fal-ai/client";

const router = new Hono<{ Bindings: Env; Variables: Variables }>();

router.post("/api/upload/init", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = UploadInit.safeParse(body);
  if (!parsed.success) return c.json({ error: "Couldn't Save" }, 400);
  const { filename, contentType } = parsed.data;

  const key = `uploads/${crypto.randomUUID()}-${sanitize(filename)}`;
  const uploadUrl = new URL(c.env.APP_BASE_URL + "/api/upload/put");
  uploadUrl.searchParams.set("key", key);
  uploadUrl.searchParams.set("ct", contentType);
  return c.json({ key, uploadUrl: uploadUrl.toString() });
});

router.put("/api/upload/put", async (c) => {
  const url = new URL(c.req.url);
  const key = url.searchParams.get("key");
  const ct = url.searchParams.get("ct") || "application/octet-stream";
  if (!key) return c.json({ error: "Couldn't Save" }, 400);
  const bytes = await c.req.arrayBuffer();
  await c.env.ASSETS.put(key, bytes, { httpMetadata: { contentType: ct } });
  return c.json({ ok: true, key });
});

router.get("/api/file", async (c) => {
  const url = new URL(c.req.url);
  const key = url.searchParams.get("key");
  if (!key) return c.json({ error: "Not Found" }, 404);
  const obj = await c.env.ASSETS.get(key);
  if (!obj) return c.json({ error: "Not Found" }, 404);
  return new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream" } });
});

router.post("/api/generate-images", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = GenerateImagesInput.safeParse(body);
  if (!parsed.success) return c.json({ error: "Couldn't Save" }, 400);
  try {
    const { objectKey, prompt, provider, count } = parsed.data;
    const imageProvider = getImageProvider(c.env);
    const images = await imageProvider.generate(c.env, { sourceKey: objectKey, prompt, count });
    return c.json({ images });
  } catch (err) {
    return c.json(mapProviderError(err), 500);
  }
});

router.post("/api/generate-video", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = GenerateVideoInput.safeParse(body);
  if (!parsed.success) return c.json({ error: "Couldn't Save" }, 400);
  try {
    const { frames, provider } = parsed.data;
    const videoProvider = getVideoProvider(c.env, provider);
    const video = await videoProvider.render(c.env, { frameKeys: frames });
    return c.json({ video });
  } catch (err) {
    return c.json(mapProviderError(err), 500);
  }
});

// Billing stubs (Stripe integration coming soon)
router.post("/api/subscribe", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  c.get("log")("info", "subscribe_stub", { body });
  return c.json({ ok: false, error: "checkout_not_implemented" }, 501);
});

router.post("/api/purchase/credit-pack", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  c.get("log")("info", "purchase_credit_pack_stub", { body });
  return c.json({ ok: false, error: "checkout_not_implemented" }, 501);
});

// Server-Sent Events: generate images with live logs and progressive results
router.get("/api/generate-images-sse", async (c) => {
  const url = new URL(c.req.url);
  const objectKey = url.searchParams.get("objectKey");
  const prompt = url.searchParams.get("prompt") || "";
  const count = Math.min(Math.max(parseInt(url.searchParams.get("count") || "1", 10) || 1, 1), 4);
  if (!objectKey || !prompt) return c.json({ error: "Couldn't Save" }, 400);

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const write = (event: string, data: unknown) => writer.write(enc.encode(`event: ${event}\ndata: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`));

  // Fire-and-stream
  (async () => {
    try {
      // Announce SSE request id to client
      write("start", { requestId: c.get("requestId") });
      // Configure fal credentials if present
      const key = (c.env.FAL_KEY || c.env.FAL_API_KEY) as string | undefined;
      if (key && (fal as any).config) (fal as any).config({ credentials: key });

      // Upload source image to fal storage to get an accessible URL
      const src = await c.env.ASSETS.get(objectKey);
      if (!src) throw new Error("Source image not found");
      const ct = src.httpMetadata?.contentType || "image/png";
      const ab = await src.arrayBuffer();
      const file = new File([ab], `source.${ct.includes("jpeg") ? "jpg" : ct.split("/")[1] || "png"}`, { type: ct });
      const startUrl = await fal.storage.upload(file);

      for (let i = 0; i < count; i++) {
        write("log", `starting_generation_${i + 1}`);
        const stream = await fal.stream("fal-ai/gpt-image-1.5/edit", {
          input: { prompt, image_urls: [startUrl] },
        });
        for await (const ev of stream as any) {
          // Stream raw provider events as logs
          write("log", ev?.type ? { type: ev.type, data: ev } : ev);
        }
        const result: any = await (stream as any).done();
        const urls: string[] = Array.isArray(result?.data?.images)
          ? result.data.images
          : (result?.data?.image || result?.data?.url ? [result.data.image || result.data.url] : []);
        for (const u of urls) {
          const res = await fetch(u);
          const buf = await res.arrayBuffer();
          const contentType = res.headers.get("content-type") || "image/png";
          const outKey = `generated/${crypto.randomUUID()}.${contentType.includes("jpeg") ? "jpg" : contentType.split("/")[1] || "png"}`;
          await c.env.ASSETS.put(outKey, buf, { httpMetadata: { contentType } });
          write("image", { key: outKey, contentType, bytes: buf.byteLength });
        }
        write("log", `done_generation_${i + 1}`);
      }
      write("done", { ok: true });
    } catch (err) {
      write("error", { message: (err as Error)?.message || String(err) });
    } finally {
      writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

export default router;
