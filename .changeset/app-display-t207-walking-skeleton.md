---
"@stageflip/app-display": minor
---

T-207: `apps/stageflip-display` — Next.js 15 walking skeleton. Mirrors
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
