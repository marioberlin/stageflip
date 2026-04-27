// packages/design-system/src/test-helpers.ts
// Shared test scaffolding for the design-system pipeline. NOT exported from
// index.ts — internal test-only.

import type { Document, ShapeKind, Slide } from '@stageflip/schema';
import type { LearnThemeOptions, PipelineState } from './types.js';

interface SlideSpec {
  id?: string;
  fills?: string[];
  strokes?: string[];
  textColors?: string[];
  background?: string;
  textRuns?: Array<{ family: string; size: number; weight?: number; italic?: boolean }>;
  shapes?: ShapeKind[];
  /** Add explicit element transforms (x/y/width/height) for spacing tests. */
  positions?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    opacity?: number;
  }>;
}

/**
 * Build a minimal canonical Document from slide specs. Each spec emits one
 * shape per fill, one shape per stroke, one text element per textColor, etc.
 * Element ids are deterministic (s<idx>-e<idx>) for fixture stability.
 */
export function makeDoc(slides: SlideSpec[]): Document {
  const slideObjs: Slide[] = slides.map((spec, sIdx) => {
    const id = spec.id ?? `s${sIdx + 1}`;
    const elements: Slide['elements'] = [];
    let elIdx = 0;
    const baseTransform = (i: number) => ({
      x: i * 50,
      y: i * 50,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
    });
    const transformAt = (i: number) => {
      const p = spec.positions?.[i];
      if (!p) return baseTransform(i);
      return {
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        rotation: p.rotation ?? 0,
        opacity: p.opacity ?? 1,
      };
    };
    if (spec.fills) {
      for (const fill of spec.fills) {
        elements.push({
          id: `${id}-e${elIdx++}`,
          type: 'shape',
          shape: spec.shapes?.[elements.length] ?? 'rect',
          fill,
          transform: transformAt(elements.length),
          visible: true,
          locked: false,
          animations: [],
        });
      }
    }
    if (spec.strokes) {
      for (const stroke of spec.strokes) {
        elements.push({
          id: `${id}-e${elIdx++}`,
          type: 'shape',
          shape: 'rect',
          stroke: { color: stroke, width: 1, linecap: 'butt', linejoin: 'miter' },
          transform: transformAt(elements.length),
          visible: true,
          locked: false,
          animations: [],
        });
      }
    }
    if (spec.textColors) {
      for (const color of spec.textColors) {
        elements.push({
          id: `${id}-e${elIdx++}`,
          type: 'text',
          text: 'sample',
          color,
          align: 'left',
          transform: transformAt(elements.length),
          visible: true,
          locked: false,
          animations: [],
        });
      }
    }
    if (spec.textRuns) {
      for (const r of spec.textRuns) {
        elements.push({
          id: `${id}-e${elIdx++}`,
          type: 'text',
          text: 'sample',
          fontFamily: r.family,
          fontSize: r.size,
          align: 'left',
          transform: transformAt(elements.length),
          visible: true,
          locked: false,
          animations: [],
        });
      }
    }
    if (spec.shapes && !spec.fills) {
      for (const shape of spec.shapes) {
        elements.push({
          id: `${id}-e${elIdx++}`,
          type: 'shape',
          shape,
          transform: transformAt(elements.length),
          visible: true,
          locked: false,
          animations: [],
        });
      }
    }
    const slide: Slide = {
      id,
      elements,
    };
    if (spec.background) {
      slide.background = { kind: 'color', value: spec.background };
    }
    return slide;
  });

  return {
    meta: {
      id: 'doc1',
      version: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: { mode: 'slide', slides: slideObjs },
  };
}

/** Build a `PipelineState` for a step-level test. */
export function buildTestState(
  doc: Document,
  overrides: Partial<LearnThemeOptions> = {},
): PipelineState {
  return {
    doc,
    opts: {
      kMeansSeed: overrides.kMeansSeed ?? 42,
      kMeansTargetClusters: overrides.kMeansTargetClusters ?? 8,
      stopAfterStep: overrides.stopAfterStep ?? 8,
      modifiedAt: overrides.modifiedAt ?? '1970-01-01T00:00:00.000Z',
      ...(overrides.fontFetcher !== undefined ? { fontFetcher: overrides.fontFetcher } : {}),
      ...(overrides.storage !== undefined ? { storage: overrides.storage } : {}),
    },
    paletteClusters: [],
    hexSamples: [],
    typographyClusters: [],
    typographySamples: [],
    spacingTokens: {},
    shapeLanguage: { histogram: {} as Record<ShapeKind, number>, coverage: 0 },
    componentLibrary: {},
    fontAssets: {},
    paletteNames: {},
    typographyNames: {},
    lossFlags: [],
    stepDiagnostics: [],
  };
}
