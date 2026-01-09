import { z } from "zod";

export function userError(title: string, detail?: string) {
  return { error: title, detail };
}

export function mapProviderError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  // Normalize sensitive/provider errors to user-friendly copy
  if (/rate|quota|limit/i.test(message)) return userError("Slow Down", "Please try again in a moment.");
  if (/timeout|timed out|deadline/i.test(message)) return userError("AI Unavailable", "Service is busy. Please retry.");
  return userError("Something Went Wrong", "Please try again.");
}

export const UploadInit = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
});

export const GenerateImagesInput = z.object({
  objectKey: z.string().min(1), // uploads/... key
  prompt: z.string().min(1),
  provider: z.enum(["fal"]).optional(),
  count: z.number().int().min(1).max(4).default(1),
});

export const GenerateVideoInput = z.object({
  frames: z.array(z.string().min(1)).min(1).max(8), // generated/... keys
  prompt: z.string().optional(),
  provider: z.enum(["kling", "veo3"]).optional(),
});

export type GenerateImagesInput = z.infer<typeof GenerateImagesInput>;
export type GenerateVideoInput = z.infer<typeof GenerateVideoInput>;
