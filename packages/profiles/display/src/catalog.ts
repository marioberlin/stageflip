// packages/profiles/display/src/catalog.ts
// Declarative catalogs for the StageFlip.Display profile: the canonical IAB
// banner sizes, the clip `kind` strings expected in display mode, the engine
// tool-bundle names eligible for the Planner to load, and the IAB/GDN
// file-size budgets every produced banner is gated against. Implementations
// register elsewhere; these lists are the profile's declaration of intent.

/**
 * Canonical IAB banner dimension. `name` is the human-readable IAB label —
 * renderers, pickers, and exports can use it directly in UI without importing
 * `@stageflip/schema`.
 */
export interface DisplayCanonicalSize {
  readonly width: number;
  readonly height: number;
  readonly name: string;
}

/**
 * The three canonical IAB HTML5 banner dimensions StageFlip.Display targets
 * at Phase 9 exit. Source: IAB New Standard Ad Unit Portfolio (2017, still
 * current in 2026). Rich-media and expandable sizes ship later.
 *
 * - **300x250** Medium Rectangle (MPU) — the highest-inventory banner slot
 *   across the open web; also called "IAB Big Box".
 * - **728x90** Leaderboard — top-of-page horizontal banner.
 * - **160x600** Wide Skyscraper — vertical sidebar banner.
 */
export const DISPLAY_CANONICAL_SIZES: readonly DisplayCanonicalSize[] = [
  { width: 300, height: 250, name: 'Medium Rectangle' },
  { width: 728, height: 90, name: 'Leaderboard' },
  { width: 160, height: 600, name: 'Wide Skyscraper' },
] as const;

/**
 * Clip kinds expected in display mode. T-202 ships the concrete
 * implementations under `packages/runtimes/<kind>/src/clips/`. Consumers
 * (validation, auto-complete, Planner prompts) use this set to decide
 * whether a clip kind is recognised for the mode before the runtime
 * registry is even consulted.
 */
export const DISPLAY_CLIP_KINDS: readonly string[] = [
  'click-overlay',
  'countdown',
  'product-carousel',
  'price-reveal',
  'cta-pulse',
] as const;

/**
 * Engine tool-bundle names the Planner MAY load when working on a display
 * document. The Planner still budgets tools-per-context per I-9 (≤30
 * tools); this set is the upper bound of bundles it can consider.
 *
 * Excluded from the default display set:
 *
 * - `slide-cm1` — slide-only composition (banners are single-surface).
 * - `table-cm1` — table element is not in `DISPLAY_ALLOWED_ELEMENT_TYPES`.
 * - `domain-finance-sales-okr` — slide-deck domain templates (27 tools;
 *   would blow the I-9 budget alone).
 * - `video-mode` — multi-aspect bouncer is video-specific; banners are
 *   fixed canonical dimensions, not aspect ratios to bounce between.
 *
 * `display-mode` is reserved for T-206 (`optimize_for_file_size` +
 * `preview_at_sizes`); referencing it here before the engine registers
 * the bundle is the same pattern video's profile used for `video-mode`.
 *
 * String-typed to keep this package a leaf (no dependency on
 * `@stageflip/engine`). Drift between these names and the engine's
 * registered bundles is caught by the BundleLoader at runtime.
 */
export const DISPLAY_TOOL_BUNDLES: readonly string[] = [
  'read',
  'create-mutate',
  'timing',
  'layout',
  'validate',
  'clip-animation',
  'element-cm1',
  'qc-export-bulk',
  'semantic-layout',
  'data-source-bindings',
  'fact-check',
  // T-206 — mode-specific bundle; will ship `optimize_for_file_size` and
  // `preview_at_sizes`.
  'display-mode',
] as const;

/**
 * IAB/GDN file-size budgets for HTML5 display ads, expressed in kilobytes.
 *
 * Sources:
 * - IAB New Standard Ad Unit Portfolio (2017): 150 KB initial file load cap
 *   across all standard sizes.
 * - IAB HTML5 guidelines (polite / subload): additional data may be loaded
 *   after the initial render, up to a per-network cap (commonly 1 MB total).
 * - Google Display Network HTML5 specs: 150 KB max, matching IAB baseline.
 *
 * These constants are intentionally small + stable; the per-document
 * `DisplayContent.budget` (schema-level, see `@stageflip/schema`) carries
 * the *actual* enforcement value and may be tightened (e.g. 100 KB for
 * tighter networks) without changing this floor.
 */
export interface DisplayFileSizeBudgetsKb {
  /** IAB New Standard Ad Unit Portfolio initial file-load cap. */
  readonly iabInitialLoadKb: number;
  /** GDN HTML5 hard cap; matches IAB baseline. */
  readonly gdnInitialLoadKb: number;
  /** IAB polite / subload additional-data cap (total-session). */
  readonly iabPoliteLoadKb: number;
}

export const DISPLAY_FILE_SIZE_BUDGETS_KB: DisplayFileSizeBudgetsKb = {
  iabInitialLoadKb: 150,
  gdnInitialLoadKb: 150,
  iabPoliteLoadKb: 1024,
} as const;
