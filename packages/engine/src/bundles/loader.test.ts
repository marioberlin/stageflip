// packages/engine/src/bundles/loader.test.ts

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { describe, expect, it } from 'vitest';
import { BundleLoadError, BundleLoader, DEFAULT_TOOL_LIMIT } from './loader.js';
import { BundleRegistry } from './registry.js';

const tool = (name: string): LLMToolDefinition => ({
  name,
  description: `d-${name}`,
  input_schema: { type: 'object' },
});

function makeRegistry(
  entries: Array<{ name: string; tools: LLMToolDefinition[] }>,
): BundleRegistry {
  const r = new BundleRegistry();
  for (const entry of entries) {
    r.register({ name: entry.name, description: `desc-${entry.name}`, tools: entry.tools });
  }
  return r;
}

describe('BundleLoader', () => {
  it('loads a known bundle and reports loaded bundles + tools', () => {
    const registry = makeRegistry([
      { name: 'read', tools: [tool('get_document'), tool('get_slide')] },
    ]);
    const loader = new BundleLoader(registry);

    const loaded = loader.load('read');
    expect(loaded.name).toBe('read');
    expect(loader.loaded()).toHaveLength(1);
    expect(loader.toolCount()).toBe(2);
    expect(loader.toolDefinitions().map((t) => t.name)).toEqual(['get_document', 'get_slide']);
  });

  it('defaults to the 30-tool invariant limit', () => {
    const loader = new BundleLoader(new BundleRegistry());
    expect(loader.maxTools).toBe(DEFAULT_TOOL_LIMIT);
    expect(DEFAULT_TOOL_LIMIT).toBe(30);
  });

  it('throws BundleLoadError(unknown_bundle) when the name is not registered', () => {
    const loader = new BundleLoader(makeRegistry([]));
    const err = (() => {
      try {
        loader.load('nope');
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(BundleLoadError);
    expect((err as BundleLoadError).kind).toBe('unknown_bundle');
    expect((err as BundleLoadError).bundleName).toBe('nope');
  });

  it('throws BundleLoadError(already_loaded) on a double-load', () => {
    const registry = makeRegistry([{ name: 'read', tools: [tool('a')] }]);
    const loader = new BundleLoader(registry);
    loader.load('read');
    const err = (() => {
      try {
        loader.load('read');
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect((err as BundleLoadError).kind).toBe('already_loaded');
  });

  it('throws BundleLoadError(limit_exceeded) when loading would push past the cap', () => {
    const big = Array.from({ length: 20 }, (_, i) => tool(`big-${i}`));
    const medium = Array.from({ length: 15 }, (_, i) => tool(`med-${i}`));
    const registry = makeRegistry([
      { name: 'big', tools: big },
      { name: 'medium', tools: medium },
    ]);
    const loader = new BundleLoader(registry); // default 30

    loader.load('big'); // 20 — fine
    const err = (() => {
      try {
        loader.load('medium'); // 20 + 15 = 35 > 30
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect((err as BundleLoadError).kind).toBe('limit_exceeded');
    expect((err as BundleLoadError).requestedSize).toBe(35);
    expect((err as BundleLoadError).limit).toBe(30);

    // The failed load should NOT be in the loaded set.
    expect(loader.loaded().map((b) => b.name)).toEqual(['big']);
    expect(loader.toolCount()).toBe(20);
  });

  it('accepts a custom maxTools override', () => {
    const registry = makeRegistry([{ name: 'small', tools: [tool('a'), tool('b'), tool('c')] }]);
    const loader = new BundleLoader(registry, { maxTools: 2 });
    const err = (() => {
      try {
        loader.load('small');
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect((err as BundleLoadError).kind).toBe('limit_exceeded');
    expect((err as BundleLoadError).limit).toBe(2);
  });

  it('reset() clears all loaded bundles and restores the budget', () => {
    const registry = makeRegistry([
      { name: 'a', tools: Array.from({ length: 10 }, (_, i) => tool(`a${i}`)) },
      { name: 'b', tools: Array.from({ length: 10 }, (_, i) => tool(`b${i}`)) },
      { name: 'c', tools: Array.from({ length: 10 }, (_, i) => tool(`c${i}`)) },
      { name: 'd', tools: Array.from({ length: 10 }, (_, i) => tool(`d${i}`)) },
    ]);
    const loader = new BundleLoader(registry);

    loader.load('a');
    loader.load('b');
    loader.load('c'); // 30 — right at the limit

    expect(loader.toolCount()).toBe(30);

    loader.reset();
    expect(loader.toolCount()).toBe(0);
    expect(loader.loaded()).toEqual([]);

    // After reset, we can load a different set.
    loader.load('d');
    expect(loader.toolCount()).toBe(10);
  });

  it('toolDefinitions preserves per-bundle ordering', () => {
    const registry = makeRegistry([
      { name: 'first', tools: [tool('1a'), tool('1b')] },
      { name: 'second', tools: [tool('2a')] },
    ]);
    const loader = new BundleLoader(registry);
    loader.load('first');
    loader.load('second');
    expect(loader.toolDefinitions().map((t) => t.name)).toEqual(['1a', '1b', '2a']);
  });
});
