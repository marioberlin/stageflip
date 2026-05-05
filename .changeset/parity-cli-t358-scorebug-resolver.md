---
'@stageflip/parity-cli': patch
---

T-358 — wire `scoreBug → outcome-row` in `DEFAULT_CLIP_KIND_RESOLVER`.

Adds the second clipKind binding to the v1 parity-fixture renderer
(`bigNumber → animated-value` was the first, T-359a). The new
`scoreBugDotsBinding` mounts the T-358a `outcome-row` primitive with
the canonical six-ball cricket over `[1, '.', 4, 6, W, 2]`, exposing
all six outcome palette colors (white, gray, green, gold, red, cyan)
in a single mid-hold frame. Also exports `CRICKET_OUTCOME_COLORS`
for downstream consumers that want the canon mapping.

Single-variant per T-358 D-T358-3; the `buildProps` shim ignores the
variant axis. Used by `scripts/generate-preset-parity-fixture-prod.ts`
to render the `cricket-ball-by-ball-dots` golden frame.
