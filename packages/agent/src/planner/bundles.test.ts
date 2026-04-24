// packages/agent/src/planner/bundles.test.ts

import { describe, expect, it } from 'vitest';
import { BUNDLE_NAMES, listBundles } from './bundles.js';
import { bundleSummarySchema } from './types.js';

describe('listBundles', () => {
  it('returns the 14 bundles from the tool-bundles skill', () => {
    const bundles = listBundles();
    expect(bundles).toHaveLength(14);
  });

  it('returns entries that satisfy BundleSummary', () => {
    for (const bundle of listBundles()) {
      expect(bundleSummarySchema.safeParse(bundle).success).toBe(true);
    }
  });

  it('returns a fresh copy on each call so callers cannot mutate the registry', () => {
    const first = listBundles();
    first[0] = { ...first[0], description: 'mutated' } as (typeof first)[number];
    const second = listBundles();
    expect(second[0]?.description).not.toBe('mutated');
  });
});

describe('BUNDLE_NAMES', () => {
  it('includes the canonical catalog names', () => {
    const expected = [
      'read',
      'create-mutate',
      'timing',
      'layout',
      'validate',
      'clip-animation',
      'element-cm1',
      'slide-cm1',
      'table-cm1',
      'qc-export-bulk',
      'fact-check',
      'domain-finance-sales-okr',
      'data-source-bindings',
      'semantic-layout',
    ];
    expect([...BUNDLE_NAMES]).toEqual(expected);
  });
});
