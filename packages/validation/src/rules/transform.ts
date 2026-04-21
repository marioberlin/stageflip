// packages/validation/src/rules/transform.ts
// Rules on element transform values that go beyond what Zod already
// enforces (positive width/height, opacity in [0,1], etc.).

import type { LintFinding, LintRule } from '../types.js';

const TINY_AREA_THRESHOLD = 4; // pixels² — below this, element is ~invisible

export const elementOverlapsCompositionBounds: LintRule = {
  id: 'element-overlaps-composition-bounds',
  severity: 'warn',
  description: 'element should at least partially overlap the composition viewport',
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      const t = el.transform;
      const right = t.x + t.width;
      const bottom = t.y + t.height;
      const offLeft = right <= 0;
      const offTop = bottom <= 0;
      const offRight = t.x >= doc.width;
      const offBottom = t.y >= doc.height;
      if ((offLeft || offTop || offRight || offBottom) && el.visible) {
        out.push({
          rule: this.id,
          severity: 'warn',
          message: `visible element '${el.id}' is entirely outside composition bounds (pos ${t.x},${t.y} size ${t.width}x${t.height} vs composition ${doc.width}x${doc.height})`,
          elementId: el.id,
        });
      }
    }
    return out;
  },
};

export const elementNotTinyWhenVisible: LintRule = {
  id: 'element-not-tiny-when-visible',
  severity: 'warn',
  description: 'visible element should have an area > 4px² (anything smaller is ~invisible)',
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      const area = el.transform.width * el.transform.height;
      if (el.visible && area < TINY_AREA_THRESHOLD) {
        out.push({
          rule: this.id,
          severity: 'warn',
          message: `visible element '${el.id}' has area ${area}px² (< ${TINY_AREA_THRESHOLD}px²)`,
          elementId: el.id,
        });
      }
    }
    return out;
  },
};

export const elementOpacityNonZeroWhenVisible: LintRule = {
  id: 'element-opacity-non-zero-when-visible',
  severity: 'warn',
  description:
    'visible element should have non-zero opacity (contradiction: visible but transparent)',
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (el.visible && el.transform.opacity === 0) {
        out.push({
          rule: this.id,
          severity: 'warn',
          message: `element '${el.id}' is marked visible but has opacity 0 — contradiction`,
          elementId: el.id,
        });
      }
    }
    return out;
  },
};

export const elementRotationWithinReasonableRange: LintRule = {
  id: 'element-rotation-within-reasonable-range',
  severity: 'info',
  description: 'element rotation outside ±720° is usually accidental — consider normalising',
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (Math.abs(el.transform.rotation) > 720) {
        out.push({
          rule: this.id,
          severity: 'info',
          message: `element '${el.id}' rotation is ${el.transform.rotation}° — consider normalising to [-360, 360]`,
          elementId: el.id,
        });
      }
    }
    return out;
  },
};

export const TRANSFORM_RULES: readonly LintRule[] = [
  elementOverlapsCompositionBounds,
  elementNotTinyWhenVisible,
  elementOpacityNonZeroWhenVisible,
  elementRotationWithinReasonableRange,
] as const;
