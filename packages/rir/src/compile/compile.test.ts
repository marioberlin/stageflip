// packages/rir/src/compile/compile.test.ts
// Unit tests for the T-030 compile passes + the orchestrator.
// Timing-flatten and stacking-context behaviors are T-031; tests here verify
// that this compiler emits identity timings and all-auto stacking so T-031
// has a clean handoff.

import type { ChartData, Document, FontRequirement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { compileRIR } from './index.js';

const NOW = '2026-04-20T12:00:00.000Z';

const MIN_DOC_BASE = {
  meta: { id: 'd1', version: 0, createdAt: NOW, updatedAt: NOW },
  theme: { tokens: {} },
  variables: {},
  components: {},
} satisfies Partial<Document>;

const BASE_TRANSFORM = { x: 0, y: 0, width: 100, height: 50 };

const buildDoc = (partial: Partial<Document>): Document =>
  ({
    ...MIN_DOC_BASE,
    ...partial,
  }) as Document;

describe('compileRIR — slide mode', () => {
  it('compiles a minimum slide deck with one text element', () => {
    const doc = buildDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            elements: [
              {
                id: 'e1',
                type: 'text',
                transform: BASE_TRANSFORM,
                text: 'Hello',
              },
            ],
          },
        ],
      },
    });
    const { rir, diagnostics } = compileRIR(doc);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(rir.elements).toHaveLength(1);
    expect(rir.elements[0]?.id).toBe('e1');
    expect(rir.elements[0]?.zIndex).toBe(0);
    expect(rir.elements[0]?.stacking).toBe('auto');
    expect(rir.mode).toBe('slide');
    expect(rir.meta.sourceDocId).toBe('d1');
    expect(rir.meta.digest).toMatch(/^[0-9a-f]{8}$/);
  });

  it('assigns zIndex = arrayIndex * 10 across siblings', () => {
    const doc = buildDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's',
            elements: [
              { id: 'a', type: 'text', transform: BASE_TRANSFORM, text: 'a' },
              { id: 'b', type: 'text', transform: BASE_TRANSFORM, text: 'b' },
              { id: 'c', type: 'text', transform: BASE_TRANSFORM, text: 'c' },
            ],
          },
        ],
      },
    });
    const { rir } = compileRIR(doc);
    expect(rir.elements.map((e) => e.zIndex)).toEqual([0, 10, 20]);
  });
});

describe('compileRIR — theme + variable resolution', () => {
  it('resolves `theme:` refs in text color against document.theme.tokens', () => {
    const doc = buildDoc({
      theme: { tokens: { 'color.primary': '#112233' } },
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's',
            elements: [
              {
                id: 't1',
                type: 'text',
                transform: BASE_TRANSFORM,
                text: 'hi',
                color: 'theme:color.primary',
              },
            ],
          },
        ],
      },
    });
    const { rir, diagnostics } = compileRIR(doc);
    expect(diagnostics.filter((d) => d.code === 'theme-token-missing')).toEqual([]);
    expect(rir.elements[0]?.content.type === 'text' && rir.elements[0].content.color).toBe(
      '#112233',
    );
  });

  it('emits theme-token-missing warn and leaves the ref literal', () => {
    const doc = buildDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's',
            elements: [
              {
                id: 't1',
                type: 'text',
                transform: BASE_TRANSFORM,
                text: 'hi',
                color: 'theme:color.unknown',
              },
            ],
          },
        ],
      },
    });
    const { rir, diagnostics } = compileRIR(doc);
    expect(diagnostics.some((d) => d.code === 'theme-token-missing')).toBe(true);
    const content = rir.elements[0]?.content;
    expect(content?.type === 'text' && content.color).toBe('theme:color.unknown');
  });

  it('resolves `{{name}}` placeholders against document.variables', () => {
    const doc = buildDoc({
      variables: { company: 'StageFlip', year: 2026 },
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's',
            elements: [
              {
                id: 't1',
                type: 'text',
                transform: BASE_TRANSFORM,
                text: '{{company}} — {{year}}',
              },
            ],
          },
        ],
      },
    });
    const { rir } = compileRIR(doc);
    const content = rir.elements[0]?.content;
    expect(content?.type === 'text' && content.text).toBe('StageFlip — 2026');
  });

  it('emits variable-missing warn for unknown placeholders', () => {
    const doc = buildDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's',
            elements: [{ id: 't1', type: 'text', transform: BASE_TRANSFORM, text: 'Hi {{ghost}}' }],
          },
        ],
      },
    });
    const { diagnostics } = compileRIR(doc);
    expect(diagnostics.some((d) => d.code === 'variable-missing')).toBe(true);
  });
});

describe('compileRIR — binding resolve', () => {
  it('resolves chart ds: refs via a provider', () => {
    const payload: ChartData = {
      labels: ['Q1', 'Q2'],
      series: [{ name: 'rev', values: [10, 20] }],
    };
    const doc = buildDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's',
            elements: [
              {
                id: 'c1',
                type: 'chart',
                transform: BASE_TRANSFORM,
                chartKind: 'bar',
                data: 'ds:revenue',
              },
            ],
          },
        ],
      },
    });
    const { rir, diagnostics } = compileRIR(doc, {
      dataSourceProvider: (ref) => (ref === 'ds:revenue' ? payload : null),
    });
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const content = rir.elements[0]?.content;
    expect(content?.type === 'chart' && content.data.labels).toEqual(['Q1', 'Q2']);
  });

  it('warns when a provider is missing', () => {
    const doc = buildDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's',
            elements: [
              {
                id: 'c1',
                type: 'chart',
                transform: BASE_TRANSFORM,
                chartKind: 'bar',
                data: 'ds:revenue',
              },
            ],
          },
        ],
      },
    });
    const { diagnostics } = compileRIR(doc);
    expect(diagnostics.some((d) => d.code === 'binding-no-provider')).toBe(true);
  });
});

