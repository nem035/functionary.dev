export type Env = {
  ASSETS: R2Bucket;
  APP_BASE_URL: string;
  SESSION_SECRET?: string;

  // Image providers
  OPENAI_API_KEY?: string;
  NANO_BANANA_API_KEY?: string;
  OPENAI_IMAGE_MODEL?: string; // e.g., "gpt-image-1"
  DEFAULT_IMAGE_PROVIDER?: "nano-banana" | "openai-image-1";

  // Video providers
  VIDEO_KLING_API_KEY?: string;
  VIDEO_VEO3_API_KEY?: string;
  DEFAULT_VIDEO_PROVIDER?: "kling" | "veo3";

  // fal.ai
  FAL_KEY?: string;         // preferred
  FAL_API_KEY?: string;     // alias

  // Email (magic links)
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
};

export type Variables = {
  requestId: string;
  log: (level: "info" | "error" | "warn" | "debug", msg: string, data?: Record<string, unknown>) => void;
  userEmail?: string | null;
};
