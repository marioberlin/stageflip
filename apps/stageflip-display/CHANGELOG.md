# @stageflip/app-display

## 0.1.0

### Minor Changes

- c603329: T-207: `apps/stageflip-display` — Next.js 15 walking skeleton. Mirrors
  the slide + video walking skeletons but targets IAB/GDN display
  banners.

  - **Port 3300** — next dev / start.
  - Mounts `<EditorShell>` with a seeded display document: the three
    canonical IAB sizes from `DISPLAY_CANONICAL_SIZES` (T-200), a 15s
    duration, and the IAB 150 KB baseline budget from
    `DISPLAY_FILE_SIZE_BUDGETS_KB`.
  - Renders `<BannerSizeGrid>` (T-201) with all three cells at once so
    operators see the multi-size layout on open.
  - Budget header surfaces `{sizes} size · {durationMs}s · budget
{totalZipKb} KB · assets {inlined|external}`.
  - Mode badge reports `mode: display`.

  `/api/agent/execute` mirrors the slide + video routes: Zod-validated
  strict body, 200/400/503/500 error mapping, 503 `not_configured` when
  `ANTHROPIC_API_KEY` is absent. Uses the same `runAgent` from
  `@stageflip/app-agent` (which now includes the T-206 `display-mode`
  bundle alongside video-mode + every mode-agnostic bundle).

  Style matches the video app: dark palette + Plus Jakarta Sans.
  `next.config.mjs` transpiles the four workspace packages and disables
  Next's sharp-backed image optimizer (LGPL-3.0 posture unchanged).

  10 new tests (6 UI smoke + 4 route contract). No new runtime deps —
  everything is workspace-linked.

### Patch Changes

- Updated dependencies [3711af9]
- Updated dependencies [6019f5f]
- Updated dependencies [e0054c4]
- Updated dependencies [05f5aa9]
- Updated dependencies [d49e5dd]
- Updated dependencies [d062bc1]
- Updated dependencies [ce146db]
- Updated dependencies [d13c772]
- Updated dependencies [c126eba]
- Updated dependencies [753b22a]
- Updated dependencies [a518ed6]
- Updated dependencies [5548212]
- Updated dependencies [cd2fba6]
- Updated dependencies [6c44323]
- Updated dependencies [a146bd2]
- Updated dependencies [62db960]
- Updated dependencies [c0eed61]
- Updated dependencies [7ddf9ad]
- Updated dependencies [919af67]
- Updated dependencies [f9f48d4]
- Updated dependencies [d017704]
- Updated dependencies [85d632a]
- Updated dependencies [0df802a]
- Updated dependencies [36d0c5d]
  - @stageflip/app-agent@0.1.0
  - @stageflip/editor-shell@0.1.0
  - @stageflip/profiles-display@0.1.0
  - @stageflip/schema@0.1.0
