import { Hono } from "hono";
import type { Env, Variables } from "../types";

const router = new Hono<{ Bindings: Env; Variables: Variables }>();

router.get("/demo/example", (c) => {
  const url = new URL(c.req.url);
  const i = Math.min(Math.max(parseInt(url.searchParams.get("i") || "1", 10) || 1, 1), 3);
  const svg = i === 1 ? example1 : i === 2 ? example2 : example3;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
});

router.get("/demo/sample", () => {
  return new Response(sampleProduct, {
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
});

const sharedBg = `
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#FFF7ED"/>
      <stop offset="1" stop-color="#FAF7F2"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000" flood-opacity="0.10"/>
    </filter>
  </defs>
`;

const example1 = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="650" viewBox="0 0 900 650">
  ${sharedBg}
  <rect width="900" height="650" rx="44" fill="url(#bg)"/>
  <g filter="url(#soft)">
    <rect x="110" y="120" width="680" height="410" rx="42" fill="#fff"/>
  </g>
  <rect x="140" y="150" width="620" height="350" rx="34" fill="#F3E8D8"/>
  <g>
    <ellipse cx="450" cy="430" rx="230" ry="32" fill="#000" opacity="0.08"/>
    <path d="M300 390c80-90 180-120 300-60 40 20 60 30 80 60 10 20 6 40-10 52-20 14-70 30-170 30-120 0-200-20-240-40-30-16-34-26-60-42-20-12-14-24 0-40z" fill="#E5E7EB"/>
    <path d="M330 360c70-70 150-90 260-40 34 15 54 22 70 46 8 12 2 24-14 30-26 10-70 18-150 18-86 0-150-10-180-22-16-6-28-14-46-22-16-8-10-16 0-30z" fill="#D1D5DB"/>
  </g>
  <text x="160" y="110" font-family="ui-sans-serif, system-ui" font-size="18" fill="#525252">Lifestyle scene</text>
</svg>`;

const example2 = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="560" height="420" viewBox="0 0 560 420">
  ${sharedBg}
  <rect width="560" height="420" rx="32" fill="url(#bg)"/>
  <g filter="url(#soft)">
    <rect x="90" y="70" width="380" height="280" rx="28" fill="#fff"/>
  </g>
  <rect x="120" y="100" width="320" height="220" rx="22" fill="#FFF7ED"/>
  <g>
    <ellipse cx="280" cy="290" rx="140" ry="22" fill="#000" opacity="0.07"/>
    <rect x="200" y="150" width="160" height="120" rx="22" fill="#E7E5E4"/>
    <rect x="220" y="135" width="120" height="26" rx="13" fill="#D6D3D1"/>
  </g>
  <text x="110" y="52" font-family="ui-sans-serif, system-ui" font-size="14" fill="#525252">Studio</text>
</svg>`;

const example3 = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="560" height="420" viewBox="0 0 560 420">
  ${sharedBg}
  <rect width="560" height="420" rx="32" fill="url(#bg)"/>
  <g filter="url(#soft)">
    <rect x="120" y="90" width="320" height="240" rx="26" fill="#fff"/>
  </g>
  <rect x="145" y="115" width="270" height="190" rx="20" fill="#F3E8D8"/>
  <g>
    <ellipse cx="280" cy="275" rx="120" ry="20" fill="#000" opacity="0.07"/>
    <path d="M240 160c0-22 18-40 40-40s40 18 40 40v90c0 18-16 30-40 30s-40-12-40-30v-90z" fill="#E5E7EB"/>
    <path d="M240 180c14 10 26 14 40 14s26-4 40-14v18c-14 10-26 14-40 14s-26-4-40-14v-18z" fill="#D6D3D1"/>
  </g>
  <text x="130" y="74" font-family="ui-sans-serif, system-ui" font-size="14" fill="#525252">On-body</text>
</svg>`;

const sampleProduct = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#FFF7ED"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="22" stdDeviation="18" flood-color="#000" flood-opacity="0.10"/>
    </filter>
  </defs>
  <rect width="1024" height="1024" rx="64" fill="url(#bg)"/>
  <g filter="url(#soft)">
    <rect x="180" y="210" width="664" height="604" rx="56" fill="#fff"/>
  </g>
  <g>
    <ellipse cx="520" cy="720" rx="260" ry="34" fill="#000" opacity="0.08"/>
    <path d="M330 640c110-140 260-190 420-90 60 38 90 56 120 100 18 28 10 56-18 74-36 24-120 54-250 54-164 0-270-32-320-62-34-20-50-34-84-52-28-16-18-34 0-64z" fill="#E5E7EB"/>
    <path d="M382 590c96-92 210-120 360-54 48 20 76 30 98 64 12 18 4 34-18 44-38 16-106 28-210 28-120 0-208-16-250-34-22-10-38-22-62-34-20-10-12-22 0-44z" fill="#D1D5DB"/>
    <circle cx="442" cy="600" r="10" fill="#9CA3AF"/>
    <circle cx="476" cy="612" r="10" fill="#9CA3AF"/>
    <circle cx="512" cy="622" r="10" fill="#9CA3AF"/>
  </g>
  <text x="220" y="190" font-family="ui-sans-serif, system-ui" font-size="26" fill="#525252">Demo product</text>
</svg>`;

export default router;

