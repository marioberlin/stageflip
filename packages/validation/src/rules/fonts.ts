// packages/validation/src/rules/fonts.ts
// Rules on fontRequirements — catches drift between actual text
// elements and the declared font set.

import type { LintFinding, LintRule } from '../types.js';

export const fontRequirementCoversTextFamilies: LintRule = {
  id: 'font-requirement-covers-text-families',
  severity: 'warn',
  description: 'every text element fontFamily should appear in document.fontRequirements',
  run(doc) {
    const declared = new Set(doc.fontRequirements.map((f) => f.family));
    const out: LintFinding[] = [];
    const seen = new Set<string>();
    for (const el of doc.elements) {
      if (el.content.type === 'text') {
        const fam = el.content.fontFamily;
        if (!declared.has(fam) && !seen.has(fam)) {
          seen.add(fam);
          out.push({
            rule: this.id,
            severity: 'warn',
            message: `text element '${el.id}' uses font family '${fam}' which is not in document.fontRequirements`,
            elementId: el.id,
          });
        }
      }
    }
    return out;
  },
};

export const fontRequirementWeightsCoverTextWeights: LintRule = {
  id: 'font-requirement-weights-cover-text-weights',
  severity: 'warn',
  description: 'for each text family, fontRequirements should list the weight used',
  run(doc) {
    const byFamily = new Map<string, Set<number>>();
    for (const f of doc.fontRequirements) {
      const existing = byFamily.get(f.family) ?? new Set<number>();
      // fontRequirementSchema.weight can be numeric or keyword; only
      // numeric values participate in coverage matching here.
      if (typeof f.weight === 'number') existing.add(f.weight);
      byFamily.set(f.family, existing);
    }
    const out: LintFinding[] = [];
    const reported = new Set<string>();
    for (const el of doc.elements) {
      if (el.content.type === 'text') {
        const fam = el.content.fontFamily;
        const weights = byFamily.get(fam);
        if (weights && !weights.has(el.content.fontWeight)) {
          const key = `${fam}:${el.content.fontWeight}`;
          if (reported.has(key)) continue;
          reported.add(key);
          out.push({
            rule: this.id,
            severity: 'warn',
            message: `text element '${el.id}' uses ${fam} @ weight ${el.content.fontWeight} but fontRequirements for '${fam}' lists ${Array.from(weights).sort().join('/')}`,
            elementId: el.id,
          });
        }
      }
    }
    return out;
  },
};

export const FONT_RULES: readonly LintRule[] = [
  fontRequirementCoversTextFamilies,
  fontRequirementWeightsCoverTextWeights,
] as const;
