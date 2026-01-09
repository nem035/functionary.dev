import type { Env } from "../../types";
import { fal } from "@fal-ai/client";

export type GeneratedVideo = {
  key: string; // R2 key under videos/
  bytes: number;
  contentType: string; // video/mp4 or video/webm
};

export type VideoProvider = {
  name: "kling" | "veo3";
  render: (env: Env, opts: { frameKeys: string[]; prompt?: string }) => Promise<GeneratedVideo>;
};

export function getVideoProvider(env: Env, prefer?: "kling" | "veo3"): VideoProvider {
  const chosen = prefer ?? (env.DEFAULT_VIDEO_PROVIDER as any) ?? "kling";
  if (chosen === "veo3") return veo3Provider;
  return klingProvider;
}

// Stub providers – implement API calls later
const klingProvider: VideoProvider = {
  name: "kling",
  async render(env, { frameKeys, prompt }) {
    if ((env.FAL_KEY || env.FAL_API_KEY) && (fal as any).config) {
      (fal as any).config({ credentials: (env.FAL_KEY || env.FAL_API_KEY)! });
    }
    // Upload the first frame as start image (kling image-to-video)
    const firstKey = frameKeys[0];
    const obj = await env.ASSETS.get(firstKey);
    if (!obj) throw new Error("Start image not found");
    const ct = obj.httpMetadata?.contentType || "image/png";
    const ab = await obj.arrayBuffer();
    const file = new File([ab], `start.${ct.includes("jpeg") ? "jpg" : ct.split("/")[1] || "png"}`, { type: ct });
    const startUrl = await fal.storage.upload(file);

    const result = await fal.subscribe("fal-ai/kling-video/v2.6/pro/image-to-video", {
      input: { prompt: prompt || "", start_image_url: startUrl },
      logs: false,
    });

    const url = (result as any).data?.video || (result as any).data?.url;
    if (!url) throw new Error("Video URL missing from provider result");
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "video/webm";
    const key = `videos/${crypto.randomUUID()}.${contentType.includes("mp4") ? "mp4" : "webm"}`;
    await env.ASSETS.put(key, buf, { httpMetadata: { contentType } });
    return { key, bytes: buf.byteLength, contentType };
  },
};

const veo3Provider: VideoProvider = {
  name: "veo3",
  async render(env, { frameKeys, prompt }) {
    if ((env.FAL_KEY || env.FAL_API_KEY) && (fal as any).config) {
      (fal as any).config({ credentials: (env.FAL_KEY || env.FAL_API_KEY)! });
    }
    // Use prompt-only Veo3 or fall back to kling flow
    if (!prompt) return klingProvider.render(env, { frameKeys, prompt: "" });
    const result = await fal.subscribe("fal-ai/veo3", {
      input: { prompt },
      logs: false,
    });
    const url = (result as any).data?.video || (result as any).data?.url;
    if (!url) return klingProvider.render(env, { frameKeys, prompt });
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "video/mp4";
    const key = `videos/${crypto.randomUUID()}.${contentType.includes("webm") ? "webm" : "mp4"}`;
    await env.ASSETS.put(key, buf, { httpMetadata: { contentType } });
    return { key, bytes: buf.byteLength, contentType };
  },
};
