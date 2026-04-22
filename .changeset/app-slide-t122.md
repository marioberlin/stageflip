---
"@stageflip/app-slide": minor
---

T-122: walking skeleton for `apps/stageflip-slide`.

- Next.js 15.5 App Router scaffold (tsconfig, next.config, layout,
  globals.css) on port 3100.
- Root page mounts `<EditorShell>` with a seeded "walking-skeleton"
  document (one empty slide) and renders a blank 1920×1080 SVG canvas
  inside a header/main/canvas layout.
- `/api/agent/execute` stubs the Phase 7 agent route: `POST` returns
  a structured 501 with `{ error: 'not_implemented', phase: 'phase-7' }`;
  `GET` returns 405. Gives component ports a stable URL to aim at.
- Playwright walking-skeleton spec (3 tests) plus app-local
  `playwright.config.ts` with a `next start` webServer on port 3100.
  Wired into root `pnpm e2e:slide` and a new CI step in `e2e` job.
- Drops `sharp` (Next's image-optimizer binary) via pnpm
  `ignoredOptionalDependencies` — its `@img/sharp-libvips-*`
  transitive is LGPL-3.0, not whitelisted. `next.config.mjs` sets
  `images: { unoptimized: true }` so Next doesn't try to require the
  missing binary at request time. No product loss; the walking
  skeleton ships no raster images.

Opens T-123..T-129 component ports: each now has a real shell to
render into and a real agent URL to call.
