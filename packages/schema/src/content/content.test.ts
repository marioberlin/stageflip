// packages/schema/src/content/content.test.ts
// Unit tests for the three mode-specific content types + top-level Document.

import { describe, expect, it } from 'vitest';

import { SCHEMA_VERSION, documentSchema } from '../document.js';
import { displayBudgetSchema, displayContentSchema } from './display.js';
import { MODES, contentSchema } from './index.js';
import { slideContentSchema } from './slide.js';
import { videoContentSchema } from './video.js';

const NOW = '2026-04-20T12:00:00.000Z';

const MIN_DOC = {
  meta: {
    id: 'doc1',
    version: 0,
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: SCHEMA_VERSION,
    locale: 'en',
  },
  theme: { tokens: {} },
  variables: {},
  components: {},
} as const;

const ELEM = {
  id: 'el1',
  type: 'text' as const,
  transform: { x: 0, y: 0, width: 100, height: 50 },
  text: 'hi',
};

describe('slide content', () => {
  it('parses a minimum valid slide deck', () => {
    const parsed = slideContentSchema.parse({
      mode: 'slide',
      slides: [{ id: 's1', elements: [ELEM] }],
    });
    expect(parsed.slides).toHaveLength(1);
  });

  it('rejects an empty slide list', () => {
    expect(() => slideContentSchema.parse({ mode: 'slide', slides: [] })).toThrow();
  });

  it('accepts a color background + fade transition', () => {
    slideContentSchema.parse({
      mode: 'slide',
      slides: [
        {
          id: 's1',
          elements: [],
          background: { kind: 'color', value: '#fefefe' },
          transition: { kind: 'fade', durationMs: 250 },
        },
      ],
    });
  });
});

describe('video content', () => {
  it('parses 16:9 video with a single visual track', () => {
    const parsed = videoContentSchema.parse({
      mode: 'video',
      aspectRatio: '16:9',
      durationMs: 30_000,
      tracks: [{ id: 't1', kind: 'visual', elements: [ELEM] }],
    });
    expect(parsed.frameRate).toBe(30); // default
  });

  it('accepts a custom aspect ratio', () => {
    videoContentSchema.parse({
      mode: 'video',
      aspectRatio: { kind: 'custom', w: 5, h: 4 },
      durationMs: 1000,
      tracks: [{ id: 't', kind: 'visual', elements: [] }],
    });
  });

  it('rejects caption segments with endMs <= startMs', () => {
    expect(() =>
      videoContentSchema.parse({
        mode: 'video',
        aspectRatio: '9:16',
        durationMs: 1000,
        tracks: [{ id: 't', kind: 'visual', elements: [] }],
        captions: { lang: 'en', segments: [{ startMs: 500, endMs: 500, text: 'hi' }] },
      }),
    ).toThrow(/endMs/);
  });

  it('rejects an empty tracks array', () => {
    expect(() =>
      videoContentSchema.parse({
        mode: 'video',
        aspectRatio: '1:1',
        durationMs: 1000,
        tracks: [],
      }),
    ).toThrow();
  });
});

describe('display content + budget', () => {
  it('parses a minimum valid 300x250 banner', () => {
    const parsed = displayContentSchema.parse({
      mode: 'display',
      sizes: [{ id: 'mpu', width: 300, height: 250 }],
      durationMs: 15_000,
      budget: { totalZipKb: 150 },
      elements: [ELEM],
    });
    expect(parsed.budget.assetsInlined).toBe(true); // default
    expect(parsed.budget.externalFontsAllowed).toBe(false); // default
  });

  it('budget rejects externalFontsAllowed=true with cap=0', () => {
    expect(() =>
      displayBudgetSchema.parse({
        totalZipKb: 150,
        externalFontsAllowed: true,
        externalFontsKbCap: 0,
      }),
    ).toThrow(/externalFontsKbCap/);
  });

  it('budget accepts externalFontsAllowed=true with positive cap', () => {
    displayBudgetSchema.parse({
      totalZipKb: 200,
      externalFontsAllowed: true,
      externalFontsKbCap: 50,
    });
  });
});

describe('content discriminated union', () => {
  it('MODES has exactly 3 unique entries', () => {
    expect(MODES).toHaveLength(3);
    expect(new Set(MODES).size).toBe(3);
  });

  it('rejects an unknown mode', () => {
    expect(() =>
      contentSchema.parse({ mode: 'quantum', slides: [{ id: 's', elements: [] }] }),
    ).toThrow();
  });
});

describe('top-level Document', () => {
  it('parses a minimum valid slide document', () => {
    const parsed = documentSchema.parse({
      ...MIN_DOC,
      content: { mode: 'slide', slides: [{ id: 's1', elements: [] }] },
    });
    expect(parsed.meta.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.variables).toEqual({});
  });

  it('parses a minimum valid video document', () => {
    documentSchema.parse({
      ...MIN_DOC,
      content: {
        mode: 'video',
        aspectRatio: '16:9',
        durationMs: 10_000,
        tracks: [{ id: 't', kind: 'visual', elements: [] }],
      },
    });
  });

  it('parses a minimum valid display document', () => {
    documentSchema.parse({
      ...MIN_DOC,
      content: {
        mode: 'display',
        sizes: [{ id: 'sz', width: 728, height: 90 }],
        durationMs: 15_000,
        budget: { totalZipKb: 150 },
        elements: [],
      },
    });
  });

  it('rejects unknown top-level fields (strict)', () => {
    expect(() =>
      documentSchema.parse({
        ...MIN_DOC,
        content: { mode: 'slide', slides: [{ id: 's', elements: [] }] },
        hairstyle: 'mohawk',
      }),
    ).toThrow();
  });
});
