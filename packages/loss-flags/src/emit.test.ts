// packages/loss-flags/src/emit.test.ts
// Vitest coverage for the generic `emitLossFlag`:
//   AC #3 — purity: identical input → identical output across 1000 runs.
//   AC #4 — algorithm pin: a fixed input maps to a fixed sha256-12 id.
//   AC #5 — every LossFlagSeverity / LossFlagCategory round-trips unchanged.
//   AC #7 — byte-identical equivalence with the pre-extraction PPTX wrapper:
//           8 expected outputs were captured from the *current* (pre-extract)
//           `@stageflip/import-pptx` `emitLossFlag` against 8 inputs (one per
//           existing LossFlagCode) and pinned verbatim below. The new
//           generic emitter, when called with `source: 'pptx'` and the
//           per-code default severity/category, must produce the same bytes.

import { describe, expect, it } from 'vitest';
import {
  type EmitLossFlagInput,
  type LossFlag,
  type LossFlagCategory,
  type LossFlagSeverity,
  emitLossFlag,
} from './index.js';

const SEVERITIES: readonly LossFlagSeverity[] = ['info', 'warn', 'error'];
const CATEGORIES: readonly LossFlagCategory[] = [
  'shape',
  'animation',
  'font',
  'media',
  'theme',
  'script',
  'other',
];

describe('emitLossFlag — purity (AC #3)', () => {
  it('produces an identical record across 1000 runs of the same input', () => {
    const input: EmitLossFlagInput = {
      source: 'pptx',
      code: 'LF-PPTX-CUSTOM-GEOMETRY',
      severity: 'warn',
      category: 'shape',
      message: 'Custom geometry not supported',
      location: { slideId: 's1', elementId: 'e1', oocxmlPath: 'ppt/slides/slide1.xml' },
      originalSnippet: '<a:custGeom/>',
    };
    const first = emitLossFlag(input);
    for (let i = 0; i < 1000; i++) {
      expect(emitLossFlag(input)).toEqual(first);
    }
  });
});

