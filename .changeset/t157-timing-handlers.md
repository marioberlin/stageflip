---
'@stageflip/engine': minor
---

T-157 — Third handler bundle shipped: `timing` (4 tools). Per-slide
duration + transition controls. Slide-mode only.

- `set_slide_duration(slideId, durationMs)` — writes `slide.durationMs`.
  Emits `add` when absent, `replace` otherwise.
- `clear_slide_duration(slideId)` — removes the field. Idempotent:
  returns `wasSet: false` with no patch when already absent.
- `set_slide_transition(slideId, kind, durationMs?)` — writes
  `slide.transition`. `kind` ∈ `none` / `fade` / `slide-left` /
  `slide-right` / `zoom` / `push`; `durationMs` defaults to 400 (schema
  default).
- `clear_slide_transition(slideId)` — same `wasSet` idempotency.

Every output is a discriminated union on `ok`; failures are
`wrong_mode` / `not_found`.

`registerTimingBundle(registry, router)` one-call population; drift-gate
test asserts router↔registry name-set parity.

19 new engine tests (13 handlers + 6 register); 101 total. Skill
`tools/timing/SKILL.md` flipped to substantive.
