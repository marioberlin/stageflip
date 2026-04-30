// packages/engine/src/bundles/registry.test.ts

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { describe, expect, it } from 'vitest';
import { CANONICAL_BUNDLES, CANONICAL_BUNDLE_NAMES } from './catalog.js';
import { BundleRegistry, createCanonicalRegistry } from './registry.js';

const tool = (name: string): LLMToolDefinition => ({
  name,
  description: `d-${name}`,
  input_schema: { type: 'object' },
});

describe('BundleRegistry', () => {
  it('registers a bundle and exposes it via get/has/size', () => {
    const r = new BundleRegistry();
    r.register({ name: 'foo', description: 'x', tools: [] });
    expect(r.has('foo')).toBe(true);
    expect(r.get('foo')?.description).toBe('x');
    expect(r.size).toBe(1);
  });

  it('returns undefined for unknown bundles', () => {
    const r = new BundleRegistry();
    expect(r.get('nope')).toBeUndefined();
    expect(r.has('nope')).toBe(false);
  });

  it('overwrites a bundle on re-register', () => {
    const r = new BundleRegistry();
    r.register({ name: 'foo', description: 'v1', tools: [tool('a')] });
    r.register({ name: 'foo', description: 'v2', tools: [] });
    expect(r.get('foo')?.description).toBe('v2');
    expect(r.get('foo')?.tools).toEqual([]);
  });

  it('mergeTools appends to an existing bundle', () => {
    const r = new BundleRegistry();
    r.register({ name: 'foo', description: 'd', tools: [tool('a')] });
    r.mergeTools('foo', [tool('b'), tool('c')]);
    expect(r.get('foo')?.tools.map((t) => t.name)).toEqual(['a', 'b', 'c']);
  });

  it('mergeTools throws for unknown bundle names', () => {
    const r = new BundleRegistry();
    expect(() => r.mergeTools('missing', [tool('a')])).toThrow(/unknown bundle/);
  });

  it('list() returns summaries only', () => {
    const r = new BundleRegistry();
    r.register({
      name: 'foo',
      description: 'x',
      tools: [tool('a'), tool('b')],
    });
    r.register({ name: 'bar', description: 'y', tools: [] });
    const list = r.list();
    expect(list).toEqual([
      { name: 'foo', description: 'x', toolCount: 2 },
      { name: 'bar', description: 'y', toolCount: 0 },
    ]);
  });
});

describe('createCanonicalRegistry', () => {
  it('seeds the 17 canonical bundles', () => {
    const r = createCanonicalRegistry();
    expect(r.size).toBe(17);
    for (const name of CANONICAL_BUNDLE_NAMES) {
      expect(r.has(name)).toBe(true);
    }
  });

  it('returns independent instances — mutations do not leak', () => {
    const a = createCanonicalRegistry();
    const b = createCanonicalRegistry();
    a.mergeTools('read', [tool('new')]);
    expect(a.get('read')?.tools).toHaveLength(1);
    expect(b.get('read')?.tools).toHaveLength(0);
  });

  it('seeds each instance with its own tools array (raw push does not leak)', () => {
    const a = createCanonicalRegistry();
    const b = createCanonicalRegistry();
    // Cast away readonly to simulate a caller who bypasses mergeTools.
    (a.get('read')?.tools as LLMToolDefinition[]).push(tool('leak'));
    expect(a.get('read')?.tools).toHaveLength(1);
    expect(b.get('read')?.tools).toHaveLength(0);
  });

  it('matches the canonical catalog exactly', () => {
    const r = createCanonicalRegistry();
    for (const bundle of CANONICAL_BUNDLES) {
      expect(r.get(bundle.name)?.description).toBe(bundle.description);
    }
  });
});