describe('emitLossFlag — id algorithm pin (AC #4)', () => {
  it('derives id = sha256(source\\u0001code\\u0001slideId\\u0001elementId\\u0001oocxmlPath\\u0001originalSnippet).slice(0,12)', () => {
    // Hand-computed reference — pin the exact algorithm. If a change to the
    // hashing scheme (input order, separator, slice length) lands silently,
    // this test breaks before any fixture comparison.
    const input: EmitLossFlagInput = {
      source: 'pptx',
      code: 'LF-PPTX-CUSTOM-GEOMETRY',
      severity: 'warn',
      category: 'shape',
      message: 'Custom geometry with unsupported <a:arcTo>',
      location: { slideId: 'slide-1', elementId: 'el-7', oocxmlPath: 'ppt/slides/slide1.xml' },
      originalSnippet: '<a:arcTo wR="100" hR="50" />',
    };
    expect(emitLossFlag(input).id).toBe('9ab4b4748c41');
  });

  it('treats undefined location fields and undefined originalSnippet as empty strings in the hash', () => {
    const a = emitLossFlag({
      source: 'gslides',
      code: 'LF-GSLIDES-EXAMPLE',
      severity: 'info',
      category: 'other',
      message: 'm',
      location: { slideId: 'sl' },
    });
    const b = emitLossFlag({
      source: 'gslides',
      code: 'LF-GSLIDES-EXAMPLE',
      severity: 'info',
      category: 'other',
      message: 'm',
      location: { slideId: 'sl', elementId: undefined, oocxmlPath: undefined },
    });
    expect(a.id).toBe(b.id);
  });

  it('produces ids of length 12 (sha256 hex sliced)', () => {
    const flag = emitLossFlag({
      source: 'pptx',
      code: 'LF-PPTX-NOTES-DROPPED',
      severity: 'info',
      category: 'other',
      message: 'm',
      location: {},
    });
    expect(flag.id).toHaveLength(12);
    expect(flag.id).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('emitLossFlag — severity / category round-trip (AC #5)', () => {
  for (const severity of SEVERITIES) {
    it(`accepts severity="${severity}" without narrowing`, () => {
      const flag = emitLossFlag({
        source: 'pptx',
        code: 'LF-PPTX-X',
        severity,
        category: 'shape',
        message: 'm',
        location: {},
      });
      expect(flag.severity).toBe(severity);
    });
  }

  for (const category of CATEGORIES) {
    it(`accepts category="${category}" without narrowing`, () => {
      const flag = emitLossFlag({
        source: 'pptx',
        code: 'LF-PPTX-X',
        severity: 'info',
        category,
        message: 'm',
        location: {},
      });
      expect(flag.category).toBe(category);
    });
  }
});

describe('emitLossFlag — optional fields', () => {
  it('omits recovery when not provided', () => {
    const flag = emitLossFlag({
      source: 'pptx',
      code: 'LF-PPTX-X',
      severity: 'info',
      category: 'other',
      message: 'm',
      location: {},
    });
    expect('recovery' in flag).toBe(false);
  });

  it('omits originalSnippet when not provided', () => {
    const flag = emitLossFlag({
      source: 'pptx',
      code: 'LF-PPTX-X',
      severity: 'info',
      category: 'other',
      message: 'm',
      location: {},
    });
    expect('originalSnippet' in flag).toBe(false);
  });

  it('preserves recovery when provided', () => {
    const flag = emitLossFlag({
      source: 'pptx',
      code: 'LF-PPTX-X',
      severity: 'info',
      category: 'other',
      message: 'm',
      location: {},
      recovery: 'fix it',
    });
    expect(flag.recovery).toBe('fix it');
  });

  it('preserves originalSnippet when provided', () => {
    const flag = emitLossFlag({
      source: 'pptx',
      code: 'LF-PPTX-X',
      severity: 'info',
      category: 'other',
      message: 'm',
      location: {},
      originalSnippet: '<x/>',
    });
    expect(flag.originalSnippet).toBe('<x/>');
  });
});

// AC #7: outputs captured from the *pre-extraction* @stageflip/import-pptx
// emitter against the 8 inputs below (one per existing LossFlagCode). See
// the T-247-loss-flags PR body for the full capture transcript.
//
// In this generic test we drive `emitLossFlag` directly with the per-code
// PPTX defaults (severity + category that the PPTX wrapper auto-fills).
// The PPTX wrapper itself is exercised in @stageflip/import-pptx's own
// suite (AC #6 + AC #8).

interface PptxFixture {
  readonly input: {
    readonly code: string;
    readonly severity: LossFlagSeverity;
    readonly category: LossFlagCategory;
    readonly message: string;
    readonly location: LossFlag['location'];
    readonly recovery?: string;
    readonly originalSnippet?: string;
  };
  readonly expected: LossFlag;
}

const PPTX_FIXTURES: readonly PptxFixture[] = [
  {
    input: {
      code: 'LF-PPTX-CUSTOM-GEOMETRY',
      severity: 'warn',
      category: 'shape',
      message: 'Custom geometry with unsupported <a:arcTo>',
      location: { slideId: 'slide-1', elementId: 'el-7', oocxmlPath: 'ppt/slides/slide1.xml' },
      originalSnippet: '<a:arcTo wR="100" hR="50" />',
    },
    expected: {
      id: '9ab4b4748c41',
      source: 'pptx',
      code: 'LF-PPTX-CUSTOM-GEOMETRY',
      severity: 'warn',
      category: 'shape',
      location: { slideId: 'slide-1', elementId: 'el-7', oocxmlPath: 'ppt/slides/slide1.xml' },
      message: 'Custom geometry with unsupported <a:arcTo>',
      originalSnippet: '<a:arcTo wR="100" hR="50" />',
    },
  },
  {
    input: {
      code: 'LF-PPTX-PRESET-GEOMETRY',
      severity: 'info',
      category: 'shape',
      message: 'Preset shape "chord" not yet supported',
      location: { slideId: 'slide-2', elementId: 'el-3', oocxmlPath: 'ppt/slides/slide2.xml' },
      originalSnippet: 'prstGeom prst="chord"',
    },
    expected: {
      id: '559362cb769c',
      source: 'pptx',
      code: 'LF-PPTX-PRESET-GEOMETRY',
      severity: 'info',
      category: 'shape',
      location: { slideId: 'slide-2', elementId: 'el-3', oocxmlPath: 'ppt/slides/slide2.xml' },
      message: 'Preset shape "chord" not yet supported',
      originalSnippet: 'prstGeom prst="chord"',
    },
  },
  {
    input: {
      code: 'LF-PPTX-PRESET-ADJUSTMENT-IGNORED',
      severity: 'info',
      category: 'shape',
      message: 'Preset adjustment <a:avLst> not honored; defaults used',
      location: { slideId: 'slide-3', elementId: 'el-1', oocxmlPath: 'ppt/slides/slide3.xml' },
      originalSnippet: '<a:gd name="adj1" fmla="val 19098" />',
    },
    expected: {
      id: '0895d9498c68',
      source: 'pptx',
      code: 'LF-PPTX-PRESET-ADJUSTMENT-IGNORED',
      severity: 'info',
      category: 'shape',
      location: { slideId: 'slide-3', elementId: 'el-1', oocxmlPath: 'ppt/slides/slide3.xml' },
      message: 'Preset adjustment <a:avLst> not honored; defaults used',
      originalSnippet: '<a:gd name="adj1" fmla="val 19098" />',
    },
  },
  {
    input: {
      code: 'LF-PPTX-UNRESOLVED-ASSET',
      severity: 'info',
      category: 'media',
      message: 'Picture asset bytes pending resolution',
      location: { slideId: 'slide-4', elementId: 'pic-9', oocxmlPath: 'ppt/slides/slide4.xml' },
      recovery: 'Run resolveAssets() to fill image bytes',
    },
    expected: {
      id: 'c7e12d17d4e4',
      source: 'pptx',
      code: 'LF-PPTX-UNRESOLVED-ASSET',
      severity: 'info',
      category: 'media',
      location: { slideId: 'slide-4', elementId: 'pic-9', oocxmlPath: 'ppt/slides/slide4.xml' },
      message: 'Picture asset bytes pending resolution',
      recovery: 'Run resolveAssets() to fill image bytes',
    },
  },
  {
    input: {
      code: 'LF-PPTX-MISSING-ASSET-BYTES',
      severity: 'error',
      category: 'media',
      message: 'Picture rel points at missing path /ppt/media/image99.png',
      location: {
        slideId: 'slide-5',
        elementId: 'pic-12',
        oocxmlPath: 'ppt/slides/_rels/slide5.xml.rels',
      },
      originalSnippet: 'Target="../media/image99.png"',
    },
    expected: {
      id: '3234c9461f7b',
      source: 'pptx',
      code: 'LF-PPTX-MISSING-ASSET-BYTES',
      severity: 'error',
      category: 'media',
      location: {
        slideId: 'slide-5',
        elementId: 'pic-12',
        oocxmlPath: 'ppt/slides/_rels/slide5.xml.rels',
      },
      message: 'Picture rel points at missing path /ppt/media/image99.png',
      originalSnippet: 'Target="../media/image99.png"',
    },
  },
  {
    input: {
      code: 'LF-PPTX-UNSUPPORTED-ELEMENT',
      severity: 'warn',
      category: 'other',
      message: 'Chart element not supported; rendered as placeholder',
      location: { slideId: 'slide-6', elementId: 'chart-2', oocxmlPath: 'ppt/charts/chart1.xml' },
    },
    expected: {
      id: 'e14a15f53404',
      source: 'pptx',
      code: 'LF-PPTX-UNSUPPORTED-ELEMENT',
      severity: 'warn',
      category: 'other',
      location: { slideId: 'slide-6', elementId: 'chart-2', oocxmlPath: 'ppt/charts/chart1.xml' },
      message: 'Chart element not supported; rendered as placeholder',
    },
  },
  {
    input: {
      code: 'LF-PPTX-UNSUPPORTED-FILL',
      severity: 'info',
      category: 'theme',
      message: 'Gradient fill flattened to first stop',
      location: { slideId: 'slide-7', elementId: 'el-44', oocxmlPath: 'ppt/slides/slide7.xml' },
      originalSnippet: '<a:gradFill><a:gsLst>...</a:gsLst></a:gradFill>',
    },
    expected: {
      id: '8a39e7a9fdb9',
      source: 'pptx',
      code: 'LF-PPTX-UNSUPPORTED-FILL',
      severity: 'info',
      category: 'theme',
      location: { slideId: 'slide-7', elementId: 'el-44', oocxmlPath: 'ppt/slides/slide7.xml' },
      message: 'Gradient fill flattened to first stop',
      originalSnippet: '<a:gradFill><a:gsLst>...</a:gsLst></a:gradFill>',
    },
  },
  {
    input: {
      code: 'LF-PPTX-NOTES-DROPPED',
      severity: 'info',
      category: 'other',
      message: 'Speaker notes dropped (T-249/T-250)',
      location: { slideId: 'slide-8', oocxmlPath: 'ppt/notesSlides/notesSlide8.xml' },
    },
    expected: {
      id: 'a5c07505978f',
      source: 'pptx',
      code: 'LF-PPTX-NOTES-DROPPED',
      severity: 'info',
      category: 'other',
      location: { slideId: 'slide-8', oocxmlPath: 'ppt/notesSlides/notesSlide8.xml' },
      message: 'Speaker notes dropped (T-249/T-250)',
    },
  },
];

describe('emitLossFlag — byte-identical to pre-extraction PPTX emitter (AC #7)', () => {
  for (const fixture of PPTX_FIXTURES) {
    it(`pins ${fixture.input.code}`, () => {
      const actual = emitLossFlag({
        source: 'pptx',
        code: fixture.input.code,
        severity: fixture.input.severity,
        category: fixture.input.category,
        message: fixture.input.message,
        location: fixture.input.location,
        ...(fixture.input.recovery !== undefined ? { recovery: fixture.input.recovery } : {}),
        ...(fixture.input.originalSnippet !== undefined
          ? { originalSnippet: fixture.input.originalSnippet }
          : {}),
      });
      expect(actual).toEqual(fixture.expected);
    });
  }

  it('covers all 8 PPTX LossFlagCodes once', () => {
    expect(PPTX_FIXTURES.length).toBe(8);
    const codes = new Set(PPTX_FIXTURES.map((f) => f.input.code));
    expect(codes.size).toBe(8);
  });
});
