// packages/runtimes/contract/src/index.test.ts
// Unit tests for the ClipRuntime contract + registry.

import type { Theme } from '@stageflip/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  type ClipDefinition,
  type ClipRuntime,
  type ThemeSlot,
  __clearRuntimeRegistry,
  findClip,
  getRuntime,
  listRuntimes,
  registerRuntime,
  resolveClipDefaultsForTheme,
  unregisterRuntime,
} from './index.js';

beforeEach(() => {
  __clearRuntimeRegistry();
});

afterEach(() => {
  __clearRuntimeRegistry();
});

function makeRuntime(
  id: string,
  tier: 'live' | 'bake' = 'live',
  clips: Array<ClipDefinition<unknown>> = [],
): ClipRuntime {
  return {
    id,
    tier,
    clips: new Map(clips.map((c) => [c.kind, c])),
  };
}

function makeClip<P = unknown>(kind: string): ClipDefinition<P> {
  return {
    kind,
    render: () => null,
  };
}

describe('registerRuntime / getRuntime / listRuntimes', () => {
  it('round-trips a registered runtime', () => {
    const rt = makeRuntime('css');
    registerRuntime(rt);
    expect(getRuntime('css')).toBe(rt);
  });

  it('lists all registered runtimes', () => {
    registerRuntime(makeRuntime('css'));
    registerRuntime(makeRuntime('gsap'));
    const ids = listRuntimes().map((r) => r.id);
    expect(ids).toContain('css');
    expect(ids).toContain('gsap');
  });

  it('unregisterRuntime removes the entry', () => {
    registerRuntime(makeRuntime('css'));
    unregisterRuntime('css');
    expect(getRuntime('css')).toBeUndefined();
  });

  it('duplicate id on register throws', () => {
    registerRuntime(makeRuntime('css'));
    expect(() => registerRuntime(makeRuntime('css'))).toThrow(/already registered/);
  });
});

describe('registerRuntime — validation', () => {
  it('throws on empty id', () => {
    expect(() => registerRuntime(makeRuntime(''))).toThrow(/id.*non-empty/);
  });

  it('throws on unknown tier', () => {
    const rt = { ...makeRuntime('custom'), tier: 'server' as unknown as 'live' };
    expect(() => registerRuntime(rt as ClipRuntime)).toThrow(/tier/);
  });

  it('accepts both live and bake tiers', () => {
    registerRuntime(makeRuntime('css', 'live'));
    registerRuntime(makeRuntime('blender', 'bake'));
    expect(getRuntime('css')?.tier).toBe('live');
    expect(getRuntime('blender')?.tier).toBe('bake');
  });

  it('throws if clips keys disagree with ClipDefinition.kind', () => {
    const clip = makeClip('motion-text-gsap');
    const rt: ClipRuntime = {
      id: 'gsap',
      tier: 'live',
      clips: new Map([['mismatched-key', clip]]),
    };
    expect(() => registerRuntime(rt)).toThrow(/kind/);
  });
});

describe('findClip — cross-runtime lookup by kind', () => {
  it('returns the ClipDefinition + owning runtime when the kind exists', () => {
    const clip = makeClip('lottie-logo');
    const lottie = makeRuntime('lottie', 'live', [clip]);
    registerRuntime(lottie);

    const found = findClip('lottie-logo');
    expect(found).not.toBeNull();
    expect(found?.runtime).toBe(lottie);
    expect(found?.clip).toBe(clip);
  });

  it('returns null when the kind is not registered', () => {
    registerRuntime(makeRuntime('css'));
    expect(findClip('nonexistent')).toBeNull();
  });

  it('prefers the first registered runtime when two runtimes declare the same kind', () => {
    const a = makeClip('shared');
    const b = makeClip('shared');
    registerRuntime(makeRuntime('first', 'live', [a]));
    registerRuntime(makeRuntime('second', 'live', [b]));
    const found = findClip('shared');
    expect(found?.clip).toBe(a);
    expect(found?.runtime.id).toBe('first');
  });
});

describe('ClipDefinition — optional hooks', () => {
  it('stores fontRequirements when declared', () => {
    const clip: ClipDefinition<{ family: string }> = {
      kind: 'text',
      render: () => null,
      fontRequirements: (props) => [{ family: props.family }],
    };
    expect(clip.fontRequirements?.({ family: 'Inter' })).toEqual([{ family: 'Inter' }]);
  });

  it('propsSchema is optional and carries a ZodType when declared (T-125b)', () => {
    const schema = z.object({ label: z.string() });
    const clip: ClipDefinition<z.infer<typeof schema>> = {
      kind: 'text-label',
      render: () => null,
      propsSchema: schema,
    };
    const runtime = makeRuntime('t125b', 'live', [clip as ClipDefinition<unknown>]);
    registerRuntime(runtime);
    const found = findClip('text-label');
    expect(found?.clip.propsSchema).toBe(schema);
    expect(found?.clip.propsSchema?.safeParse({ label: 'ok' }).success).toBe(true);
  });

  it('propsSchema absent does not affect registration', () => {
    const clip = makeClip('no-schema');
    const runtime = makeRuntime('no-schema-runtime', 'live', [clip]);
    expect(() => registerRuntime(runtime)).not.toThrow();
    expect(findClip('no-schema')?.clip.propsSchema).toBeUndefined();
  });

  it('prepare / dispose are optional on ClipRuntime', () => {
    const rt: ClipRuntime = {
      id: 'minimal',
      tier: 'live',
      clips: new Map(),
    };
    registerRuntime(rt);
    expect(getRuntime('minimal')?.prepare).toBeUndefined();
    expect(getRuntime('minimal')?.dispose).toBeUndefined();
  });
});

