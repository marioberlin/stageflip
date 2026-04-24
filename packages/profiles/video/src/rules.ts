// packages/profiles/video/src/rules.ts
// RIR-level lint rules contributed by the StageFlip.Video profile.
// Every rule gates on `doc.mode === 'video'` so composing the profile's
// rule set with a non-video document is a no-op.

import type { ElementType } from '@stageflip/schema';
import type { LintFinding, LintRule } from '@stageflip/validation';

/**
 * Element types permitted inside a `VideoContent` document. Chart, table,
 * and code elements are slide-oriented and excluded here — if a video needs
 * a chart it should be rendered into the visual track as an image or a
 * runtime-specific clip.
 */
export const VIDEO_ALLOWED_ELEMENT_TYPES: readonly ElementType[] = [
  'text',
  'image',
  'video',
  'audio',
  'shape',
  'group',
  'clip',
  'embed',
] as const;

const ALLOWED_SET: ReadonlySet<ElementType> = new Set(VIDEO_ALLOWED_ELEMENT_TYPES);

const AUDIO_ONLY_TYPES: ReadonlySet<ElementType> = new Set<ElementType>(['audio']);

/** Recognised output aspect ratios for StageFlip.Video. Mirrors schema. */
const RECOGNISED_RATIOS: ReadonlyArray<readonly [number, number]> = [
  [16, 9],
  [9, 16],
  [1, 1],
  [4, 5],
  [21, 9],
];
const RATIO_TOLERANCE = 0.01;

/** Warn past 10 minutes — above that the operator usually wants to opt in. */
const MAX_VIDEO_DURATION_SECONDS = 10 * 60;

export const videoElementTypesAllowed: LintRule = {
  id: 'video-element-types-allowed',
  severity: 'error',
  description: 'every element must be in VIDEO_ALLOWED_ELEMENT_TYPES when mode is video',
  run(doc) {
    if (doc.mode !== 'video') return [];
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (!ALLOWED_SET.has(el.type)) {
        out.push({
          rule: this.id,
          severity: 'error',
          message: `element type '${el.type}' is not allowed in video mode`,
          elementId: el.id,
        });
      }
    }
    return out;
  },
};

export const videoAspectRatioRecognized: LintRule = {
  id: 'video-aspect-ratio-recognized',
  severity: 'warn',
  description: 'video output aspect ratio should map to 16:9, 9:16, 1:1, 4:5, or 21:9',
  run(doc) {
    if (doc.mode !== 'video') return [];
    const ratio = doc.width / doc.height;
    for (const [w, h] of RECOGNISED_RATIOS) {
      if (Math.abs(ratio - w / h) <= RATIO_TOLERANCE) return [];
    }
    return [
      {
        rule: this.id,
        severity: 'warn',
        message: `composition ratio ${ratio.toFixed(2)} (${doc.width}x${doc.height}) is unrecognised — video bouncer targets 16:9, 9:16, 1:1, 4:5, 21:9`,
      },
    ];
  },
};

export const videoDurationWithinBudget: LintRule = {
  id: 'video-duration-within-budget',
  severity: 'warn',
  description: 'video duration > 10 minutes usually indicates a missing timing override',
  run(doc) {
    if (doc.mode !== 'video') return [];
    const seconds = doc.durationFrames / doc.frameRate;
    if (seconds <= MAX_VIDEO_DURATION_SECONDS) return [];
    return [
      {
        rule: this.id,
        severity: 'warn',
        message: `video composition is ${seconds.toFixed(1)}s — >${MAX_VIDEO_DURATION_SECONDS}s usually wants explicit operator opt-in`,
      },
    ];
  },
};

export const videoHasVisualElement: LintRule = {
  id: 'video-has-visual-element',
  severity: 'error',
  description: 'a video composition must contain at least one non-audio element',
  run(doc) {
    if (doc.mode !== 'video') return [];
    const hasVisual = doc.elements.some((el) => !AUDIO_ONLY_TYPES.has(el.type));
    if (hasVisual) return [];
    return [
      {
        rule: this.id,
        severity: 'error',
        message: 'video composition has no visual elements — audio-only renders are not supported',
      },
    ];
  },
};

/** The full set of rules this profile contributes to `@stageflip/validation`. */
export const VIDEO_RULES: readonly LintRule[] = [
  videoElementTypesAllowed,
  videoAspectRatioRecognized,
  videoDurationWithinBudget,
  videoHasVisualElement,
] as const;
