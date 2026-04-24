// packages/profiles/contract/src/index.ts
// Shared profile contract — every StageFlip mode (slide / video / display)
// publishes a `ProfileDescriptor` so mode-aware consumers (validation,
// editor-shell, tool-router) can gate on a single typed object.

import type { ElementType, Mode } from '@stageflip/schema';
import type { LintRule } from '@stageflip/validation';

/**
 * A profile aggregates everything mode-specific a consumer needs to know:
 *
 * - `mode` — the content-discriminator literal.
 * - `allowedElementTypes` — the subset of element types valid in this mode.
 * - `rules` — RIR-level lint rules this profile contributes.
 * - `clipKinds` — clip `kind` strings expected in this mode. Implementations
 *   are registered separately under `packages/runtimes/<kind>/src/clips/`;
 *   this set is the profile's declaration of what to expect at validate time.
 * - `toolBundles` — engine tool-bundle names eligible for the Planner to load
 *   when working on a document in this mode. The Planner still budgets
 *   tools-per-context per I-9 (≤30); this set is the *upper bound* of what
 *   it may consider.
 *
 * All fields are required. Unused surfaces should declare empty sets so the
 * type stays ergonomic across consumers.
 */
export interface ProfileDescriptor {
  readonly mode: Mode;
  readonly allowedElementTypes: ReadonlySet<ElementType>;
  readonly rules: readonly LintRule[];
  readonly clipKinds: ReadonlySet<string>;
  readonly toolBundles: ReadonlySet<string>;
}

export type { ElementType, Mode };
