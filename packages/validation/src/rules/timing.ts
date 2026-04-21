// packages/validation/src/rules/timing.ts
// Rules that check timing windows, element IDs, animation IDs.
// These live beyond what Zod already enforces at schema parse time
// (e.g. the compiler-level invariant that every element's timing
// fits inside the composition's duration is NOT schema-expressible).

import type { LintFinding, LintRule } from '../types.js';

export const elementTimingWithinComposition: LintRule = {
  id: 'element-timing-within-composition',
  severity: 'error',
  description: 'every element.timing window must fit inside [0, document.durationFrames)',
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (el.timing.startFrame < 0) {
        out.push({
          rule: this.id,
          severity: 'error',
          message: `element '${el.id}' starts at frame ${el.timing.startFrame} (before 0)`,
          elementId: el.id,
          path: `elements[${el.id}].timing.startFrame`,
        });
      }
      if (el.timing.endFrame > doc.durationFrames) {
        out.push({
          rule: this.id,
          severity: 'error',
          message: `element '${el.id}' ends at frame ${el.timing.endFrame}, beyond composition duration ${doc.durationFrames}`,
          elementId: el.id,
          path: `elements[${el.id}].timing.endFrame`,
        });
      }
    }
    return out;
  },
};

export const animationTimingWithinElement: LintRule = {
  id: 'animation-timing-within-element',
  severity: 'error',
  description: 'every animation.timing window must fit inside its parent element.timing',
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      for (const anim of el.animations) {
        if (anim.timing.startFrame < el.timing.startFrame) {
          out.push({
            rule: this.id,
            severity: 'error',
            message: `animation '${anim.id}' on element '${el.id}' starts at ${anim.timing.startFrame}, before element start ${el.timing.startFrame}`,
            elementId: el.id,
          });
        }
        if (anim.timing.endFrame > el.timing.endFrame) {
          out.push({
            rule: this.id,
            severity: 'error',
            message: `animation '${anim.id}' on element '${el.id}' ends at ${anim.timing.endFrame}, after element end ${el.timing.endFrame}`,
            elementId: el.id,
          });
        }
      }
    }
    return out;
  },
};

export const animationIdsUniqueWithinElement: LintRule = {
  id: 'animation-ids-unique-within-element',
  severity: 'error',
  description: 'animations within a single element must have unique ids',
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      const seen = new Set<string>();
      for (const anim of el.animations) {
        if (seen.has(anim.id)) {
          out.push({
            rule: this.id,
            severity: 'error',
            message: `element '${el.id}' has duplicate animation id '${anim.id}'`,
            elementId: el.id,
          });
        } else {
          seen.add(anim.id);
        }
      }
    }
    return out;
  },
};

export const elementIdsUnique: LintRule = {
  id: 'element-ids-unique',
  severity: 'error',
  description: 'every element.id in the document must be unique',
  run(doc) {
    const out: LintFinding[] = [];
    const seen = new Set<string>();
    for (const el of doc.elements) {
      if (seen.has(el.id)) {
        out.push({
          rule: this.id,
          severity: 'error',
          message: `duplicate element id '${el.id}'`,
          elementId: el.id,
        });
      } else {
        seen.add(el.id);
      }
    }
    return out;
  },
};

export const elementsArrayNonEmpty: LintRule = {
  id: 'elements-array-non-empty',
  severity: 'warn',
  description: 'document should contain at least one element',
  run(doc) {
    if (doc.elements.length === 0) {
      return [{ rule: this.id, severity: 'warn', message: 'document has no elements' }];
    }
    return [];
  },
};

export const TIMING_RULES: readonly LintRule[] = [
  elementTimingWithinComposition,
  animationTimingWithinElement,
  animationIdsUniqueWithinElement,
  elementIdsUnique,
  elementsArrayNonEmpty,
] as const;
