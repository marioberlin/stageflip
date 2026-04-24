// packages/profiles/display/src/rules.ts
// RIR-level lint rules contributed by the StageFlip.Display profile.
// Every rule gates on `doc.mode === 'display'` so composing the profile's
// rule set with a non-display document is a no-op.

import type { ElementType } from '@stageflip/schema';
import type { LintFinding, LintRule } from '@stageflip/validation';

import { DISPLAY_CANONICAL_SIZES } from './catalog.js';

/**
 * Element types permitted inside a `DisplayContent` document. Banners are
 * animated, visual, single-surface; audio + video are out of scope for the
 * MVP (GDN bans audio-by-default; full video inside a 150 KB cap is
 * impractical). Chart/table/code are slide-oriented authoring types. Embed
 * is blocked by IAB/GDN CSP at serve time, so it's excluded here too.
 */
export const DISPLAY_ALLOWED_ELEMENT_TYPES: readonly ElementType[] = [
  'text',
  'image',
  'shape',
  'group',
  'clip',
] as const;

const ALLOWED_SET: ReadonlySet<ElementType> = new Set(DISPLAY_ALLOWED_ELEMENT_TYPES);

/** Canonical dimensions as "WxH" keys for O(1) match. */
const CANONICAL_DIM_KEYS: ReadonlySet<string> = new Set(
  DISPLAY_CANONICAL_SIZES.map((s) => `${s.width}x${s.height}`),
);

/**
 * GDN hard cap on animation duration for HTML5 display ads. Exceeding this
 * is a definite reject at serve time, so the rule is severity `error`.
 */
const MAX_DISPLAY_DURATION_SECONDS = 30;

/**
 * GDN recommended cap on animation frame rate. 24 fps keeps battery + CPU
 * in-budget on mobile viewers and is the default for IAB compliance tools.
 * Above this is a soft warn, not an error.
 */
const MAX_DISPLAY_FRAME_RATE = 24;

export const displayElementTypesAllowed: LintRule = {
  id: 'display-element-types-allowed',
  severity: 'error',
  description: 'every element must be in DISPLAY_ALLOWED_ELEMENT_TYPES when mode is display',
  run(doc) {
    if (doc.mode !== 'display') return [];
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (!ALLOWED_SET.has(el.type)) {
        out.push({
          rule: this.id,
          severity: 'error',
          message: `element type '${el.type}' is not allowed in display mode`,
          elementId: el.id,
        });
      }
    }
    return out;
  },
};

export const displayDimensionsRecognized: LintRule = {
  id: 'display-dimensions-recognized',
  severity: 'warn',
  description: 'display composition size should be one of the canonical IAB banner dimensions',
  run(doc) {
    if (doc.mode !== 'display') return [];
    const key = `${doc.width}x${doc.height}`;
    if (CANONICAL_DIM_KEYS.has(key)) return [];
    const canon = [...CANONICAL_DIM_KEYS].join(', ');
    return [
      {
        rule: this.id,
        severity: 'warn',
        message: `composition size ${key} is not a canonical IAB size — canonical sizes are ${canon}`,
      },
    ];
  },
};

export const displayDurationWithinBudget: LintRule = {
  id: 'display-duration-within-budget',
  severity: 'error',
  description: 'display animation must not exceed GDN / IAB hard cap of 30 seconds',
  run(doc) {
    if (doc.mode !== 'display') return [];
    const seconds = doc.durationFrames / doc.frameRate;
    if (seconds <= MAX_DISPLAY_DURATION_SECONDS) return [];
    return [
      {
        rule: this.id,
        severity: 'error',
        message: `display composition is ${seconds.toFixed(1)}s — >${MAX_DISPLAY_DURATION_SECONDS}s will be rejected by GDN / IAB validators`,
      },
    ];
  },
};

export const displayFrameRateWithinBudget: LintRule = {
  id: 'display-frame-rate-within-budget',
  severity: 'warn',
  description:
    'display frame rate should stay within the 24 fps recommendation for battery + CPU budgets',
  run(doc) {
    if (doc.mode !== 'display') return [];
    if (doc.frameRate <= MAX_DISPLAY_FRAME_RATE) return [];
    return [
      {
        rule: this.id,
        severity: 'warn',
        message: `display composition runs at ${doc.frameRate} fps — IAB / GDN recommend ≤${MAX_DISPLAY_FRAME_RATE} fps`,
      },
    ];
  },
};

export const displayHasVisibleElement: LintRule = {
  id: 'display-has-visible-element',
  severity: 'error',
  description: 'a display composition must contain at least one visible element',
  run(doc) {
    if (doc.mode !== 'display') return [];
    const hasVisible = doc.elements.some((el) => el.visible);
    if (hasVisible) return [];
    return [
      {
        rule: this.id,
        severity: 'error',
        message:
          'display composition has no visible elements — empty banner renders are not supported',
      },
    ];
  },
};

/** The full set of rules this profile contributes to `@stageflip/validation`. */
export const DISPLAY_RULES: readonly LintRule[] = [
  displayElementTypesAllowed,
  displayDimensionsRecognized,
  displayDurationWithinBudget,
  displayFrameRateWithinBudget,
  displayHasVisibleElement,
] as const;
