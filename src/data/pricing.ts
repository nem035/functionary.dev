export type ClipTier = "standard" | "premium";

export type VideoPricing = {
  standardClipUsd: number; // 5s 720p
  premiumClipUsd: number;  // 5s 720p
  extraSecondUsd: { standard: number; premium: number };
  resolutionMultiplier: { hd1080: number; uhd4k: number };
  creditMap: { standardClip: number; premiumClip: number; extraSecond: number };
};

export type ImagePricing = {
  set4ImagesUsd: { mp1: number; mp2: number; mp4: number };
  addonSetUsd: { mp1: number; mp2: number; mp4: number };
  creditMap: { set1mp: number; set2mp: number; set4mp: number; single1mp: number };
};

export type CreditPack = { id: string; name: string; credits: number; priceUsd: number };

export type SubscriptionPlan = {
  id: string;
  name: string;
  monthlyUsd: number;
  creditsPerMonth: number;
  features: string[];
};

export const VIDEO_PRICING: VideoPricing = {
  standardClipUsd: 2.0,
  premiumClipUsd: 6.0,
  extraSecondUsd: { standard: 0.35, premium: 1.0 },
  resolutionMultiplier: { hd1080: 1.3, uhd4k: 2.2 },
  creditMap: { standardClip: 2, premiumClip: 6, extraSecond: 0.35 },
};

export const IMAGE_PRICING: ImagePricing = {
  set4ImagesUsd: { mp1: 0.99, mp2: 1.49, mp4: 2.49 },
  addonSetUsd: { mp1: 0.79, mp2: 1.19, mp4: 1.99 },
  creditMap: { set1mp: 0.5, set2mp: 0.75, set4mp: 1.0, single1mp: 0.15 },
};

export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack-25", name: "$25 Pack", credits: 25, priceUsd: 25 },
  { id: "pack-49", name: "$49 Pack", credits: 60, priceUsd: 49 },
  { id: "pack-99", name: "$99 Pack", credits: 140, priceUsd: 99 },
];

export const SUBSCRIPTIONS: SubscriptionPlan[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyUsd: 19,
    creditsPerMonth: 24,
    features: [
      "12 standard clips or 4 premium",
      "3 bundled images per video",
      "1080p available (+30%)",
      "Commercial use",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyUsd: 49,
    creditsPerMonth: 80,
    features: [
      "40 standard clips or 13 premium",
      "Priority rendering",
      "1080p/4K available",
      "Commercial use",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    monthlyUsd: 149,
    creditsPerMonth: 300,
    features: [
      "150 standard clips or 50 premium",
      "Priority support",
      "Team seats (coming soon)",
    ],
  },
];

