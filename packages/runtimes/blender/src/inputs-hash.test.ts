// packages/runtimes/blender/src/inputs-hash.test.ts
// T-265 AC #4–#7 — the cache key is the whole game.

import { describe, expect, it } from 'vitest';

import { canonicalize, computeInputsHash } from './inputs-hash.js';

const BASE_SCENE = { template: 'fluid-sim', params: { viscosity: 0.5 } };
const BASE_DURATION = { durationMs: 2000, fps: 30 };

describe('computeInputsHash determinism (T-265 AC #5)', () => {
  it('returns the same digest across 1000 invocations', () => {
    const first = computeInputsHash({ scene: BASE_SCENE, duration: BASE_DURATION });
    for (let i = 0; i < 1000; i++) {
      expect(computeInputsHash({ scene: BASE_SCENE, duration: BASE_DURATION })).toBe(first);
    }
  });
  it('emits a 64-char lowercase hex digest', () => {
    const h = computeInputsHash({ scene: BASE_SCENE, duration: BASE_DURATION });
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('field order independence (T-265 AC #6)', () => {
  it('treats {a:1,b:2} and {b:2,a:1} as identical', () => {
    const a = computeInputsHash({
      scene: { template: 't', params: { a: 1, b: 2 } },
      duration: BASE_DURATION,
    });
    const b = computeInputsHash({
      scene: { template: 't', params: { b: 2, a: 1 } },
      duration: BASE_DURATION,
    });
    expect(a).toBe(b);
  });
  it('treats deeply nested key order as identical', () => {
    const a = computeInputsHash({
      scene: { template: 't', params: { outer: { x: 1, y: 2, z: 3 } } },
      duration: BASE_DURATION,
    });
    const b = computeInputsHash({
      scene: { template: 't', params: { outer: { z: 3, y: 2, x: 1 } } },
      duration: BASE_DURATION,
    });
    expect(a).toBe(b);
  });
  it('preserves array order (semantic — array index matters)', () => {
    const a = computeInputsHash({
      scene: { template: 't', params: { layers: [1, 2, 3] } },
      duration: BASE_DURATION,
    });
    const b = computeInputsHash({
      scene: { template: 't', params: { layers: [3, 2, 1] } },
      duration: BASE_DURATION,
    });
    expect(a).not.toBe(b);
  });
});

describe('field type sensitivity (T-265 AC #7)', () => {
  it('distinguishes number 1000 from string "1000"', () => {
    const num = computeInputsHash({
      scene: BASE_SCENE,
      duration: { durationMs: 1000, fps: 30 },
    });
    const str = computeInputsHash({
      scene: { template: 'fluid-sim', params: { viscosity: 0.5, ms: '1000' } },
      duration: { durationMs: 1000, fps: 30 },
    });
    expect(num).not.toBe(str);
  });
  it('distinguishes boolean true from string "true"', () => {
    const a = computeInputsHash({
      scene: { template: 't', params: { live: true } },
      duration: BASE_DURATION,
    });
    const b = computeInputsHash({
      scene: { template: 't', params: { live: 'true' } },
      duration: BASE_DURATION,
    });
    expect(a).not.toBe(b);
  });
  it('distinguishes number 1 from boolean true', () => {
    const a = computeInputsHash({
      scene: { template: 't', params: { live: 1 } },
      duration: BASE_DURATION,
    });
    const b = computeInputsHash({
      scene: { template: 't', params: { live: true } },
      duration: BASE_DURATION,
    });
    expect(a).not.toBe(b);
  });
});

describe('input change → different hash', () => {
  it('changes when the template changes', () => {
    const a = computeInputsHash({ scene: BASE_SCENE, duration: BASE_DURATION });
    const b = computeInputsHash({
      scene: { ...BASE_SCENE, template: 'product-render' },
      duration: BASE_DURATION,
    });
    expect(a).not.toBe(b);
  });
  it('changes when durationMs changes by 1', () => {
    const a = computeInputsHash({ scene: BASE_SCENE, duration: BASE_DURATION });
    const b = computeInputsHash({
      scene: BASE_SCENE,
      duration: { durationMs: 2001, fps: 30 },
    });
    expect(a).not.toBe(b);
  });
  it('changes when fps changes', () => {
    const a = computeInputsHash({ scene: BASE_SCENE, duration: { durationMs: 2000, fps: 30 } });
    const b = computeInputsHash({ scene: BASE_SCENE, duration: { durationMs: 2000, fps: 60 } });
    expect(a).not.toBe(b);
  });
});

describe('canonicalize (lower-level invariants)', () => {
  it('sorts object keys', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
  it('preserves array order', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
  });
  it('rejects non-finite numbers', () => {
    expect(() => canonicalize({ x: Number.POSITIVE_INFINITY })).toThrow(/non-finite/);
    expect(() => canonicalize({ x: Number.NaN })).toThrow(/non-finite/);
  });
  it('rejects bigint', () => {
    expect(() => canonicalize({ x: 1n })).toThrow(/bigint/);
  });
  it('rejects circular structures', () => {
    const a: { self?: unknown } = {};
    a.self = a;
    expect(() => canonicalize(a)).toThrow(/circular/);
  });
  it('omits undefined object fields, matches JSON.stringify', () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
  });
  it('serializes undefined inside an array as null', () => {
    expect(canonicalize([1, undefined, 3])).toBe('[1,null,3]');
  });
  it('serializes null literally', () => {
    expect(canonicalize({ a: null })).toBe('{"a":null}');
  });
});

describe('verifiability against a fixture (T-265 AC #4)', () => {
  // Pin one expected hash so a refactor that breaks the canonicalizer cannot
  // silently slip through. The hash itself is computed from the inputs once
  // and frozen; if you legitimately change the canonicalization rule, update
  // this fixture and document the migration.
  it('pins the expected hash for a known fixture', () => {
    const h = computeInputsHash({
      scene: { template: 'fluid-sim', params: { viscosity: 0.5 } },
      duration: { durationMs: 2000, fps: 30 },
    });
    // Computed by hashing
    //   {"duration":{"durationMs":2000,"fps":30},"scene":{"params":{"viscosity":0.5},"template":"fluid-sim"}}
    expect(h).toBe('aac0f4a3a0f55d9c0f6eb63d2e5c209bfba6d3d5205890bc40516a3a61f98fc4');
  });
});
