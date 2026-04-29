// packages/runtimes/interactive/src/clips/shader/uniforms.test.ts
// T-383 AC #13/#14 ancillary — `defaultShaderUniforms` correctness.

import { describe, expect, it } from 'vitest';

import type { ShaderClipProps } from './props.js';
import { defaultShaderUniforms } from './uniforms.js';

const FRAGMENT = 'precision highp float; void main(){}';

function makeProps(overrides: Partial<ShaderClipProps> = {}): ShaderClipProps {
  return {
    fragmentShader: FRAGMENT,
    initialUniforms: {},
    width: 1280,
    height: 720,
    posterFrame: 0,
    ...overrides,
  };
}

describe('defaultShaderUniforms', () => {
  it('maps frame → uFrame, uTime, uResolution', () => {
    const u = defaultShaderUniforms(60, {
      fps: 30,
      resolution: [1920, 1080],
      props: makeProps(),
    });
    expect(u.uFrame).toBe(60);
    expect(u.uTime).toBe(2);
    expect(u.uResolution).toEqual([1920, 1080]);
  });

  it('uTime computed from frame / fps', () => {
    const u = defaultShaderUniforms(15, {
      fps: 30,
      resolution: [100, 100],
      props: makeProps(),
    });
    expect(u.uTime).toBe(0.5);
  });

  it('initialUniforms are merged in (extra static uniforms appear)', () => {
    const u = defaultShaderUniforms(0, {
      fps: 30,
      resolution: [100, 100],
      props: makeProps({ initialUniforms: { uColor: [1, 0, 0, 1], uIntensity: 0.5 } }),
    });
    expect(u.uColor).toEqual([1, 0, 0, 1]);
    expect(u.uIntensity).toBe(0.5);
    // Defaults still present.
    expect(u.uFrame).toBe(0);
  });

  it('default-uniform names override initialUniforms entries with the same key', () => {
    const u = defaultShaderUniforms(42, {
      fps: 30,
      resolution: [100, 100],
      props: makeProps({ initialUniforms: { uFrame: 999 } }),
    });
    // The function spreads initialUniforms first, then defaults — defaults win.
    expect(u.uFrame).toBe(42);
  });

  it('frame=0 produces uTime=0', () => {
    const u = defaultShaderUniforms(0, {
      fps: 60,
      resolution: [10, 10],
      props: makeProps(),
    });
    expect(u.uTime).toBe(0);
  });
});
