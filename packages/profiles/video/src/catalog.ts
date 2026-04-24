// packages/profiles/video/src/catalog.ts
// Declarative catalogs for the StageFlip.Video profile: the clip `kind`
// strings expected in video mode and the engine tool-bundle names eligible
// for the Planner to load. Implementations register elsewhere; these lists
// are the profile's declaration of intent.

/**
 * Clip kinds expected in video mode. T-183 ships the concrete
 * implementations under `packages/runtimes/<kind>/src/clips/`. Consumers
 * (validation, auto-complete, Planner prompts) use this set to decide
 * whether a clip kind is recognised for the mode before the runtime
 * registry is even consulted.
 */
export const VIDEO_CLIP_KINDS: readonly string[] = [
  'hook-moment',
  'product-reveal',
  'endslate-logo',
  'lower-third',
  'beat-synced-text',
  'testimonial-card',
] as const;

/**
 * Engine tool-bundle names the Planner MAY load when working on a video
 * document. The Planner still budgets tools-per-context per I-9 (≤30
 * tools); this set is the upper bound of bundles it can consider.
 *
 * Excluded from the default video set:
 *
 * - `slide-cm1` — slide-only composition (no slides in video mode).
 * - `table-cm1` — table element is not in VIDEO_ALLOWED_ELEMENT_TYPES.
 * - `domain-finance-sales-okr` — slide-deck domain templates (27 tools;
 *   would blow the I-9 budget alone).
 *
 * String-typed to keep this package a leaf (no dependency on
 * `@stageflip/engine`). Drift between these names and the engine's
 * registered bundles is caught by the BundleLoader at runtime.
 */
export const VIDEO_TOOL_BUNDLES: readonly string[] = [
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
] as const;
