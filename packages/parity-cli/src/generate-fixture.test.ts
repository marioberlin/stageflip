// packages/parity-cli/src/generate-fixture.test.ts
// Tests for the production-renderer binding (T-359a). Uses a stub
// `PrimeRenderFn` (no Chrome / ffmpeg dependency).

import { rirDocumentSchema } from '@stageflip/rir';
import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_CLIP_KIND_RESOLVER,
  F1_SECTOR_STATE_COLORS,
  GenerateFixtureUnavailableError,
  type PresetForRender,
  buildPresetDocument,
  createGenerateFixtureRenderer,
} from './generate-fixture.js';

const COMPOSITION = {
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 150,
} as const;

function presetWith(clipKind: string, id = 'demo', cluster = 'data'): PresetForRender {
  return { frontmatter: { id, cluster, clipKind } };
}

describe('DEFAULT_CLIP_KIND_RESOLVER', () => {
  it('resolves bigNumber to animated-value on the frame-runtime (D-T359a-4)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('bigNumber');
    expect(binding).toBeDefined();
    expect(binding?.runtimeId).toBe('frame-runtime');
    expect(binding?.clipName).toBe('animated-value');
  });

  it('returns undefined for unknown clipKinds (D-T359a-4)', () => {
    expect(DEFAULT_CLIP_KIND_RESOLVER('mysteryKind')).toBeUndefined();
  });

  it('builds bigNumber props with the variant-mapped F1 state color', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('bigNumber');
    if (!binding) throw new Error('test setup');
    const session = binding.buildProps('sessionBest');
    expect(session.color).toBe(F1_SECTOR_STATE_COLORS.sessionBest);
    expect(session.value).toBe(21.412);
    expect(session.decimals).toBe(3);
    expect(session.fontWeight).toBe(700);

    const personal = binding.buildProps('personalBest');
    expect(personal.color).toBe(F1_SECTOR_STATE_COLORS.personalBest);
    const neutral = binding.buildProps('neutral');
    expect(neutral.color).toBe(F1_SECTOR_STATE_COLORS.neutral);
  });

  it('omits color when variant is undefined (single-variant legacy)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('bigNumber');
    if (!binding) throw new Error('test setup');
    const props = binding.buildProps(undefined);
    expect(props.color).toBeUndefined();
  });

  it('omits color when variant is unknown (defensive)', () => {
    const binding = DEFAULT_CLIP_KIND_RESOLVER('bigNumber');
    if (!binding) throw new Error('test setup');
    const props = binding.buildProps('unknownVariant');
    expect(props.color).toBeUndefined();
  });
});

describe('buildPresetDocument', () => {
  it('produces a Zod-valid RIRDocument', () => {
    const doc = buildPresetDocument({
      preset: presetWith('bigNumber', 'f1-sector', 'data'),
      composition: COMPOSITION,
      binding: {
        runtimeId: 'frame-runtime',
        clipName: 'animated-value',
        buildProps: () => ({ value: 1 }),
      },
      props: { value: 21.412, decimals: 3 },
      variant: 'sessionBest',
    });
    expect(() => rirDocumentSchema.parse(doc)).not.toThrow();
  });

  it('includes the variant in the generated document id', () => {
    const doc = buildPresetDocument({
      preset: presetWith('bigNumber', 'f1-sector'),
      composition: COMPOSITION,
      binding: {
        runtimeId: 'frame-runtime',
        clipName: 'animated-value',
        buildProps: () => ({}),
      },
      props: {},
      variant: 'sessionBest',
    });
    expect(doc.id).toContain('f1-sector');
    expect(doc.id).toContain('sessionBest');
  });

  it('omits the variant suffix from the document id when variant is unset', () => {
    const doc = buildPresetDocument({
      preset: presetWith('bigNumber', 'cnn-classic'),
      composition: COMPOSITION,
      binding: {
        runtimeId: 'frame-runtime',
        clipName: 'animated-value',
        buildProps: () => ({}),
      },
      props: {},
    });
    expect(doc.id).toBe('preset-cnn-classic');
  });

  it('places the resolved props into the clip element params', () => {
    const doc = buildPresetDocument({
      preset: presetWith('bigNumber', 'demo'),
      composition: COMPOSITION,
      binding: {
        runtimeId: 'frame-runtime',
        clipName: 'animated-value',
        buildProps: () => ({}),
      },
      props: { value: 99, color: '#abcdef' },
    });
    const element = doc.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.params).toEqual({ value: 99, color: '#abcdef' });
    expect(element.content.runtime).toBe('frame-runtime');
    expect(element.content.clipName).toBe('animated-value');
  });
});

describe('createGenerateFixtureRenderer', () => {
  it('throws GenerateFixtureUnavailableError on unknown clipKind (AC #10)', async () => {
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: vi.fn(),
    });
    await expect(
      Promise.resolve(
        renderer.render({
          preset: presetWith('totallyMadeUp', 'demo'),
          composition: COMPOSITION,
          frame: 60,
        }),
      ),
    ).rejects.toBeInstanceOf(GenerateFixtureUnavailableError);
  });

  it('error message names the unknown clipKind verbatim (AC #10)', async () => {
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: vi.fn(),
    });
    try {
      await renderer.render({
        preset: presetWith('mysteryKind', 'demo'),
        composition: COMPOSITION,
        frame: 60,
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as Error).message).toContain("no component bound for clipKind 'mysteryKind'");
    }
  });

  it('round-trip: bound stub renderer is called with a valid RIRDocument and frame', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([1, 2, 3]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    const png = await renderer.render({
      preset: presetWith('bigNumber', 'f1-sector'),
      composition: COMPOSITION,
      frame: 60,
      variant: 'sessionBest',
    });
    expect(Array.from(png)).toEqual([1, 2, 3]);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    const [doc, frame] = renderSpy.mock.calls[0] ?? [];
    expect(frame).toBe(60);
    expect(() => rirDocumentSchema.parse(doc)).not.toThrow();
  });

  it('passes variant-derived props into the RIRDocument', async () => {
    const renderSpy = vi
      .fn<(doc: unknown, frame: number) => Promise<Uint8Array>>()
      .mockResolvedValue(new Uint8Array([0]));
    const renderer = createGenerateFixtureRenderer({
      resolver: DEFAULT_CLIP_KIND_RESOLVER,
      render: renderSpy as unknown as Parameters<typeof createGenerateFixtureRenderer>[0]['render'],
    });
    await renderer.render({
      preset: presetWith('bigNumber', 'f1-sector'),
      composition: COMPOSITION,
      frame: 60,
      variant: 'personalBest',
    });
    const [doc] = renderSpy.mock.calls[0] ?? [];
    const parsed = rirDocumentSchema.parse(doc);
    const element = parsed.elements[0];
    if (!element || element.content.type !== 'clip') throw new Error('expected clip element');
    expect(element.content.params).toMatchObject({
      color: F1_SECTOR_STATE_COLORS.personalBest,
    });
  });
});
