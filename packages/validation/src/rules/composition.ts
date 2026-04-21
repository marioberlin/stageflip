// packages/validation/src/rules/composition.ts
// Document-level rules: codec hygiene, fps standard, duration
// budget. Most are advisory (`info` or `warn`) — there's no hard
// correctness rule that a 23.97fps composition is invalid, just
// unusual.

import type { LintFinding, LintRule } from '../types.js';

const STANDARD_FPS = new Set([24, 25, 30, 48, 50, 60]);
const MAX_DURATION_FRAMES = 30 * 60; // 1 minute at 30fps — warn past this

export const compositionDimensionsEvenForVideo: LintRule = {
  id: 'composition-dimensions-even-for-video',
  severity: 'warn',
  description: 'video codecs (h264/h265) require even width + height — warn if odd',
  run(doc) {
    if (doc.mode !== 'video') return [];
    const out: LintFinding[] = [];
    if (doc.width % 2 !== 0) {
      out.push({
        rule: this.id,
        severity: 'warn',
        message: `composition width ${doc.width} is odd — most video codecs require even dimensions`,
      });
    }
    if (doc.height % 2 !== 0) {
      out.push({
        rule: this.id,
        severity: 'warn',
        message: `composition height ${doc.height} is odd — most video codecs require even dimensions`,
      });
    }
    return out;
  },
};

export const compositionFpsStandard: LintRule = {
  id: 'composition-fps-standard',
  severity: 'info',
  description: `composition fps should be one of ${Array.from(STANDARD_FPS).join(', ')} for best codec/player compatibility`,
  run(doc) {
    if (STANDARD_FPS.has(doc.frameRate)) return [];
    return [
      {
        rule: this.id,
        severity: 'info',
        message: `composition fps ${doc.frameRate} is non-standard — consider 24, 25, 30, 48, 50, or 60 for codec compatibility`,
      },
    ];
  },
};

export const compositionDurationReasonable: LintRule = {
  id: 'composition-duration-reasonable',
  severity: 'warn',
  description: 'composition duration > 30s (at 30fps) may indicate a missing timing override',
  run(doc) {
    if (doc.durationFrames <= MAX_DURATION_FRAMES) return [];
    const seconds = doc.durationFrames / doc.frameRate;
    return [
      {
        rule: this.id,
        severity: 'warn',
        message: `composition is ${doc.durationFrames} frames (${seconds.toFixed(1)}s) — >60s compositions usually want explicit operator opt-in`,
      },
    ];
  },
};

export const compositionFitsModeAspectHint: LintRule = {
  id: 'composition-fits-mode-aspect-hint',
  severity: 'info',
  description: 'display mode suggests wider canvases (≥2:1); slide/video expect 16:9-ish',
  run(doc) {
    const ratio = doc.width / doc.height;
    if (doc.mode === 'display' && ratio < 2) {
      return [
        {
          rule: this.id,
          severity: 'info',
          message: `display-mode composition has aspect ratio ${ratio.toFixed(2)} (< 2); display typically uses wide canvases`,
        },
      ];
    }
    return [];
  },
};

export const metaDigestPresent: LintRule = {
  id: 'meta-digest-present',
  severity: 'error',
  description:
    'meta.digest must be a non-empty stable hash (required by the parity harness for reproducibility)',
  run(doc) {
    if (!doc.meta.digest || doc.meta.digest.length === 0) {
      return [
        {
          rule: this.id,
          severity: 'error',
          message: 'meta.digest is empty',
        },
      ];
    }
    return [];
  },
};

export const COMPOSITION_RULES: readonly LintRule[] = [
  compositionDimensionsEvenForVideo,
  compositionFpsStandard,
  compositionDurationReasonable,
  compositionFitsModeAspectHint,
  metaDigestPresent,
] as const;
