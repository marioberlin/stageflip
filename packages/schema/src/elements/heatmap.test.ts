// packages/schema/src/elements/heatmap.test.ts
// T-469 — Schema-side roundtrip + reject-malformed tests for the
// `HeatmapClipElement` RIRElement variant. Ninth audience-clip variant
// on the `Element` discriminated union; FIRST marquee differentiator.

import { describe, expect, it } from 'vitest';

import { type HeatmapClipElement, heatmapClipElementSchema } from './heatmap.js';

const BASE = {
  id: 'el_hm_001',
  transform: { x: 0, y: 0, width: 800, height: 600 },
} as const;

const VALID: HeatmapClipElement = {
  ...BASE,
  visible: true,
  locked: false,
  animations: [],
  type: 'heatmap',
  permissions: ['audience-network'],
  props: {
    prompt: 'Tap where you focus',
    imageRef: 'https://example.com/image.png',
    maxIntensity: 5,
    gridResolution: { w: 32, h: 32 },
  },
};

describe('heatmapClipElementSchema (T-469)', () => {
  it('parses a minimal valid element with default maxIntensity + gridResolution', () => {
    const parsed = heatmapClipElementSchema.parse({
      ...BASE,
      visible: true,
      locked: false,
      animations: [],
      type: 'heatmap',
      permissions: ['audience-network'],
      props: {
        prompt: 'Where?',
        imageRef: 'https://example.com/img.png',
      },
    });
    expect(parsed.type).toBe('heatmap');
    expect(parsed.props.maxIntensity).toBe(1);
    expect(parsed.props.gridResolution).toEqual({ w: 32, h: 32 });
    expect(parsed.permissions).toEqual(['audience-network']);
  });

  it('parses a fully-specified element', () => {
    const parsed = heatmapClipElementSchema.parse(VALID);
    expect(parsed.props.prompt).toBe('Tap where you focus');
    expect(parsed.props.imageRef).toBe('https://example.com/image.png');
    expect(parsed.props.maxIntensity).toBe(5);
    expect(parsed.props.gridResolution).toEqual({ w: 32, h: 32 });
  });

  it('accepts a cacheKey:-prefixed imageRef', () => {
    const parsed = heatmapClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, imageRef: 'cacheKey:abc-123' },
    });
    expect(parsed.props.imageRef).toBe('cacheKey:abc-123');
  });

  it('accepts a custom gridResolution', () => {
    const parsed = heatmapClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, gridResolution: { w: 64, h: 48 } },
    });
    expect(parsed.props.gridResolution).toEqual({ w: 64, h: 48 });
  });

  it('accepts an optional sessionId on props', () => {
    const parsed = heatmapClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, sessionId: 'sess-abc' },
    });
    expect(parsed.props.sessionId).toBe('sess-abc');
  });

  it('round-trips byte-equal', () => {
    const once = heatmapClipElementSchema.parse(VALID);
    const twice = heatmapClipElementSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('accepts optional provenance', () => {
    const parsed = heatmapClipElementSchema.parse({
      ...VALID,
      provenance: {
        provider: 'audience-native',
        sessionId: 'sess-1',
        snapshotFrame: 0,
        voterCountAtCapture: 12,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'heatmap',
        aggregation: {
          kind: 'heatmap',
          taps: [{ x: 0.5, y: 0.5, intensity: 1 }],
          totalTaps: 1,
          gridResolution: { w: 32, h: 32 },
        },
      },
    });
    expect(parsed.provenance?.aggregation.kind).toBe('heatmap');
  });

  // --- malformed rejection ---

  it('rejects empty prompt', () => {
    expect(() =>
      heatmapClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, prompt: '' },
      }),
    ).toThrow();
  });

  it('rejects empty imageRef', () => {
    expect(() =>
      heatmapClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, imageRef: '' },
      }),
    ).toThrow();
  });

  it('rejects maxIntensity === 0', () => {
    expect(() =>
      heatmapClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, maxIntensity: 0 },
      }),
    ).toThrow();
  });

  it('rejects maxIntensity > 20', () => {
    expect(() =>
      heatmapClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, maxIntensity: 21 },
      }),
    ).toThrow();
  });

  it('rejects non-integer maxIntensity', () => {
    expect(() =>
      heatmapClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, maxIntensity: 1.5 },
      }),
    ).toThrow();
  });

  it('rejects gridResolution.w === 0', () => {
    expect(() =>
      heatmapClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, gridResolution: { w: 0, h: 32 } },
      }),
    ).toThrow();
  });

  it('rejects gridResolution.h > 256', () => {
    expect(() =>
      heatmapClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, gridResolution: { w: 32, h: 257 } },
      }),
    ).toThrow();
  });

  it('rejects non-integer gridResolution', () => {
    expect(() =>
      heatmapClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, gridResolution: { w: 32.5, h: 32 } },
      }),
    ).toThrow();
  });

  it('rejects empty sessionId', () => {
    expect(() =>
      heatmapClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, sessionId: '' },
      }),
    ).toThrow();
  });

  it('rejects a wrong permissions tuple', () => {
    expect(() =>
      heatmapClipElementSchema.parse({
        ...VALID,
        permissions: ['network'] as unknown as HeatmapClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects extra permissions entries', () => {
    expect(() =>
      heatmapClipElementSchema.parse({
        ...VALID,
        permissions: ['audience-network', 'mic'] as unknown as HeatmapClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects unknown top-level discriminator', () => {
    expect(() =>
      heatmapClipElementSchema.parse({
        ...VALID,
        type: 'survey' as 'heatmap',
      }),
    ).toThrow();
  });

  it('rejects unknown extra fields (strict)', () => {
    expect(() =>
      heatmapClipElementSchema.parse({
        ...VALID,
        unknownField: 'oops',
      } as unknown as HeatmapClipElement),
    ).toThrow();
  });

  it('rejects unknown extra fields on props (strict)', () => {
    expect(() =>
      heatmapClipElementSchema.parse({
        ...VALID,
        props: {
          ...VALID.props,
          unknownField: 'x',
        } as unknown as HeatmapClipElement['props'],
      }),
    ).toThrow();
  });

  it('rejects unknown extra fields on gridResolution (strict)', () => {
    expect(() =>
      heatmapClipElementSchema.parse({
        ...VALID,
        props: {
          ...VALID.props,
          gridResolution: { w: 32, h: 32, extra: 1 } as unknown as { w: number; h: number },
        },
      }),
    ).toThrow();
  });
});
