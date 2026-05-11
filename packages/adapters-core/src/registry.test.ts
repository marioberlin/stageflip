// packages/adapters-core/src/registry.test.ts
// AdapterRegistry tests — register / duplicate-throws / unregister-idempotent
// / lookup / list / byCapability / clear / size.

import { beforeEach, describe, expect, it } from 'vitest';

import type { AdapterDescriptor } from './adapter-descriptor.js';
import { AdapterRegistry } from './registry.js';

function makeAdapter(
  id: string,
  modalityKind: AdapterDescriptor['modality']['kind'] = 'tts',
  capability: AdapterDescriptor['capability'] = {},
): AdapterDescriptor {
  return {
    id,
    modality: { kind: modalityKind },
    capability,
    license: { kind: 'apache-2.0' },
    sandbox: { kind: 'in-process' },
  };
}

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  it('starts empty', () => {
    expect(registry.size).toBe(0);
    expect(registry.list()).toEqual([]);
  });

  it('registers and looks up an adapter', () => {
    const adapter = makeAdapter('kokoro');
    registry.register(adapter);
    expect(registry.lookup('tts', 'kokoro')).toBe(adapter);
    expect(registry.size).toBe(1);
  });

  it('returns undefined on lookup miss', () => {
    expect(registry.lookup('tts', 'missing')).toBeUndefined();
  });

  it('throws on duplicate (modality.kind, id)', () => {
    registry.register(makeAdapter('kokoro'));
    expect(() => registry.register(makeAdapter('kokoro'))).toThrow(/already registered/i);
  });

  it('allows the same id under different modalities', () => {
    registry.register(makeAdapter('shared', 'tts'));
    registry.register(makeAdapter('shared', 'sfx'));
    expect(registry.lookup('tts', 'shared')?.modality.kind).toBe('tts');
    expect(registry.lookup('sfx', 'shared')?.modality.kind).toBe('sfx');
    expect(registry.size).toBe(2);
  });

  it('unregister returns true when present, false when absent (idempotent)', () => {
    registry.register(makeAdapter('a'));
    expect(registry.unregister('tts', 'a')).toBe(true);
    expect(registry.unregister('tts', 'a')).toBe(false);
    expect(registry.lookup('tts', 'a')).toBeUndefined();
  });

  it('list returns adapters in insertion order', () => {
    const ids = ['c', 'a', 'b'];
    for (const id of ids) registry.register(makeAdapter(id));
    expect(registry.list().map((a) => a.id)).toEqual(ids);
  });

  it('list filters by modality when supplied', () => {
    registry.register(makeAdapter('tts1', 'tts'));
    registry.register(makeAdapter('vid1', 'video-gen'));
    registry.register(makeAdapter('tts2', 'tts'));
    expect(registry.list('tts').map((a) => a.id)).toEqual(['tts1', 'tts2']);
    expect(registry.list('video-gen').map((a) => a.id)).toEqual(['vid1']);
    expect(registry.list('music-gen')).toEqual([]);
  });

  it('byCapability filters by predicate over capability envelope', () => {
    registry.register(makeAdapter('high', 'tts', { sampleRate: 48000 }));
    registry.register(makeAdapter('low', 'tts', { sampleRate: 16000 }));
    registry.register(makeAdapter('mid', 'tts', { sampleRate: 24000 }));
    registry.register(makeAdapter('vid', 'video-gen', { sampleRate: 99999 }));
    const hifi = registry.byCapability('tts', (cap) => (cap.sampleRate as number) >= 24000);
    expect(hifi.map((a) => a.id)).toEqual(['high', 'mid']);
  });

  it('byCapability passes adapter as second arg', () => {
    registry.register(makeAdapter('a', 'tts'));
    registry.register(makeAdapter('b', 'tts'));
    const seen: string[] = [];
    registry.byCapability('tts', (_cap, adapter) => {
      seen.push(adapter.id);
      return true;
    });
    expect(seen).toEqual(['a', 'b']);
  });

  it('byCapability returns empty when no adapters match modality', () => {
    registry.register(makeAdapter('a', 'tts'));
    expect(registry.byCapability('video-gen', () => true)).toEqual([]);
  });

  it('clear empties the registry', () => {
    registry.register(makeAdapter('a'));
    registry.register(makeAdapter('b'));
    registry.clear();
    expect(registry.size).toBe(0);
    expect(registry.list()).toEqual([]);
  });
});