describe('compileRIR — font aggregation', () => {
  it('collects fontFamily from text + declared fonts on clip elements (deduped)', () => {
    const doc = buildDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's',
            elements: [
              {
                id: 't1',
                type: 'text',
                transform: BASE_TRANSFORM,
                text: 'hi',
                fontFamily: 'Inter',
              },
              {
                id: 't2',
                type: 'text',
                transform: BASE_TRANSFORM,
                text: 'yo',
                fontFamily: 'Inter',
              },
              {
                id: 'c1',
                type: 'clip',
                transform: BASE_TRANSFORM,
                runtime: 'gsap',
                clipName: 'motion-text',
                fonts: [
                  { family: 'Inter', weight: 600 },
                  { family: 'Inter', weight: 400, style: 'italic' },
                ],
              },
            ],
          },
        ],
      },
    });
    const { rir } = compileRIR(doc);
    const fams = rir.fontRequirements
      .map((f: FontRequirement) => `${f.family}/${f.weight ?? ''}/${f.style ?? ''}`)
      .sort();
    expect(fams).toEqual(
      [
        'Inter//normal', // from text element (Inter, default normal)
        'Inter/400/italic', // from clip
        'Inter/600/normal', // from clip
      ].sort(),
    );
  });
});

describe('compileRIR — group recursion', () => {
  it('walks group children and assigns zIndex per sibling group', () => {
    const doc = buildDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's',
            elements: [
              {
                id: 'g',
                type: 'group',
                transform: BASE_TRANSFORM,
                children: [
                  { id: 'ga', type: 'text', transform: BASE_TRANSFORM, text: 'a' },
                  { id: 'gb', type: 'text', transform: BASE_TRANSFORM, text: 'b' },
                ],
              },
              { id: 'sibling', type: 'text', transform: BASE_TRANSFORM, text: 'x' },
            ],
          },
        ],
      },
    });
    const { rir } = compileRIR(doc);
    expect(rir.elements.map((e) => ({ id: e.id, zIndex: e.zIndex }))).toEqual([
      { id: 'g', zIndex: 0 },
      { id: 'sibling', zIndex: 10 },
    ]);
    const group = rir.elements[0];
    if (group?.content.type === 'group') {
      expect(group.content.children.map((c) => ({ id: c.id, z: c.zIndex }))).toEqual([
        { id: 'ga', z: 0 },
        { id: 'gb', z: 10 },
      ]);
    } else {
      throw new Error('expected first element to be a group');
    }
  });

  it('emits an entry in stackingMap for every element including nested', () => {
    const doc = buildDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's',
            elements: [
              {
                id: 'g',
                type: 'group',
                transform: BASE_TRANSFORM,
                children: [{ id: 'child', type: 'text', transform: BASE_TRANSFORM, text: 'x' }],
              },
            ],
          },
        ],
      },
    });
    const { rir } = compileRIR(doc);
    expect(Object.keys(rir.stackingMap).sort()).toEqual(['child', 'g']);
    expect(rir.stackingMap.g).toBe('auto');
    expect(rir.stackingMap.child).toBe('auto');
  });
});

describe('compileRIR — determinism', () => {
  it('same input yields same digest', () => {
    const doc = buildDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's',
            elements: [{ id: 'e', type: 'text', transform: BASE_TRANSFORM, text: 'hi' }],
          },
        ],
      },
    });
    const a = compileRIR(doc);
    const b = compileRIR(doc);
    expect(a.rir.meta.digest).toBe(b.rir.meta.digest);
  });

  it('does not invoke Date.now/Math.random (inferred from identical-run equality)', () => {
    const doc = buildDoc({
      content: { mode: 'slide', slides: [{ id: 's', elements: [] }] },
    });
    const runs = Array.from({ length: 5 }, () => compileRIR(doc));
    const digests = new Set(runs.map((r) => r.rir.meta.digest));
    expect(digests.size).toBe(1);
  });
});

describe('compileRIR — video + display modes', () => {
  it('compiles a video document and derives frameRate from content', () => {
    const doc = buildDoc({
      content: {
        mode: 'video',
        aspectRatio: '16:9',
        durationMs: 30_000,
        frameRate: 60,
        tracks: [
          {
            id: 'v',
            kind: 'visual',
            elements: [{ id: 'e', type: 'text', transform: BASE_TRANSFORM, text: 'ad' }],
          },
        ],
      },
    });
    const { rir } = compileRIR(doc);
    expect(rir.mode).toBe('video');
    expect(rir.frameRate).toBe(60);
    expect(rir.durationFrames).toBe(30 * 60);
  });

  it('compiles a display document with budget passthrough at the doc level', () => {
    const doc = buildDoc({
      content: {
        mode: 'display',
        sizes: [{ id: 'mpu', width: 300, height: 250 }],
        durationMs: 15_000,
        budget: { totalZipKb: 150 },
        elements: [{ id: 'e', type: 'text', transform: BASE_TRANSFORM, text: 'banner' }],
      },
    });
    const { rir } = compileRIR(doc);
    expect(rir.mode).toBe('display');
    expect(rir.durationFrames).toBe(15 * 30); // 30fps default for display
  });
});
