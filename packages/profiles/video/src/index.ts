// packages/profiles/video/src/index.ts
// @stageflip/profiles-video — the StageFlip.Video profile descriptor plus
// the RIR-level lint rules, element-type allowlist, clip catalog, and
// engine tool-bundle allowlist it contributes. T-180 scope.

import type { ProfileDescriptor } from '@stageflip/profiles-contract';
import type { ElementType } from '@stageflip/schema';

import { VIDEO_CLIP_KINDS, VIDEO_TOOL_BUNDLES } from './catalog.js';
import {
  VIDEO_ALLOWED_ELEMENT_TYPES,
  VIDEO_RULES,
  videoAspectRatioRecognized,
  videoDurationWithinBudget,
  videoElementTypesAllowed,
  videoHasVisualElement,
} from './rules.js';

export {
  VIDEO_ALLOWED_ELEMENT_TYPES,
  VIDEO_CLIP_KINDS,
  VIDEO_RULES,
  VIDEO_TOOL_BUNDLES,
  videoAspectRatioRecognized,
  videoDurationWithinBudget,
  videoElementTypesAllowed,
  videoHasVisualElement,
};

/**
 * The StageFlip.Video profile. Mode-aware consumers (validation,
 * editor-shell, tool-router) read this to gate on the video surface
 * without importing the individual rules, element lists, clip kinds, or
 * bundle names directly.
 */
export const videoProfile: ProfileDescriptor = {
  mode: 'video',
  allowedElementTypes: new Set<ElementType>(VIDEO_ALLOWED_ELEMENT_TYPES),
  rules: VIDEO_RULES,
  clipKinds: new Set<string>(VIDEO_CLIP_KINDS),
  toolBundles: new Set<string>(VIDEO_TOOL_BUNDLES),
};
