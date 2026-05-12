// packages/runtimes/audience/src/clips/heatmap/clip-definition.test.ts
// T-469 — Unit tests for `heatmapClipDefinition`. Verifies the kind
// discriminator, the propsSchema wiring, and the empty-state render
// path (which routes to the "Waiting for taps…" placeholder).

import type { ClipRenderContext } from '@stageflip/runtimes-contract';
import type { HeatmapClipProps } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { HEATMAP_KIND, heatmapClipDefinition } from './clip-definition.js';

const PROPS: HeatmapClipProps = {
  prompt: 'Tap where you focus',
  imageRef: 'https://example.com/img.png',
  maxIntensity: 1,
  gridResolution: { w: 32, h: 32 },
};

const CTX: ClipRenderContext<HeatmapClipProps> = {
  frame: 0,
  fps: 30,
  width: 800,
  height: 600,
  clipFrom: 0,
  clipDurationInFrames: 90,
  props: PROPS,
};

describe('heatmapClipDefinition', () => {
  it('declares kind === "heatmap"', () => {
    expect(heatmapClipDefinition.kind).toBe('heatmap');
    expect(HEATMAP_KIND).toBe('heatmap');
  });

  it('exposes a propsSchema that accepts a valid props value', () => {
    const schema = heatmapClipDefinition.propsSchema;
    expect(schema).toBeDefined();
    const parsed = schema?.parse(PROPS);
    expect(parsed?.prompt).toBe('Tap where you focus');
    expect(parsed?.imageRef).toBe('https://example.com/img.png');
  });

  it('propsSchema rejects empty prompt', () => {
    const schema = heatmapClipDefinition.propsSchema;
    expect(() => schema?.parse({ ...PROPS, prompt: '' })).toThrow();
  });

  it('propsSchema rejects empty imageRef', () => {
    const schema = heatmapClipDefinition.propsSchema;
    expect(() => schema?.parse({ ...PROPS, imageRef: '' })).toThrow();
  });

  it('propsSchema rejects maxIntensity > 20', () => {
    const schema = heatmapClipDefinition.propsSchema;
    expect(() => schema?.parse({ ...PROPS, maxIntensity: 21 })).toThrow();
  });

  it('propsSchema accepts cacheKey:-prefixed imageRef', () => {
    const schema = heatmapClipDefinition.propsSchema;
    const parsed = schema?.parse({ ...PROPS, imageRef: 'cacheKey:abc-123' });
    expect(parsed?.imageRef).toBe('cacheKey:abc-123');
  });

  it('render returns a React tree (the "Waiting…" placeholder for empty state)', () => {
    const out = heatmapClipDefinition.render(CTX);
    expect(out).not.toBeNull();
    if (out === null) return;
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe('heatmap');
    expect((out.props as { 'data-state': string })['data-state']).toBe('waiting');
  });
});
