---
"@stageflip/profiles-contract": minor
"@stageflip/profiles-video": minor
---

T-180 (partial): `@stageflip/profiles-video` foundation — element-type
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
