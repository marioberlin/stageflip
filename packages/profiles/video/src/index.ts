// packages/profiles/video/src/index.ts
// @stageflip/profiles-video — the StageFlip.Video profile descriptor plus
// the RIR-level lint rules and element-type allowlist it contributes. T-180
// scope ships the profile-package contract + validation rule set; clip
// catalog and tool-bundle allowlist land in a follow-up.

import type { ProfileDescriptor } from '@stageflip/profiles-contract';
import type { ElementType } from '@stageflip/schema';

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
  VIDEO_RULES,
  videoAspectRatioRecognized,
  videoDurationWithinBudget,
  videoElementTypesAllowed,
  videoHasVisualElement,
};

/**
 * The StageFlip.Video profile. Mode-aware consumers (validation, editor-shell,
 * tool-router) read this to gate on the video surface without importing the
 * individual rules or element lists directly.
 */
export const videoProfile: ProfileDescriptor = {
  mode: 'video',
  allowedElementTypes: new Set<ElementType>(VIDEO_ALLOWED_ELEMENT_TYPES),
  rules: VIDEO_RULES,
};
