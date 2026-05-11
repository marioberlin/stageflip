// packages/adapter-regression/src/snapshot-format.test.ts
// Tests for the snapshot-format module: canonical SHA-256 helpers + the
// on-disk snapshot Zod-style validator + the serializer (T-435).

import { describe, expect, it } from 'vitest';

import {
  type AdapterRegressionSnapshot,
  canonicalSha256Hex,
  descriptorSha256,
  outputSha256,
  parseAdapterRegressionSnapshot,
  serializeAdapterRegressionSnapshot,
} from './snapshot-format.js';

describe('canonicalSha256Hex', () => {
  it('produces a 64-hex lowercase string', async () => {
    const hex = await canonicalSha256Hex({ foo: 1 });
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable across key-insertion order', async () => {
    const a = await canonicalSha256Hex({ a: 1, b: 2, c: 3 });
    const b = await canonicalSha256Hex({ c: 3, a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it('changes when values change', async () => {
    const a = await canonicalSha256Hex({ a: 1 });
    const b = await canonicalSha256Hex({ a: 2 });
    expect(a).not.toBe(b);
  });
});

describe('descriptorSha256', () => {
  it('hashes a descriptor', async () => {
    const hex = await descriptorSha256({
      id: 'demo',
      modality: { kind: 'tts' },
      capability: {},
      license: { kind: 'apache-2.0' },
      sandbox: { kind: 'in-process' },
    });
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('outputSha256', () => {
  it('hashes a synthesize result', async () => {
    const hex = await outputSha256({ cacheKey: 'tts/abc', url: 'data:audio/wav;...', durationS: 0.5 });
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('parseAdapterRegressionSnapshot', () => {
  function validSnapshot(): AdapterRegressionSnapshot {
    return {
      id: 'demo',
      modality: 'tts',
      descriptorSha256: 'a'.repeat(64),
      sampleInputs: [
        {
          name: 'minimal',
          input: { text: 'hi' },
          outputSha256: 'b'.repeat(64),
          cacheKey: 'tts/abc',
        },
      ],
    };
  }

  it('accepts a well-formed snapshot', () => {
    const ok = parseAdapterRegressionSnapshot(validSnapshot());
    expect(ok.id).toBe('demo');
    expect(ok.sampleInputs).toHaveLength(1);
  });

  it('rejects null', () => {
    expect(() => parseAdapterRegressionSnapshot(null)).toThrow(/root must be an object/);
  });

  it('rejects missing id', () => {
    const bad = { ...validSnapshot(), id: '' };
    expect(() => parseAdapterRegressionSnapshot(bad)).toThrow(/id/);
  });

  it('rejects non-64-hex descriptorSha256', () => {
    const bad = { ...validSnapshot(), descriptorSha256: 'short' };
    expect(() => parseAdapterRegressionSnapshot(bad)).toThrow(/descriptorSha256/);
  });

  it('rejects empty sampleInputs', () => {
    const bad = { ...validSnapshot(), sampleInputs: [] };
    expect(() => parseAdapterRegressionSnapshot(bad)).toThrow(/sampleInputs/);
  });

  it('rejects sampleInputs row with bad outputSha256', () => {
    const bad = validSnapshot();
    const badSamples = [{ ...bad.sampleInputs[0]!, outputSha256: 'not-hex' }];
    expect(() =>
      parseAdapterRegressionSnapshot({ ...bad, sampleInputs: badSamples }),
    ).toThrow(/outputSha256/);
  });

  it('rejects sampleInputs row with empty cacheKey', () => {
    const bad = validSnapshot();
    const badSamples = [{ ...bad.sampleInputs[0]!, cacheKey: '' }];
    expect(() =>
      parseAdapterRegressionSnapshot({ ...bad, sampleInputs: badSamples }),
    ).toThrow(/cacheKey/);
  });
});

describe('serializeAdapterRegressionSnapshot', () => {
  it('emits 2-space-indented JSON with trailing newline', () => {
    const out = serializeAdapterRegressionSnapshot({
      id: 'demo',
      modality: 'tts',
      descriptorSha256: 'a'.repeat(64),
      sampleInputs: [
        {
          name: 'minimal',
          input: { text: 'hi' },
          outputSha256: 'b'.repeat(64),
          cacheKey: 'tts/abc',
        },
      ],
    });
    expect(out.endsWith('\n')).toBe(true);
    expect(out).toMatch(/\n  "id": "demo"/);
  });

  it('round-trips through parse', () => {
    const original: AdapterRegressionSnapshot = {
      id: 'demo',
      modality: 'tts',
      descriptorSha256: 'a'.repeat(64),
      sampleInputs: [
        {
          name: 'minimal',
          input: { text: 'hi', n: 1 },
          outputSha256: 'b'.repeat(64),
          cacheKey: 'tts/abc',
        },
      ],
    };
    const out = serializeAdapterRegressionSnapshot(original);
    const parsed = parseAdapterRegressionSnapshot(JSON.parse(out));
    expect(parsed).toEqual(original);
  });
});
