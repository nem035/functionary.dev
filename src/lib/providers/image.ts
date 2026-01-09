import type { Env } from "../../types";
import { fal } from "@fal-ai/client";

export type GeneratedImage = {
  key: string; // R2 key under generated/
  width: number;
  height: number;
  bytes: number;
  contentType: string;
};

export type ImageProvider = {
  name: "fal";
  generate: (env: Env, opts: { sourceKey: string; prompt: string; count: number }) => Promise<GeneratedImage[]>;
};

export function getImageProvider(env: Env): ImageProvider {
  return falImageProvider;
}

// Stub providers – implement API calls later
const falImageProvider: ImageProvider = {
  name: "fal",
  async generate(env, { sourceKey, prompt, count }) {
    if ((env.FAL_KEY || env.FAL_API_KEY) && (fal as any).config) {
      (fal as any).config({ credentials: (env.FAL_KEY || env.FAL_API_KEY)! });
    }
    // Configure fal client (expects FAL_KEY set as global env var if needed)
    // Note: fal.config() reads from env.FAL_KEY if provided via polyfill; otherwise, rely on default client behavior.
    // We will upload the source image to fal storage to get a URL, then invoke image edit model.

    const src = await env.ASSETS.get(sourceKey);
    if (!src) throw new Error("Source image not found");
    const ct = src.httpMetadata?.contentType || "image/png";
    const ab = await src.arrayBuffer();
    const file = new File([ab], `source.${ct.includes("jpeg") ? "jpg" : ct.split("/")[1] || "png"}`, { type: ct });
    const startUrl = await fal.storage.upload(file);

    const images: GeneratedImage[] = [];
    const tasks = Array.from({ length: count }).map(async () => {
    const result = await fal.subscribe("fal-ai/gpt-image-1.5/edit", {
      input: { prompt, image_urls: [startUrl] },
      logs: false,
    });
      // Expecting result.data to contain an array of image URLs; handle both single and multi
      const urls: string[] = Array.isArray((result as any).data?.images)
        ? (result as any).data.images
        : ((result as any).data?.image || (result as any).data?.url ? [((result as any).data.image || (result as any).data.url)] : []);

      for (const u of urls) {
        const res = await fetch(u);
        const buf = await res.arrayBuffer();
        const contentType = res.headers.get("content-type") || "image/png";
        const outKey = `generated/${crypto.randomUUID()}.${contentType.includes("jpeg") ? "jpg" : contentType.split("/")[1] || "png"}`;
        await env.ASSETS.put(outKey, buf, { httpMetadata: { contentType } });
        images.push({ key: outKey, width: 0, height: 0, bytes: buf.byteLength, contentType });
      }
    });

    await Promise.all(tasks);
    return images;
  },
};
