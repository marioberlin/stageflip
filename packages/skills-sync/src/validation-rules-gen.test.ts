// packages/skills-sync/src/validation-rules-gen.test.ts
// Generator produces deterministic, well-structured markdown. We
// test against a synthetic `ValidationRulesPkg` input rather than
// importing the real `@stageflip/validation` surface so the test
// stays hermetic — drift in the real ruleset doesn't silently
// change expected output here, and an empty-category-array
// doesn't accidentally reshape the template.

import { describe, expect, it } from 'vitest';

import type { LintRule } from '@stageflip/validation';

import {
  type ValidationRulesPkg,
  buildValidationRuleGroups,
  generateValidationRulesSkill,
} from './validation-rules-gen.js';

function rule(id: string, severity: 'error' | 'warn' | 'info', description: string): LintRule {
  return { id, severity, description, run: () => [] };
}

function mkPkg(overrides: Partial<ValidationRulesPkg> = {}): ValidationRulesPkg {
  const timing = [rule('timing-a', 'error', 'timing error a')];
  const transform: LintRule[] = [];
  const content = [rule('content-a', 'warn', 'content warn a')];
  const composition = [rule('comp-a', 'info', 'comp info a')];
  const fonts: LintRule[] = [];
  const stacking = [rule('stack-a', 'error', 'stack error a')];
  const clips = [rule('clip-a', 'error', 'clip error a')];
  const all = [
    ...timing,
    ...transform,
    ...content,
    ...composition,
    ...fonts,
    ...stacking,
    ...clips,
  ];
  return {
    TIMING_RULES: timing,
    TRANSFORM_RULES: transform,
    CONTENT_RULES: content,
    COMPOSITION_RULES: composition,
    FONT_RULES: fonts,
    STACKING_RULES: stacking,
    CLIP_RULES: clips,
    ALL_RULES: all,
    ...overrides,
  };
}

describe('buildValidationRuleGroups', () => {
  it('returns 7 ordered groups matching the skill layout', () => {
    const groups = buildValidationRuleGroups(mkPkg());
    expect(groups).toHaveLength(7);
    expect(groups.map((g) => g.heading)).toEqual([
      'Timing & identifiers',
      'Transform & layout',
      'Content-specific',
      'Composition',
      'Fonts',
      'Stacking',
      'Clip resolution (context-dependent)',
    ]);
  });
});

describe('generateValidationRulesSkill', () => {
  it('emits auto-generated frontmatter with tier reference + status auto-generated', () => {
    const out = generateValidationRulesSkill(mkPkg());
    expect(out.startsWith('---\n')).toBe(true);
    expect(out).toContain('title: Reference — Validation Rules');
    expect(out).toContain('tier: reference');
    expect(out).toContain('status: auto-generated');
    expect(out).toContain('owner_task: T-107');
  });

  it('totals the rules correctly in the intro', () => {
    const pkg = mkPkg();
    const out = generateValidationRulesSkill(pkg);
    expect(out).toContain(`Currently ${pkg.ALL_RULES.length} rules across 7 categories.`);
  });

  it('emits one table row per rule with escaped description', () => {
    const pkg = mkPkg({
      CONTENT_RULES: [rule('pipe-rule', 'error', 'has a | pipe that must be escaped')],
    });
    const out = generateValidationRulesSkill(pkg);
    // The description's `|` should be escaped as `\|` to survive the
    // markdown table.
    expect(out).toContain('| `pipe-rule` | error | has a \\| pipe that must be escaped |');
  });

  it('renders "_No rules registered in this category._" when a group is empty', () => {
    const out = generateValidationRulesSkill(mkPkg({ FONT_RULES: [], TRANSFORM_RULES: [] }));
    // Both Transform and Fonts are empty in the base fixture.
    const occurrences = (out.match(/_No rules registered in this category\._/g) ?? []).length;
    expect(occurrences).toBe(2);
  });

  it('is deterministic: identical input → identical output', () => {
    const pkg = mkPkg();
    const a = generateValidationRulesSkill(pkg);
    const b = generateValidationRulesSkill(pkg);
    expect(a).toBe(b);
  });

  it('includes the quick-start snippet + severity legend + customising + lifecycle prose', () => {
    const out = generateValidationRulesSkill(mkPkg());
    expect(out).toContain('## Quick start');
    expect(out).toContain('## Severity legend');
    expect(out).toContain('## Customising the rule set');
    expect(out).toContain('## Lifecycle');
  });

  it('preserves the order of rules within a category', () => {
    const pkg = mkPkg({
      TIMING_RULES: [
        rule('z-last', 'error', 'z'),
        rule('a-first', 'error', 'a'),
        rule('m-middle', 'error', 'm'),
      ],
      ALL_RULES: [
        rule('z-last', 'error', 'z'),
        rule('a-first', 'error', 'a'),
        rule('m-middle', 'error', 'm'),
      ],
    });
    const out = generateValidationRulesSkill(pkg);
    const zIdx = out.indexOf('z-last');
    const aIdx = out.indexOf('a-first');
    const mIdx = out.indexOf('m-middle');
    expect(zIdx).toBeGreaterThan(0);
    expect(zIdx).toBeLessThan(aIdx);
    expect(aIdx).toBeLessThan(mIdx);
  });
});
