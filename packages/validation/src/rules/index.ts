// packages/validation/src/rules/index.ts
// Single source of truth for every rule that ships in
// @stageflip/validation. Subpackages group by concern; this file
// flattens them into `ALL_RULES`. Callers tune the rule set by
// passing a custom subset to `lintDocument`.

import type { LintRule } from '../types.js';

import { CLIP_RULES } from './clips.js';
import { COMPOSITION_RULES } from './composition.js';
import { CONTENT_RULES } from './content.js';
import { FONT_RULES } from './fonts.js';
import { STACKING_RULES } from './stacking.js';
import { TIMING_RULES } from './timing.js';
import { TRANSFORM_RULES } from './transform.js';

export { CLIP_RULES } from './clips.js';
export { COMPOSITION_RULES } from './composition.js';
export { CONTENT_RULES } from './content.js';
export { FONT_RULES } from './fonts.js';
export { STACKING_RULES } from './stacking.js';
export { TIMING_RULES } from './timing.js';
export { TRANSFORM_RULES } from './transform.js';

export const ALL_RULES: readonly LintRule[] = [
  ...TIMING_RULES,
  ...TRANSFORM_RULES,
  ...CONTENT_RULES,
  ...COMPOSITION_RULES,
  ...FONT_RULES,
  ...STACKING_RULES,
  ...CLIP_RULES,
];
