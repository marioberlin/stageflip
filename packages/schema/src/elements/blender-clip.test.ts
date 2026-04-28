// packages/schema/src/elements/blender-clip.test.ts
// Schema tests for BlenderClip (T-265 AC #1, #2, #3, #4 — schema-side).
// AC #4 (verifiability of inputsHash against {scene, duration}) is pinned in
// packages/runtimes/blender/src/inputs-hash.test.ts; here we just check the
// shape and the format guard on inputsHash.

import { describe, expect, it } from 'vitest';

import {
  type BlenderClipElement,
  blenderClipSchema,
  blenderDurationSchema,
  blenderSceneSchema,
  inputsHashSchema,
} from './blender-clip.js';
import { ELEMENT_TYPES, elementSchema } from './index.js';

const BASE = {
  id: 'el_blend1',
  transform: { x: 0, y: 0, width: 1280, height: 720 },
} as const;

const FAKE_HASH = 'a'.repeat(64);

const VALID: BlenderClipElement = {
  id: 'el_blend1',
  transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
  type: 'blender-clip',
  scene: { template: 'fluid-sim', params: { viscosity: 0.5 } },
  duration: { durationMs: 2000, fps: 30 },
  inputsHash: FAKE_HASH,
};

describe('inputsHashSchema (T-265 AC #2)', () => {
  it('accepts a 64-char lower-case hex sha256', () => {
    expect(inputsHashSchema.parse(FAKE_HASH)).toBe(FAKE_HASH);
  });
  it('rejects an upper-case hash', () => {
    expect(() => inputsHashSchema.parse('A'.repeat(64))).toThrow();
  });
  it('rejects a too-short hash', () => {
    expect(() => inputsHashSchema.parse('a'.repeat(63))).toThrow();
  });
  it('rejects a too-long hash', () => {
    expect(() => inputsHashSchema.parse('a'.repeat(65))).toThrow();
  });
  it('rejects non-hex chars', () => {
    expect(() => inputsHashSchema.parse('z'.repeat(64))).toThrow();
  });
});

describe('blenderSceneSchema', () => {
  it('parses a minimal scene with empty params default', () => {
    const parsed = blenderSceneSchema.parse({ template: 'fluid-sim' });
    expect(parsed.template).toBe('fluid-sim');
    expect(parsed.params).toEqual({});
  });
  it('rejects an empty template', () => {
    expect(() => blenderSceneSchema.parse({ template: '' })).toThrow();
  });
});

describe('blenderDurationSchema', () => {
  it('defaults fps to 30', () => {
    const parsed = blenderDurationSchema.parse({ durationMs: 1000 });
    expect(parsed.fps).toBe(30);
  });
  it('rejects a non-positive durationMs', () => {
    expect(() => blenderDurationSchema.parse({ durationMs: 0 })).toThrow();
  });
});

describe('blenderClipSchema (T-265 AC #1)', () => {
  it('parses a valid BlenderClip', () => {
    const parsed = blenderClipSchema.parse(VALID);
    expect(parsed.type).toBe('blender-clip');
    expect(parsed.scene.template).toBe('fluid-sim');
    expect(parsed.duration.fps).toBe(30);
  });
  it('rejects an invalid inputsHash (T-265 AC #2)', () => {
    expect(() => blenderClipSchema.parse({ ...VALID, inputsHash: 'not-a-hash' })).toThrow();
  });
  it('rejects extra fields (strict)', () => {
    expect(() =>
      blenderClipSchema.parse({ ...VALID, fancy: true } as unknown as BlenderClipElement),
    ).toThrow();
  });
});

describe('elementSchema includes blender-clip (T-265 AC #3)', () => {
  it('discriminates the bake-tier branch', () => {
    const parsed = elementSchema.parse(VALID);
    expect(parsed.type).toBe('blender-clip');
  });
  it('ELEMENT_TYPES contains "blender-clip"', () => {
    expect(ELEMENT_TYPES).toContain('blender-clip');
  });
  it('does not break existing branches: text still parses', () => {
    expect(() => elementSchema.parse({ ...BASE, type: 'text', text: 'hi' })).not.toThrow();
  });
});
