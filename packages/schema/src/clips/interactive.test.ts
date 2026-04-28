// packages/schema/src/clips/interactive.test.ts
// Schema tests for InteractiveClip + Permission + ComponentRef (T-305 ACs #1–#9).
// Per ADR-003 §D2/§D4 and ADR-005 §D1 — the type-level invariant for the
// interactive runtime tier. Tests are written first; implementation makes
// them pass.

import { describe, expect, it } from 'vitest';

import {
  type InteractiveClip,
  componentRefSchema,
  interactiveClipSchema,
  permissionSchema,
} from './interactive.js';

const VALID_FALLBACK = [
  {
    id: 'el_static_1',
    transform: { x: 0, y: 0, width: 1280, height: 720 },
    type: 'text',
    text: 'static fallback',
  },
];

const VALID: InteractiveClip = {
  id: 'el_interactive_1',
  transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
  type: 'interactive-clip',
  family: 'shader',
  staticFallback: VALID_FALLBACK as never,
  liveMount: {
    component: { module: '@stageflip/runtimes-interactive/clips/shader#ShaderClip' },
    props: { uniforms: { uFrame: 0 } },
    permissions: [],
  },
};

describe('permissionSchema (T-305 AC #7, ADR-003 §D4)', () => {
  it('accepts mic', () => {
    expect(permissionSchema.parse('mic')).toBe('mic');
  });
  it('accepts network', () => {
    expect(permissionSchema.parse('network')).toBe('network');
  });
  it('accepts camera', () => {
    expect(permissionSchema.parse('camera')).toBe('camera');
  });
  it('rejects an unknown permission', () => {
    expect(() => permissionSchema.parse('geolocation')).toThrow();
  });
});

describe('componentRefSchema (T-305 AC #5)', () => {
  it('accepts a scoped package + sub-path + PascalCase class', () => {
    const ref = componentRefSchema.parse({
      module: '@stageflip/runtimes-interactive/clips/shader#ShaderClip',
    });
    expect(ref.module).toBe('@stageflip/runtimes-interactive/clips/shader#ShaderClip');
  });
  it('accepts an unscoped package + PascalCase class', () => {
    const ref = componentRefSchema.parse({ module: 'pkg#ClassName' });
    expect(ref.module).toBe('pkg#ClassName');
  });
  it('accepts an optional version pin', () => {
    const ref = componentRefSchema.parse({ module: 'pkg#Class', version: '^1.2.3' });
    expect(ref.version).toBe('^1.2.3');
  });
  it('rejects a string with no class separator', () => {
    expect(() => componentRefSchema.parse({ module: 'just-a-string' })).toThrow();
  });
  it('rejects a lowercase class name', () => {
    expect(() => componentRefSchema.parse({ module: 'pkg#lowercase' })).toThrow();
  });
  it('rejects extra fields (strict)', () => {
    expect(() =>
      componentRefSchema.parse({ module: 'pkg#Class', extra: true } as unknown as {
        module: string;
      }),
    ).toThrow();
  });
});

describe('interactiveClipSchema (T-305 ACs #1–#4, #6, #8, #9)', () => {
  it('AC #1 — accepts a complete InteractiveClip', () => {
    const parsed = interactiveClipSchema.parse(VALID);
    expect(parsed.type).toBe('interactive-clip');
    expect(parsed.family).toBe('shader');
    expect(parsed.liveMount.permissions).toEqual([]);
  });
  it('AC #2 — empty staticFallback throws with the spec min(1) message', () => {
    expect(() =>
      interactiveClipSchema.parse({ ...VALID, staticFallback: [] }),
    ).toThrow(/non-empty staticFallback/);
  });
  it('AC #3 — missing liveMount throws', () => {
    const { liveMount: _omitted, ...withoutLiveMount } = VALID;
    expect(() =>
      interactiveClipSchema.parse(withoutLiveMount as unknown as InteractiveClip),
    ).toThrow();
  });
  it('AC #4 — unknown family throws (closed enum)', () => {
    expect(() =>
      interactiveClipSchema.parse({
        ...VALID,
        family: 'unknown' as InteractiveClip['family'],
      }),
    ).toThrow();
  });
  it('AC #4 — accepts each of the 7 frontier families', () => {
    const families: InteractiveClip['family'][] = [
      'shader',
      'three-scene',
      'voice',
      'ai-chat',
      'live-data',
      'web-embed',
      'ai-generative',
    ];
    for (const family of families) {
      const parsed = interactiveClipSchema.parse({ ...VALID, family });
      expect(parsed.family).toBe(family);
    }
  });
  it('AC #6 — permissions defaults to [] when omitted', () => {
    const parsed = interactiveClipSchema.parse({
      ...VALID,
      liveMount: {
        component: VALID.liveMount.component,
        props: VALID.liveMount.props,
      },
    });
    expect(parsed.liveMount.permissions).toEqual([]);
  });
  it('AC #7 — accepts all three declared permissions', () => {
    const parsed = interactiveClipSchema.parse({
      ...VALID,
      liveMount: {
        ...VALID.liveMount,
        permissions: ['mic', 'network', 'camera'],
      },
    });
    expect(parsed.liveMount.permissions).toEqual(['mic', 'network', 'camera']);
  });
  it('AC #7 — rejects an unknown permission inside liveMount', () => {
    expect(() =>
      interactiveClipSchema.parse({
        ...VALID,
        liveMount: {
          ...VALID.liveMount,
          permissions: ['gps' as never],
        },
      }),
    ).toThrow();
  });
  it('AC #8 — posterFrame is optional; omission OK', () => {
    const parsed = interactiveClipSchema.parse(VALID);
    expect(parsed.posterFrame).toBeUndefined();
  });
  it('AC #8 — posterFrame accepts a non-negative integer', () => {
    const parsed = interactiveClipSchema.parse({ ...VALID, posterFrame: 12 });
    expect(parsed.posterFrame).toBe(12);
  });
  it('AC #8 — posterFrame negative throws', () => {
    expect(() => interactiveClipSchema.parse({ ...VALID, posterFrame: -1 })).toThrow();
  });
  it('AC #8 — posterFrame non-integer throws', () => {
    expect(() => interactiveClipSchema.parse({ ...VALID, posterFrame: 1.5 })).toThrow();
  });
  it('AC #9 — liveMount.props accepts arbitrary record', () => {
    const parsed = interactiveClipSchema.parse({
      ...VALID,
      liveMount: {
        ...VALID.liveMount,
        props: { anyKey: 'anyValue', nested: { deep: [1, 2, 3] }, n: 42 },
      },
    });
    expect(parsed.liveMount.props.anyKey).toBe('anyValue');
  });
  it('rejects extra top-level fields (strict)', () => {
    expect(() =>
      interactiveClipSchema.parse({ ...VALID, extra: true } as unknown as InteractiveClip),
    ).toThrow();
  });
  it('rejects extra liveMount fields (strict)', () => {
    expect(() =>
      interactiveClipSchema.parse({
        ...VALID,
        liveMount: { ...VALID.liveMount, sneaky: 1 },
      } as unknown as InteractiveClip),
    ).toThrow();
  });
});
