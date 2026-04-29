// packages/schema/src/clips/interactive/shader-props.test.ts
// T-383 ACs #1, #2, #3 — shaderClipPropsSchema parsing.

import { describe, expect, it } from 'vitest';

import { shaderClipPropsSchema, uniformValueSchema } from './shader-props.js';

const VALID_FRAGMENT = 'precision highp float; void main() { gl_FragColor = vec4(1.0); }';

describe('uniformValueSchema', () => {
  it('accepts a number', () => {
    expect(uniformValueSchema.parse(0.5)).toBe(0.5);
  });
  it('accepts a 1-element vector', () => {
    expect(uniformValueSchema.parse([1])).toEqual([1]);
  });
  it('accepts a 2-element vector', () => {
    expect(uniformValueSchema.parse([1, 2])).toEqual([1, 2]);
  });
  it('accepts a 3-element vector', () => {
    expect(uniformValueSchema.parse([1, 2, 3])).toEqual([1, 2, 3]);
  });
  it('accepts a 4-element vector', () => {
    expect(uniformValueSchema.parse([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });
  it('rejects a 5-element vector', () => {
    expect(() => uniformValueSchema.parse([1, 2, 3, 4, 5])).toThrow();
  });
  it('rejects an empty vector', () => {
    expect(() => uniformValueSchema.parse([])).toThrow();
  });
  it('rejects a string', () => {
    expect(() => uniformValueSchema.parse('not a uniform')).toThrow();
  });
});

describe('shaderClipPropsSchema (T-383 AC #1)', () => {
  it('AC #1 — accepts a complete shader-props payload', () => {
    const parsed = shaderClipPropsSchema.parse({
      fragmentShader: VALID_FRAGMENT,
      initialUniforms: { uFrame: 0, uColor: [1, 0, 0, 1] },
      width: 1280,
      height: 720,
      posterFrame: 12,
    });
    expect(parsed.fragmentShader).toBe(VALID_FRAGMENT);
    expect(parsed.width).toBe(1280);
    expect(parsed.height).toBe(720);
    expect(parsed.posterFrame).toBe(12);
    expect(parsed.initialUniforms.uFrame).toBe(0);
    expect(parsed.initialUniforms.uColor).toEqual([1, 0, 0, 1]);
  });

  it('AC #1 — initialUniforms defaults to {}', () => {
    const parsed = shaderClipPropsSchema.parse({
      fragmentShader: VALID_FRAGMENT,
      width: 100,
      height: 100,
    });
    expect(parsed.initialUniforms).toEqual({});
  });

  it('AC #1 — posterFrame defaults to 0', () => {
    const parsed = shaderClipPropsSchema.parse({
      fragmentShader: VALID_FRAGMENT,
      width: 100,
      height: 100,
    });
    expect(parsed.posterFrame).toBe(0);
  });

  it('AC #2 — empty fragmentShader throws', () => {
    expect(() =>
      shaderClipPropsSchema.parse({
        fragmentShader: '',
        width: 100,
        height: 100,
      }),
    ).toThrow(/non-empty GLSL/);
  });

  it('AC #3 — width=0 throws', () => {
    expect(() =>
      shaderClipPropsSchema.parse({
        fragmentShader: VALID_FRAGMENT,
        width: 0,
        height: 100,
      }),
    ).toThrow(/width/);
  });

  it('AC #3 — width=-1 throws', () => {
    expect(() =>
      shaderClipPropsSchema.parse({
        fragmentShader: VALID_FRAGMENT,
        width: -1,
        height: 100,
      }),
    ).toThrow(/width/);
  });

  it('AC #3 — height=0 throws', () => {
    expect(() =>
      shaderClipPropsSchema.parse({
        fragmentShader: VALID_FRAGMENT,
        width: 100,
        height: 0,
      }),
    ).toThrow(/height/);
  });

  it('AC #3 — non-integer width throws', () => {
    expect(() =>
      shaderClipPropsSchema.parse({
        fragmentShader: VALID_FRAGMENT,
        width: 1.5,
        height: 100,
      }),
    ).toThrow();
  });

  it('rejects extra top-level fields (strict)', () => {
    expect(() =>
      shaderClipPropsSchema.parse({
        fragmentShader: VALID_FRAGMENT,
        width: 100,
        height: 100,
        sneaky: true,
      }),
    ).toThrow();
  });

  it('rejects negative posterFrame', () => {
    expect(() =>
      shaderClipPropsSchema.parse({
        fragmentShader: VALID_FRAGMENT,
        width: 100,
        height: 100,
        posterFrame: -1,
      }),
    ).toThrow();
  });

  it('rejects non-integer posterFrame', () => {
    expect(() =>
      shaderClipPropsSchema.parse({
        fragmentShader: VALID_FRAGMENT,
        width: 100,
        height: 100,
        posterFrame: 1.5,
      }),
    ).toThrow();
  });
});