describe('listRuntimes — snapshot, not live view', () => {
  it('returns a snapshot that does not reflect later changes', () => {
    registerRuntime(makeRuntime('a'));
    const snap = listRuntimes();
    registerRuntime(makeRuntime('b'));
    expect(snap.map((r) => r.id)).toEqual(['a']);
  });
});

describe('themeSlots — declaration round-trips through the registry (T-131a)', () => {
  it('preserves themeSlots across registration + findClip', () => {
    const slots: Record<string, ThemeSlot> = {
      bg: { kind: 'palette', role: 'primary' },
      fg: { kind: 'token', path: 'color.brand.lime' },
    };
    const clip: ClipDefinition<{ bg?: string; fg?: string }> = {
      kind: 'themed',
      render: () => null,
      themeSlots: slots,
    };
    const runtime = makeRuntime('themed-rt', 'live', [clip as ClipDefinition<unknown>]);
    registerRuntime(runtime);
    expect(findClip('themed')?.clip.themeSlots).toBe(slots);
  });

  it('absent themeSlots leaves the field undefined', () => {
    const clip = makeClip('no-slots');
    expect(clip.themeSlots).toBeUndefined();
  });
});

describe('resolveClipDefaultsForTheme (T-131a)', () => {
  const theme: Theme = {
    palette: {
      primary: '#0a84ff',
      secondary: '#34c759',
      background: '#0c1116',
    },
    tokens: {
      'color.brand.lime': '#c8ff00',
      'spacing.gutter': '24',
    },
  };

  it('fills an undefined prop from the palette role declared in themeSlots', () => {
    const clip: ClipDefinition<{ bg?: string }> = {
      kind: 'fill-bg',
      render: () => null,
      themeSlots: { bg: { kind: 'palette', role: 'primary' } },
    };
    const out = resolveClipDefaultsForTheme(clip, theme, {});
    expect(out.bg).toBe('#0a84ff');
  });

  it('fills an undefined prop from a theme token path', () => {
    const clip: ClipDefinition<{ accent?: string }> = {
      kind: 'fill-accent',
      render: () => null,
      themeSlots: { accent: { kind: 'token', path: 'color.brand.lime' } },
    };
    const out = resolveClipDefaultsForTheme(clip, theme, {});
    expect(out.accent).toBe('#c8ff00');
  });

  it('an explicit prop value always wins over the theme', () => {
    const clip: ClipDefinition<{ bg?: string }> = {
      kind: 'fill-bg-explicit',
      render: () => null,
      themeSlots: { bg: { kind: 'palette', role: 'primary' } },
    };
    const out = resolveClipDefaultsForTheme(clip, theme, { bg: '#ff00aa' });
    expect(out.bg).toBe('#ff00aa');
  });

  it('a slot with no value in the theme leaves the prop undefined', () => {
    const clip: ClipDefinition<{ accent?: string }> = {
      kind: 'fill-missing',
      render: () => null,
      themeSlots: { accent: { kind: 'palette', role: 'accent' } },
    };
    const out = resolveClipDefaultsForTheme(clip, theme, {});
    expect(out.accent).toBeUndefined();
  });

  it('returns the input unchanged (by reference) when themeSlots is absent', () => {
    const clip: ClipDefinition<{ bg?: string }> = {
      kind: 'no-slots',
      render: () => null,
    };
    const props = { bg: '#000000' };
    expect(resolveClipDefaultsForTheme(clip, theme, props)).toBe(props);
  });

  it('an empty themeSlots map returns a new object (not identity) — identity fast path is reserved for the absent case', () => {
    const clip: ClipDefinition<{ bg?: string }> = {
      kind: 'empty-slots',
      render: () => null,
      themeSlots: {},
    };
    const props = { bg: '#000000' };
    const out = resolveClipDefaultsForTheme(clip, theme, props);
    expect(out).not.toBe(props);
    expect(out).toEqual(props);
  });

  it('returns a new object — does not mutate the input props', () => {
    const clip: ClipDefinition<{ bg?: string }> = {
      kind: 'fresh-out',
      render: () => null,
      themeSlots: { bg: { kind: 'palette', role: 'primary' } },
    };
    const input = {} as { bg?: string };
    const out = resolveClipDefaultsForTheme(clip, theme, input);
    expect(out).not.toBe(input);
    expect(input.bg).toBeUndefined();
  });

  it('only fills the slots declared on the clip — leaves undeclared undefined props alone', () => {
    const clip: ClipDefinition<{ bg?: string; fg?: string }> = {
      kind: 'partial',
      render: () => null,
      themeSlots: { bg: { kind: 'palette', role: 'primary' } },
    };
    const out = resolveClipDefaultsForTheme(clip, theme, {});
    expect(out.bg).toBe('#0a84ff');
    expect(out.fg).toBeUndefined();
  });
});
