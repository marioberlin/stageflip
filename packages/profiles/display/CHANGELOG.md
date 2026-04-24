# @stageflip/profiles-display

## 0.1.0

### Minor Changes

- f9f48d4: T-200: `@stageflip/profiles-display` foundation — element-type allowlist,
  canonical IAB dimensions, RIR-level lint rules, clip catalog, engine
  tool-bundle allowlist, IAB/GDN file-size budgets, and the `displayProfile`
  descriptor.

  - **Element-type allowlist**: `text`, `image`, `shape`, `group`, `clip`.
    Excludes `video`, `audio`, `chart`, `table`, `code`, `embed` (GDN /
    IAB banner constraints).
  - **Canonical IAB sizes** (`DISPLAY_CANONICAL_SIZES`): 300×250 Medium
    Rectangle, 728×90 Leaderboard, 160×600 Wide Skyscraper. Source: IAB
    New Standard Ad Unit Portfolio (2017).
  - **File-size budgets** (`DISPLAY_FILE_SIZE_BUDGETS_KB`): 150 KB IAB /
    GDN initial-load cap, 1024 KB IAB polite / subload cap.
  - **Clip catalog** (`DISPLAY_CLIP_KINDS`): `click-overlay`, `countdown`,
    `product-carousel`, `price-reveal`, `cta-pulse` (implementations land
    in T-202).
  - **Tool-bundle allowlist** (`DISPLAY_TOOL_BUNDLES`): 12 bundles; reserves
    `display-mode` for T-206. Excludes `slide-cm1`, `table-cm1`,
    `domain-finance-sales-okr`, `video-mode`.
  - **Five lint rules** composed with `@stageflip/validation`'s `ALL_RULES`:
    - `display-element-types-allowed` — error when an element type is
      outside the allowlist.
    - `display-dimensions-recognized` — warn when the composition size is
      not one of the canonical IAB sizes.
    - `display-duration-within-budget` — error when duration > 30s (GDN
      hard cap).
    - `display-frame-rate-within-budget` — warn when frame rate > 24 fps.
    - `display-has-visible-element` — error when no element has
      `visible=true`.
  - Every rule gates on `doc.mode === 'display'`; composing `DISPLAY_RULES`
    with a non-display document is a no-op.

  Click-tag + fallback enforcement live at schema / export-time (T-203,
  T-208), not in this RIR-level rule set, since those fields are consumed
  upstream of RIR compilation.

### Patch Changes

- Updated dependencies [aedcaca]
- Updated dependencies [63bfef6]
- Updated dependencies [36d0c5d]
- Updated dependencies [3f7e54c]
- Updated dependencies [9ea2199]
  - @stageflip/profiles-contract@0.1.0
  - @stageflip/schema@0.1.0
  - @stageflip/validation@0.1.0
