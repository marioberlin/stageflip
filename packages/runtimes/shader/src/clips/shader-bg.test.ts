// packages/runtimes/shader/src/clips/shader-bg.test.ts
// T-131d.2 — shaderBg clip definition + helpers.

import { describe, expect, it } from 'vitest';

import {
  buildShaderBgUniforms,
  composeShaderBgFragment,
  shaderBg,
  shaderBgPropsSchema,
} from './shader-bg.js';

describe('shaderBg — propsSchema', () => {
  it('accepts a minimal glsl body', () => {
    const ok = shaderBgPropsSchema.safeParse({
      glsl: 'void main() { gl_FragColor = vec4(1.0); }',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects an overly-short glsl (< 10 chars)', () => {
    expect(shaderBgPropsSchema.safeParse({ glsl: 'x' }).success).toBe(false);
  });

  it('accepts a scalar uniforms map', () => {
    const ok = shaderBgPropsSchema.safeParse({
      glsl: 'void main() { gl_FragColor = vec4(u_speed); }',
      uniforms: { u_speed: 0.5, u_intensity: 1.25 },
    });
    expect(ok.success).toBe(true);
  });

  it('rejects unknown props (strict mode)', () => {
    expect(shaderBgPropsSchema.safeParse({ glsl: 'void main() {}', bogus: 1 }).success).toBe(false);
  });
});

describe('composeShaderBgFragment', () => {
  it('prepends the standard header (precision + u_time + u_resolution)', () => {
    const fragment = composeShaderBgFragment({ glsl: 'void main() {}' });
    expect(fragment).toContain('precision mediump float;');
    expect(fragment).toContain('varying vec2 v_uv;');
    expect(fragment).toContain('uniform float u_time;');
    expect(fragment).toContain('uniform vec2 u_resolution;');
    expect(fragment.trim().endsWith('void main() {}')).toBe(true);
  });

  it('adds a uniform declaration for each user-supplied key, sorted', () => {
    const fragment = composeShaderBgFragment({
      glsl: 'void main() {}',
      uniforms: { u_z: 1, u_a: 2, u_m: 3 },
    });
    const uniformLines = fragment.split('\n').filter((l) => l.startsWith('uniform float u_'));
    // Expect: u_time, then sorted user names u_a, u_m, u_z.
    expect(uniformLines).toEqual([
      'uniform float u_time;',
      'uniform float u_a;',
      'uniform float u_m;',
      'uniform float u_z;',
    ]);
  });

  it('drops keys that are not valid GLSL identifiers', () => {
    const fragment = composeShaderBgFragment({
      glsl: 'void main() {}',
      uniforms: {
        '1bad': 1,
        'bad-name': 2,
        'bad name': 3,
        '': 4,
        good: 5,
      },
    });
    expect(fragment).toContain('uniform float good;');
    expect(fragment).not.toMatch(/uniform float 1bad/);
    expect(fragment).not.toMatch(/uniform float bad-name/);
    expect(fragment).not.toMatch(/uniform float bad name/);
  });
});

describe('buildShaderBgUniforms', () => {
  it('always emits u_time + u_resolution', () => {
    const u = buildShaderBgUniforms(1.5, [1920, 1080], {});
    expect(u.u_time).toBe(1.5);
    expect(u.u_resolution).toEqual([1920, 1080]);
  });

  it('merges valid user scalars alongside the standard uniforms', () => {
    const u = buildShaderBgUniforms(0, [100, 100], { u_speed: 0.5, u_scale: 2 });
    expect(u.u_speed).toBe(0.5);
    expect(u.u_scale).toBe(2);
  });

  it('drops invalid identifier keys', () => {
    const u = buildShaderBgUniforms(0, [100, 100], {
      '1bad': 9,
      'bad-name': 9,
      good: 7,
    });
    expect(u.good).toBe(7);
    expect('1bad' in u).toBe(false);
    expect('bad-name' in u).toBe(false);
  });
});

describe('shaderBg clip definition (T-131d.2)', () => {
  it("registers under kind 'shader-bg' with a propsSchema", () => {
    expect(shaderBg.kind).toBe('shader-bg');
    expect(shaderBg.propsSchema).toBe(shaderBgPropsSchema);
  });

  it('declares no themeSlots (shader output is fully deterministic per props)', () => {
    expect(shaderBg.themeSlots).toBeUndefined();
  });

  it('provides a render function (user-shader variant defers validation)', () => {
    expect(typeof shaderBg.render).toBe('function');
  });
});
