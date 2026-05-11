// packages/adapters-core/src/capability-parser.test.ts
// CapabilityDescriptorParser tests — dispatch-by-modality / no-validator-
// returns-unvalidated / validator-rejects-passes-through / pure-dispatch.

import { describe, expect, it } from 'vitest';

import type { AdapterDescriptor } from './adapter-descriptor.js';
import {
  CapabilityDescriptorParser,
  type CapabilityValidator,
  buildValidatorMap,
} from './capability-parser.js';

function makeDescriptor(
  modalityKind: AdapterDescriptor['modality']['kind'],
  capability: AdapterDescriptor['capability'],
): AdapterDescriptor {
  return {
    id: 'stub',
    modality: { kind: modalityKind },
    capability,
    license: { kind: 'apache-2.0' },
    sandbox: { kind: 'in-process' },
  };
}

const ttsValidator: CapabilityValidator = (capability) => {
  const cap = capability as { sampleRate?: unknown };
  if (typeof cap.sampleRate !== 'number') {
    return { ok: false, error: 'tts: capability.sampleRate must be a number' };
  }
  return { ok: true, capability: cap as Record<string, unknown> };
};

describe('CapabilityDescriptorParser', () => {
  it('returns unvalidated when no validators are registered', () => {
    const parser = new CapabilityDescriptorParser();
    const result = parser.parse(makeDescriptor('tts', { sampleRate: 24000 }));
    expect(result.ok).toBe('unvalidated');
    if (result.ok === 'unvalidated') {
      expect(result.capability).toEqual({ sampleRate: 24000 });
    }
  });

  it('dispatches to the matching modality validator', () => {
    const parser = new CapabilityDescriptorParser(buildValidatorMap({ tts: ttsValidator }));
    const result = parser.parse(makeDescriptor('tts', { sampleRate: 48000 }));
    expect(result.ok).toBe(true);
  });

  it('passes validator errors through verbatim', () => {
    const parser = new CapabilityDescriptorParser(buildValidatorMap({ tts: ttsValidator }));
    const result = parser.parse(makeDescriptor('tts', { sampleRate: 'string-not-number' }));
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error).toMatch(/sampleRate must be a number/);
    }
  });

  it('falls through to unvalidated when validator registered for a different modality', () => {
    const parser = new CapabilityDescriptorParser(buildValidatorMap({ tts: ttsValidator }));
    const result = parser.parse(makeDescriptor('video-gen', { aspectRatio: '16:9' }));
    expect(result.ok).toBe('unvalidated');
  });

  it('registeredModalities lists registered validator keys', () => {
    const parser = new CapabilityDescriptorParser(
      buildValidatorMap({ tts: ttsValidator, sfx: ttsValidator }),
    );
    const modalities = parser.registeredModalities();
    expect([...modalities].sort()).toEqual(['sfx', 'tts']);
  });

  it('registeredModalities returns empty when no validators', () => {
    expect(new CapabilityDescriptorParser().registeredModalities()).toEqual([]);
  });

  it('buildValidatorMap drops undefined entries', () => {
    const map = buildValidatorMap({ tts: ttsValidator, 'video-gen': undefined });
    expect(map.has('tts')).toBe(true);
    expect(map.has('video-gen')).toBe(false);
  });

  it('parser is pure: same input returns equal-shaped result across calls', () => {
    const parser = new CapabilityDescriptorParser(buildValidatorMap({ tts: ttsValidator }));
    const desc = makeDescriptor('tts', { sampleRate: 24000 });
    const r1 = parser.parse(desc);
    const r2 = parser.parse(desc);
    expect(r1).toEqual(r2);
  });
});
