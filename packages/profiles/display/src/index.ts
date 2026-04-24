// packages/profiles/display/src/index.ts
// @stageflip/profiles-display — the StageFlip.Display profile descriptor plus
// the RIR-level lint rules, element-type allowlist, canonical IAB dimensions,
// clip catalog, engine tool-bundle allowlist, and IAB/GDN file-size budgets
// it contributes. T-200 scope.

import type { ProfileDescriptor } from '@stageflip/profiles-contract';
import type { ElementType } from '@stageflip/schema';

import {
  DISPLAY_CANONICAL_SIZES,
  DISPLAY_CLIP_KINDS,
  DISPLAY_FILE_SIZE_BUDGETS_KB,
  DISPLAY_TOOL_BUNDLES,
  type DisplayCanonicalSize,
  type DisplayFileSizeBudgetsKb,
} from './catalog.js';
import {
  DISPLAY_ALLOWED_ELEMENT_TYPES,
  DISPLAY_RULES,
  displayDimensionsRecognized,
  displayDurationWithinBudget,
  displayElementTypesAllowed,
  displayFrameRateWithinBudget,
  displayHasVisibleElement,
} from './rules.js';

export {
  DISPLAY_ALLOWED_ELEMENT_TYPES,
  DISPLAY_CANONICAL_SIZES,
  DISPLAY_CLIP_KINDS,
  DISPLAY_FILE_SIZE_BUDGETS_KB,
  DISPLAY_RULES,
  DISPLAY_TOOL_BUNDLES,
  displayDimensionsRecognized,
  displayDurationWithinBudget,
  displayElementTypesAllowed,
  displayFrameRateWithinBudget,
  displayHasVisibleElement,
};
export type { DisplayCanonicalSize, DisplayFileSizeBudgetsKb };

/**
 * The StageFlip.Display profile. Mode-aware consumers (validation,
 * editor-shell, tool-router, export-html5-zip) read this to gate on the
 * display surface without importing the individual rules, element lists,
 * canonical dimensions, clip kinds, or bundle names directly.
 */
export const displayProfile: ProfileDescriptor = {
  mode: 'display',
  allowedElementTypes: new Set<ElementType>(DISPLAY_ALLOWED_ELEMENT_TYPES),
  rules: DISPLAY_RULES,
  clipKinds: new Set<string>(DISPLAY_CLIP_KINDS),
  toolBundles: new Set<string>(DISPLAY_TOOL_BUNDLES),
};
