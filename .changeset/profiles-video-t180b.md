---
"@stageflip/profiles-contract": minor
"@stageflip/profiles-video": minor
---

T-180 (follow-up): complete the video profile surface — clip-kind catalog +
tool-bundle allowlist + substantive SKILL.md.

- **`@stageflip/profiles-contract`** — `ProfileDescriptor` gains two
  required fields: `clipKinds: ReadonlySet<string>` and
  `toolBundles: ReadonlySet<string>`. Slide + display profiles will mirror
  the shape in follow-up tasks.
- **`@stageflip/profiles-video`**:
  - `VIDEO_CLIP_KINDS` — the six clip kinds T-183 ships (hook-moment,
    product-reveal, endslate-logo, lower-third, beat-synced-text,
    testimonial-card).
  - `VIDEO_TOOL_BUNDLES` — 11 engine handler bundles eligible for the
    Planner to load when working on a video document. Excludes
    slide-oriented bundles (`slide-cm1`, `table-cm1`,
    `domain-finance-sales-okr`). Kept stringly-typed so the package stays
    a leaf (no `@stageflip/engine` dependency).
  - `videoProfile` now exposes all five descriptor fields.
- **Skill** — `skills/stageflip/profiles/video/SKILL.md` promoted from
  placeholder to substantive; documents the descriptor shape, the lint
  rules, the clip catalog, and the bundle-allowlist rationale.
