# @stageflip/profiles-contract

## 0.1.0

### Minor Changes

- aedcaca: T-180 (partial): `@stageflip/profiles-video` foundation — element-type
  allowlist, RIR-level lint rules, and the `videoProfile` descriptor, plus the
  shared `ProfileDescriptor` contract that mode-aware consumers read.
  - **`@stageflip/profiles-contract`** — new `ProfileDescriptor` interface
    (`mode`, `allowedElementTypes: ReadonlySet<ElementType>`, `rules:
readonly LintRule[]`). Same shape will back the slide + display profiles
    in follow-up tasks.
  - **`@stageflip/profiles-video`** — publishes `VIDEO_ALLOWED_ELEMENT_TYPES`
    (text/image/video/audio/shape/group/clip/embed — chart/table/code
    excluded) and four rules composed with `@stageflip/validation`'s
    `ALL_RULES`:
    - `video-element-types-allowed` — error when an element type is outside
      the allowlist.
    - `video-aspect-ratio-recognized` — warn when output aspect is not one
      of 16:9 / 9:16 / 1:1 / 4:5 / 21:9 (within 0.01 tolerance).
    - `video-duration-within-budget` — warn past 10 minutes.
    - `video-has-visual-element` — error when the only elements are audio.
  - Every rule gates on `doc.mode === 'video'`; composing `VIDEO_RULES` with
    a non-video document is a no-op.

  Scope note: T-180's clip catalog and tool-bundle allowlist ship in a
  follow-up PR. Slide + display profile-package migrations come later in
  Phase 8 / Phase 9 respectively.

- 63bfef6: T-180 (follow-up): complete the video profile surface — clip-kind catalog +
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

### Patch Changes

- Updated dependencies [2f0ae52]
- Updated dependencies [6cfbb4c]
- Updated dependencies [6474d98]
- Updated dependencies [a36fcbe]
- Updated dependencies [8ddef40]
- Updated dependencies [e054d6d]
- Updated dependencies [4fe6fda]
- Updated dependencies [12a98d3]
- Updated dependencies [ca945df]
- Updated dependencies [5af6789]
- Updated dependencies [22d44d6]
- Updated dependencies [b6d2229]
- Updated dependencies [a4bb803]
- Updated dependencies [bbcbd38]
- Updated dependencies [d393eff]
- Updated dependencies [3112c98]
- Updated dependencies [e422e50]
- Updated dependencies [7c0165c]
- Updated dependencies [732f6c7]
- Updated dependencies [36d0c5d]
- Updated dependencies [3f7e54c]
- Updated dependencies [9ea2199]
- Updated dependencies [38e4017]
  - @stageflip/schema@0.1.0
  - @stageflip/validation@0.1.0
