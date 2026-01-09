# Functionary

Minimal Cloudflare Workers web app that:
- uploads a product/clothing photo to R2
- generates images in chosen scenes/models via pluggable providers
- stitches those images into a short video via pluggable providers

This is web-first (Hono JSX server-rendered). fal.ai providers are integrated.

## Quick Start

1) Install deps
```
npm i
```

2) Create an R2 bucket and bind it in `wrangler.toml` (`ASSETS`).

3) Dev server
```
npm run dev
```

4) Open http://127.0.0.1:8787

## Environment / Secrets

```
wrangler secret put FAL_KEY
wrangler secret put SESSION_SECRET
```

You can set defaults:
```
DEFAULT_VIDEO_PROVIDER=kling|veo3
```

## Notes

- Providers call fal.ai for images (`fal-ai/gpt-image-1.5/edit`) and video (`fal-ai/kling-video/v2.6/pro/image-to-video` or `fal-ai/veo3`).
- Error copy and design principles live in `AGENTS.md`.

## CSS (Tailwind)

`npm run dev` runs `npm run build:css` first to compile Tailwind into `src/app/compiledCss.ts`.

## Domain

Production domain is `functionary.dev` (see `wrangler.toml` routes and `env.production` vars).
