---
'@stageflip/engine': minor
---

T-168 — Fourteenth (final) handler bundle shipped: `semantic-layout`
(4 tools). Reshape existing slide elements into conventional layouts.

- `apply_title_body_layout` — title at top (default 160 px), body
  fills remaining vertical space.
- `apply_two_column_layout` — equal-width columns with per-column
  vertical distribution; `topY` default 240, `gap` default 24.
- `apply_kpi_strip_layout` — 1–6 elements in a horizontal equal-width
  strip.
- `apply_centered_hero_layout` — center one element as a hero;
  `widthRatio`/`heightRatio` default 0.75/0.5.

Scope boundary: `layout` (T-158) owns low-level alignment/distribution
primitives; `domain-finance-sales-okr` (T-166) CREATES pre-composed
slides; this bundle only reshapes transforms on elements the caller
already placed. Handlers emit only `transform` replace ops — never
touch `type`, content, or animations.

12 new engine tests (6 handlers + 6 register); 340 total. All 9 gates
green. Skill flipped to substantive.

**All 14 handler bundles now populated.** Phase 7 tool-surface
complete: 5 + 8 + 4 + 5 + 4 + 14 + 12 + 6 + 6 + 9 + 2 + 27 + 2 + 4 =
108 tools across 14 bundles (target was ≥80). T-169 auto-gen +
T-170 copilot wiring remain.
