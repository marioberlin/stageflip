// packages/import-google-slides/src/fixtures/fixtures.test.ts
// End-to-end fixture-driven tests. ACs #35-39.
//
// Each fixture's `api-response.json` + `cv-candidates.json` drives a single
// `parseGoogleSlides` call. The test seam `presentation` + `thumbnails` +
// `cvFixtureKeys` lets us avoid live HTTP entirely. Per-slide thumbnail
// dimensions default to 1600×900 (the LARGE thumbnail size for the standard
// 16:9 page).

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { GoogleAuthProvider } from '../api/client.js';
import type { ApiPresentation } from '../api/types.js';
import { StubCvProvider } from '../cv/stub.js';
import { parseGoogleSlides } from '../parseGoogleSlides.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const auth: GoogleAuthProvider = { getAccessToken: async () => 'tok' };

interface FixtureData {
  api: ApiPresentation;
  cv: Record<string, unknown>;
}

function loadFixture(name: string): FixtureData {
  const dir = resolve(__dirname, name);
  const api = JSON.parse(
    readFileSync(resolve(dir, 'api-response.json'), 'utf8'),
  ) as ApiPresentation;
  const cv = JSON.parse(readFileSync(resolve(dir, 'cv-candidates.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  return { api, cv };
}

/** Build a synthetic per-slide thumbnails map at the standard 1600×900. */
function thumbsFor(
  api: ApiPresentation,
): Record<string, { bytes: Uint8Array; width: number; height: number }> {
  const out: Record<string, { bytes: Uint8Array; width: number; height: number }> = {};
  for (const s of api.slides ?? []) {
    if (s.objectId) {
      out[s.objectId] = { bytes: new Uint8Array(0), width: 1600, height: 900 };
    }
  }
  return out;
}

/** Build cvFixtureKeys mapping slideObjectId → key (same string by convention). */
function cvKeysFor(api: ApiPresentation): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of api.slides ?? []) {
    if (s.objectId) out[s.objectId] = s.objectId;
  }
  return out;
}

describe('AC #35 — simple-deck', () => {
  it('produces 3 slides, 1 layout, 1 master, empty pendingResolution, no flags above info', async () => {
    const { api, cv } = loadFixture('simple-deck');
    const stub = new StubCvProvider(cv);
    const tree = await parseGoogleSlides({
      presentationId: 'p',
      auth,
      cv: stub,
      presentation: api,
      thumbnails: thumbsFor(api),
      cvFixtureKeys: cvKeysFor(api),
    });
    expect(tree.slides).toHaveLength(3);
    expect(Object.keys(tree.layouts)).toHaveLength(1);
    expect(Object.keys(tree.masters)).toHaveLength(1);
    expect(tree.pendingResolution).toEqual({});
    const aboveInfo = tree.lossFlags.filter((f) => f.severity !== 'info');
    expect(aboveInfo).toEqual([]);
    expect(tree.assetsResolved).toBe(false);
  });

  it('every slide has Slide.layoutId set to the parsed layout id', async () => {
    const { api, cv } = loadFixture('simple-deck');
    const tree = await parseGoogleSlides({
      presentationId: 'p',
      auth,
      cv: new StubCvProvider(cv),
      presentation: api,
      thumbnails: thumbsFor(api),
      cvFixtureKeys: cvKeysFor(api),
    });
    for (const s of tree.slides) {
      expect(s.layoutId).toBe('layout-1');
    }
  });
});

describe('AC #36 — grouped-deck', () => {
  it('produces a 2-deep nested ParsedGroupElement (no flattening)', async () => {
    const { api, cv } = loadFixture('grouped-deck');
    const tree = await parseGoogleSlides({
      presentationId: 'p',
      auth,
      cv: new StubCvProvider(cv),
      presentation: api,
      thumbnails: thumbsFor(api),
      cvFixtureKeys: cvKeysFor(api),
    });
    const slide = tree.slides[0];
    expect(slide).toBeDefined();
    if (!slide) return;
    expect(slide.elements).toHaveLength(1);
    const outer = slide.elements[0];
    expect(outer?.type).toBe('group');
    if (outer?.type !== 'group') return;
    expect(outer.children).toHaveLength(1);
    const inner = outer.children[0];
    expect(inner?.type).toBe('group');
    if (inner?.type !== 'group') return;
    expect(inner.children).toHaveLength(1);
    expect(inner.children[0]?.type).toBe('shape');
  });
});

describe('AC #37 — table-merged-cells', () => {
  it('produces a TableElement with rowspan:2 on the spanned cell', async () => {
    const { api, cv } = loadFixture('table-merged-cells');
    const tree = await parseGoogleSlides({
      presentationId: 'p',
      auth,
      cv: new StubCvProvider(cv),
      presentation: api,
      thumbnails: thumbsFor(api),
      cvFixtureKeys: cvKeysFor(api),
    });
    const slide = tree.slides[0];
    expect(slide).toBeDefined();
    if (!slide) return;
    const tbl = slide.elements[0];
    expect(tbl?.type).toBe('table');
    if (tbl?.type !== 'table') return;
    expect(tbl.cells).toHaveLength(3);
    const span = tbl.cells.find((c) => c.row === 0 && c.col === 0);
    expect(span?.rowspan).toBe(2);
    expect(span?.content).toBe('spanned');
    // Tables don't go through matching, so no LOW-MATCH flag for this slide.
    const lowMatch = tree.lossFlags.filter((f) => f.code === 'LF-GSLIDES-LOW-MATCH-CONFIDENCE');
    expect(lowMatch).toEqual([]);
  });
});

describe('AC #38 — placeholder-inheritance', () => {
  it('every slide element with a resolved placeholder.parentObjectId carries inheritsFrom', async () => {
    const { api, cv } = loadFixture('placeholder-inheritance');
    const tree = await parseGoogleSlides({
      presentationId: 'p',
      auth,
      cv: new StubCvProvider(cv),
      presentation: api,
      thumbnails: thumbsFor(api),
      cvFixtureKeys: cvKeysFor(api),
    });
    const slide = tree.slides[0];
    expect(slide).toBeDefined();
    if (!slide) return;
    const titleEl = slide.elements.find((e) => e.id === 'el-title');
    const bodyEl = slide.elements.find((e) => e.id === 'el-body');
    expect(titleEl?.inheritsFrom).toEqual({ templateId: 'layout-1', placeholderIdx: 0 });
    expect(bodyEl?.inheritsFrom).toEqual({ templateId: 'layout-1', placeholderIdx: 1 });
    // No PLACEHOLDER-INLINED flags expected.
    const inlined = tree.lossFlags.filter((f) => f.code === 'LF-GSLIDES-PLACEHOLDER-INLINED');
    expect(inlined).toEqual([]);
  });
});

describe('AC #39 — low-confidence-residual', () => {
  it('emits LF-GSLIDES-LOW-MATCH-CONFIDENCE; populates pendingResolution with the spec-shaped residual', async () => {
    const { api, cv } = loadFixture('low-confidence-residual');
    const tree = await parseGoogleSlides({
      presentationId: 'p',
      auth,
      cv: new StubCvProvider(cv),
      presentation: api,
      thumbnails: thumbsFor(api),
      cvFixtureKeys: cvKeysFor(api),
    });
    const slide = tree.slides[0];
    expect(slide).toBeDefined();
    if (!slide) return;
    const lowMatch = tree.lossFlags.filter((f) => f.code === 'LF-GSLIDES-LOW-MATCH-CONFIDENCE');
    expect(lowMatch.length).toBeGreaterThanOrEqual(1);

    const residuals = tree.pendingResolution[slide.id];
    expect(residuals).toBeDefined();
    if (!residuals) return;
    const elIds = Object.keys(residuals);
    expect(elIds.length).toBeGreaterThanOrEqual(1);
    const elId = elIds[0];
    if (!elId) return;
    const res = residuals[elId];
    expect(res).toBeDefined();
    if (!res) return;
    expect(res.slideId).toBe(slide.id);
    expect(res.elementId).toBe(elId);
    expect(res.rankedCandidates.length).toBeGreaterThanOrEqual(1);
    const top = res.rankedCandidates[0];
    expect(top).toBeDefined();
    if (!top) return;
    expect(top.overallConfidence).toBeLessThan(0.78);
    expect(top.overallConfidence).toBeCloseTo(0.6, 1);
    // pageImageCropPx must cover element bbox + 16-px padding (clamped to canvas).
    expect(res.pageImageCropPx.width).toBeGreaterThanOrEqual(175 + 16);
    expect(res.pageImageCropPx.height).toBeGreaterThanOrEqual(175 + 16);
    expect(res.pageImageCropPx.x).toBeLessThanOrEqual(175 - 16 + 0.5);
    expect(res.pageImageCropPx.y).toBeLessThanOrEqual(175 - 16 + 0.5);
  });
});
