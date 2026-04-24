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
 *   Element types outside the set are rejected by the profile's
 *   `elementTypesAllowed` rule.
 * - `rules` — RIR-level lint rules this profile contributes. Callers compose
 *   them with `@stageflip/validation`'s `ALL_RULES` when invoking
 *   `lintDocument`.
 *
 * The shape is deliberately small: clip catalogs and tool-bundle allowlists
 * land in follow-up tasks and will attach additional optional fields.
 */
export interface ProfileDescriptor {
  readonly mode: Mode;
  readonly allowedElementTypes: ReadonlySet<ElementType>;
  readonly rules: readonly LintRule[];
}

export type { ElementType, Mode };
