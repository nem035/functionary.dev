# Functionary – Agent Guidelines

## What Is This?

An elegant, minimal web app that turns product or clothing photos into marketing-ready visuals and short videos. Users upload an item, pick a scene/model, generate images and then render a short video.

## Tech Stack

- Runtime: Cloudflare Workers + Hono (TypeScript)
- Storage: Cloudflare R2 (asset bucket for uploads, generated images, videos)
- UI: Server-rendered Hono JSX (no React runtime), progressive enhancement with small inline JS
- AI Providers: fal.ai client for images and video
  - Images: `fal-ai/gpt-image-1.5/edit` (edit/compose with uploaded item image)
  - Video: `fal-ai/kling-video/v2.6/pro/image-to-video` (image-to-video) and/or `fal-ai/veo3`

## Project Structure

```
src/
├─ index.ts                 # App bootstrap, middleware, route mounting
├─ types.ts                 # Env bindings and request context types
├─ lib/
│  ├─ middleware.ts         # requestId + logger context
│  ├─ logger.ts             # tiny per-request logger
│  ├─ errors.ts             # user-facing error helpers
│  └─ providers/
│     ├─ image.ts           # image provider interface + stubs
│     └─ video.ts           # video provider interface + stubs
└─ routes/
   ├─ ui.tsx                # server-rendered UI
   └─ api.ts                # upload, generate-images, generate-video
```

## Commands

```
npm run dev       # wrangler dev
npm run deploy    # wrangler deploy
npx tsc --noEmit  # type check
npx wrangler tail # live logs
```

## Cloudflare Bindings

- R2 bucket: `ASSETS` (uploads/, generated/, videos/)
- Secrets (set via `wrangler secret put`):
  - `FAL_KEY` (preferred) or `FAL_API_KEY`
  - Optional defaults: `DEFAULT_VIDEO_PROVIDER` (`kling`|`veo3`)
  - `SESSION_SECRET` (required for magic link sessions)
  - Optional (magic link email): `RESEND_API_KEY`, `RESEND_FROM`

---

## Development Mindset (adapted from lound.ai)

> Fresh eyes focused on pristine UX with KISS and YAGNI.

- UX first: every change should make it simpler, clearer, or faster.
- KISS: prefer the simplest approach that works today.
- YAGNI: no speculative features/abstractions.
- Fresh eyes review: re-read code and UI; remove redundancy and friction.

Red flags:
- Over-engineered abstractions used once
- Duplicated copy or logic spread inconsistently
- Magic numbers; untyped, implicit behavior

## Coding Conventions (TypeScript, Workers)

- TypeScript everywhere; `camelCase` vars; env constants in `UPPER_SNAKE_CASE`.
- Functions > classes; keep modules small and file-scoped.
- No non-null `!` and no `as never/unknown`; use proper types/guards.
- Push side effects to edges: pure helpers for transforms; thin route handlers orchestrate I/O.
- Prefer duplication over premature abstraction; abstract only when patterns are clear (3+ use sites).
- Single Source of Truth: centralize config and shared utilities.
- No `console.log` in app logic—use `req.log` (provided by middleware) for structured logs.

## Backend Conventions (Hono on Workers)

- Add `requestId` and `req.log` via middleware; include context on errors.
- Use structured JSON logs (`level`, `requestId`, `msg`, and relevant fields).
- Return user-friendly errors; never leak provider internals.
- Keep provider calls behind clear interfaces (`image.ts`, `video.ts`).
- R2 object keys are deterministic: `uploads/`, `generated/`, `videos/` with UUID filenames.

## Web UI Principles (reformulated from lound.ai client)

Design goals: gorgeous, minimal, calm. No generic “AI app” gloss.

- Typography: pick one expressive display face + one neutral body face (web-safe fallback stack). Use CSS variables for sizes/weights and a tight scale. Avoid overused “AI fonts” and default system blandness in display roles.
- Color & theme: commit to a strong, cohesive palette (one dominant, one accent). Centralize in CSS variables; avoid one-off inline colors.
- Backgrounds: subtle grain/gradient meshes used sparingly; maintain high contrast and breathing room.
- Spatial composition: asymmetric balance and confident negative space; align content blocks to a strong rhythm.
- Motion: minimal and purposeful. Prefer CSS `transition`/`keyframes`; honor `prefers-reduced-motion`. One delightful moment beats many micro-animations.
- States: never show stale UI that snaps to updated—either keep cached and don’t refresh or show a skeleton/loader until fresh data arrives.

Avoid
- Purple-on-white gradient clichés, glassmorphism clones, generic SaaS card stacks.
- Over-ornamentation that competes with the product imagery.

## Error Copy (user-facing)

- Titles: “Couldn’t Load”, “Couldn’t Save”, “Couldn’t Delete”, “AI Unavailable”, “Permission Needed”, “Sign In Needed”, “Slow Down”, “Something Went Wrong”.
- Tone: brief, apologetic, actionable. Never blame the user.

## Providers & Pipelines

Image generation (fal.ai)
- Model: `fal-ai/gpt-image-1.5/edit`
- Inputs: uploaded item image (uploaded to fal storage), prompt (scene/model/placement)
- Output: 1–4 images saved as `generated/*` in R2

Video generation (fal.ai)
- Models: `fal-ai/kling-video/v2.6/pro/image-to-video` (uses first frame as `start_image_url`), or `fal-ai/veo3` (prompt-driven)
- Inputs: 1–8 images (ordered) and optional prompt
- Output: MP4/WEBM saved under `videos/*` in R2

Implementation rules
- Do not leak fal response shapes; normalize to `{ key, bytes, contentType }` for videos and similar for images.
- Timeouts/retries and error mapping belong in provider modules, not routes.
- Keep orchestration thin in routes: validate input, call provider, store result, return normalized payload.

## Migration & Data

- Start R2-only (stateless). Add DB later only if absolutely necessary.
- Keep object metadata small and useful (original filename, mime, bytes, checksum).
