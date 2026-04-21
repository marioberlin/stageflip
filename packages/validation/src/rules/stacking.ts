// packages/validation/src/rules/stacking.ts
// Rules on the document's stackingMap + per-element stacking + zIndex
// consistency.

import type { LintFinding, LintRule } from '../types.js';

export const stackingMapCoversAllElements: LintRule = {
  id: 'stacking-map-covers-all-elements',
  severity: 'error',
  description: 'every element.id must appear in stackingMap (the compiler contract)',
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      if (!(el.id in doc.stackingMap)) {
        out.push({
          rule: this.id,
          severity: 'error',
          message: `element '${el.id}' is missing from stackingMap`,
          elementId: el.id,
        });
      }
    }
    return out;
  },
};

export const stackingValueMatchesElement: LintRule = {
  id: 'stacking-value-matches-element',
  severity: 'error',
  description: "each stackingMap[id] must equal the element's own stacking value",
  run(doc) {
    const out: LintFinding[] = [];
    for (const el of doc.elements) {
      const mapValue = doc.stackingMap[el.id];
      if (mapValue !== undefined && mapValue !== el.stacking) {
        out.push({
          rule: this.id,
          severity: 'error',
          message: `element '${el.id}' stacking is '${el.stacking}' but stackingMap says '${mapValue}'`,
          elementId: el.id,
        });
      }
    }
    return out;
  },
};

export const zIndexUniqueAcrossRoot: LintRule = {
  id: 'zindex-unique-across-root',
  severity: 'info',
  description:
    'duplicate zIndex values produce ambiguous stacking order — prefer unique assignments',
  run(doc) {
    const out: LintFinding[] = [];
    const byZ = new Map<number, string[]>();
    for (const el of doc.elements) {
      const ids = byZ.get(el.zIndex) ?? [];
      ids.push(el.id);
      byZ.set(el.zIndex, ids);
    }
    for (const [z, ids] of byZ) {
      if (ids.length > 1) {
        out.push({
          rule: this.id,
          severity: 'info',
          message: `${ids.length} elements share zIndex ${z}: ${ids.join(', ')}`,
        });
      }
    }
    return out;
  },
};

export const STACKING_RULES: readonly LintRule[] = [
  stackingMapCoversAllElements,
  stackingValueMatchesElement,
  zIndexUniqueAcrossRoot,
] as const;
