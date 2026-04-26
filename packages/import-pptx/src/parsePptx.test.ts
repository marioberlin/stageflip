// packages/import-pptx/src/parsePptx.test.ts
// Acceptance-criteria tests for T-240 (#1-#7). Fixture-snapshot tests for
// criterion #8 live in fixtures/fixtures.test.ts.

import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { resolveAssets } from './assets/resolve.js';
import type { AssetStorage } from './assets/types.js';
import {
  buildAdjustedShapesFixture,
  buildGroupFixture,
  buildMinimalFixture,
  buildMultiSlideFixture,
  buildPictureFixture,
  buildShapesFixture,
  buildVideoAndImageFixture,
  buildVideoFixture,
} from './fixtures/builder.js';
import { parsePptx } from './parsePptx.js';
import { PptxParseError } from './types.js';
import type { ParsedGroupElement, ParsedImageElement, ParsedVideoElement } from './types.js';
import { unpackPptx } from './zip.js';

describe('parsePptx — acceptance criteria', () => {
  // AC #1
  it('returns a CanonicalSlideTree for a valid pptx buffer', async () => {
    const tree = await parsePptx(buildMinimalFixture());
    expect(tree.slides.length).toBe(1);
    expect(typeof tree.layouts).toBe('object');
    expect(typeof tree.masters).toBe('object');
    expect(Array.isArray(tree.lossFlags)).toBe(true);
  });

  // AC #2
  it('walks slides → layouts → masters via the OPC relationships', async () => {
    const tree = await parsePptx(buildMinimalFixture());
    expect(Object.keys(tree.layouts).length).toBe(1);
    expect(Object.keys(tree.masters).length).toBe(1);
    const [layoutKey] = Object.keys(tree.layouts);
    const [masterKey] = Object.keys(tree.masters);
    expect(layoutKey).toBeDefined();
    expect(masterKey).toBeDefined();
  });

  // AC #3
  it('emits text runs from <a:r><a:t> with positional info from <a:xfrm>', async () => {
    const tree = await parsePptx(buildMinimalFixture());
    const slide = tree.slides[0];
    expect(slide).toBeDefined();
    const text = slide?.elements[0];
    expect(text?.type).toBe('text');
    if (text?.type !== 'text') return;
    expect(text.text).toBe('Hello, StageFlip');
    expect(text.runs?.[0]?.weight).toBe(700);
    // EMU 914400 = 1 inch = 96 px → 96 px in our schema
    expect(text.transform.x).toBeCloseTo(96, 0);
    expect(text.transform.y).toBeCloseTo(96, 0);
    expect(text.transform.width).toBeGreaterThan(0);
    expect(text.transform.height).toBeGreaterThan(0);
  });

  // AC #4
  it('emits picture elements with an unresolved ParsedAssetRef', async () => {
    const tree = await parsePptx(buildPictureFixture());
    const slide = tree.slides[0];
    const pic = slide?.elements[0];
    expect(pic?.type).toBe('image');
    if (pic?.type !== 'image') return;
    const img = pic as ParsedImageElement;
    expect(img.src.kind).toBe('unresolved');
    if (img.src.kind !== 'unresolved') return;
    expect(img.src.oocxmlPath).toBe('ppt/media/image1.png');
    // The unresolved-asset flag is in the lossFlags list.
    const flag = tree.lossFlags.find((f) => f.code === 'LF-PPTX-UNRESOLVED-ASSET');
    expect(flag).toBeDefined();
  });

  // AC #5 — group transforms NOT accumulated into descendants.
  it('groups carry world-space children after T-241a accumulation', async () => {
    const tree = await parsePptx(buildGroupFixture());
    const slide = tree.slides[0];
    const group = slide?.elements[0];
    expect(group?.type).toBe('group');
    if (group?.type !== 'group') return;
    const g = group as ParsedGroupElement;
    expect(g.children.length).toBe(2);
    // Group at world (1000000/9525, 1000000/9525), ext (2000000/9525, 1000000/9525).
    // Children's local origins are (100000/9525, 100000/9525) and (700000/9525, 100000/9525)
    // inside groupOrigin=(0,0)/groupExtent=(2000000/9525, 1000000/9525) → identity scale.
    // Accumulator translates each by group.transform.{x,y}: childA world x =
    // (1000000 + 100000)/9525, childB world x = (1000000 + 700000)/9525.
    const [childA, childB] = g.children;
    expect(childA?.transform.x).toBeCloseTo(1100000 / 9525, 0);
    expect(childB?.transform.x).toBeCloseTo(1700000 / 9525, 0);
    // Group's own transform is preserved (AC #7).
    expect(g.transform.x).toBeCloseTo(1000000 / 9525, 0);
    // Placeholder flag is gone (AC #2).
    expect(
      tree.lossFlags.find((f) => f.code === ('LF-PPTX-NESTED-GROUP-TRANSFORM' as never)),
    ).toBeUndefined();
    expect(tree.transformsAccumulated).toBe(true);
  });

  // AC #6 — custom geometry → unsupported-shape + LF-PPTX-CUSTOM-GEOMETRY.
  it('emits unsupported-shape + LF-PPTX-CUSTOM-GEOMETRY for <a:custGeom>', async () => {
    const tree = await parsePptx(buildMultiSlideFixture());
    // Slide 3 has the custom shape.
    const customSlide = tree.slides[2];
    expect(customSlide).toBeDefined();
    const shape = customSlide?.elements[0];
    expect(shape?.type).toBe('unsupported-shape');
    const flag = tree.lossFlags.find(
      (f) => f.code === 'LF-PPTX-CUSTOM-GEOMETRY' && f.location.slideId === 'slide_3',
    );
    expect(flag).toBeDefined();
    expect(flag?.severity).toBe('warn');
    expect(flag?.category).toBe('shape');
  });

  // AC #7 — typed errors.
  it('throws PptxParseError(INVALID_ZIP) for non-zip input', async () => {
    const garbage = strToU8('not actually a zip file');
    await expect(parsePptx(garbage)).rejects.toMatchObject({
      name: 'PptxParseError',
      code: 'INVALID_ZIP',
    });
  });

  it('throws PptxParseError(INVALID_XML) for malformed presentation.xml', async () => {
    const bad = zipSync({
      'ppt/presentation.xml': strToU8('<not-valid-xml>'),
    });
    try {
      await parsePptx(bad);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PptxParseError);
      const e = err as PptxParseError;
      expect(e.code).toBe('INVALID_XML');
      expect(e.oocxmlPath).toBe('ppt/presentation.xml');
    }
  });

  it('throws PptxParseError(MISSING_PART) when ppt/presentation.xml absent', async () => {
    const empty = zipSync({ 'something/else.xml': strToU8('<x/>') });
    try {
      await parsePptx(empty);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PptxParseError);
      const e = err as PptxParseError;
      expect(e.code).toBe('MISSING_PART');
    }
  });

  // Bonus — preset geometry mapped to schema kind.
  it('maps <a:prstGeom prst="rect"> to ShapeElement(rect)', async () => {
    const tree = await parsePptx(buildShapesFixture());
    const slide = tree.slides[0];
    const rect = slide?.elements[0];
    expect(rect?.type).toBe('shape');
    if (rect?.type !== 'shape') return;
    expect(rect.shape).toBe('rect');
  });

  // T-242d: deleted the LF-PPTX-PRESET-GEOMETRY rotation assertion. The
  // smoke fixture rotated through still-uncovered presets as T-242c batches
  // landed (`lightningBolt` → `chord`); after T-242d every committed preset
  // (50 = 14 structural + 36 custom-path) is covered. T-245 owns the
  // rasterization-fallback path for the long-tail (~140 OOXML presets
  // outside the 50-commitment), and will introduce its own fixtures —
  // continuing the rotation here is a maintenance tax with no signal.

  // Bonus — T-242-covered preset becomes a 'shape' element with a custom-path.
  it('renders T-242 preset (cloud) as shape:custom-path with a non-empty d', async () => {
    const tree = await parsePptx(buildShapesFixture());
    const slide = tree.slides[0];
    if (slide === undefined) throw new Error('expected slide_1');
    const cloud = slide.elements.find(
      (e) => e.type === 'shape' && (e as { shape: string }).shape === 'custom-path',
    );
    expect(cloud).toBeDefined();
    if (cloud?.type !== 'shape') return;
    expect(cloud.shape).toBe('custom-path');
    expect(cloud.path).toMatch(/^M /);
  });

  // T-242b — roundRect adj1 honored as schema cornerRadius on a structural rect.
  it('honors roundRect.adj as cornerRadius on the structural rect element', async () => {
    const tree = await parsePptx(buildAdjustedShapesFixture());
    const slide = tree.slides[0];
    if (slide === undefined) throw new Error('expected slide_1');
    const rect = slide.elements[0];
    expect(rect?.type).toBe('shape');
    if (rect?.type !== 'shape') return;
    expect(rect.shape).toBe('rect');
    // adj=25000, w=h≈105 px (1000000 EMU / 9525). cornerRadius = adj * min(w,h) / 200000.
    // ≈ 25000 * 105 / 200000 ≈ 13.1 px.
    expect(rect.cornerRadius).toBeGreaterThan(0);
    expect(rect.cornerRadius).toBeCloseTo(13.123, 1);
    // No LF-PPTX-PRESET-ADJUSTMENT-IGNORED for the roundRect's `adj`.
    const honoredFlag = tree.lossFlags.find(
      (f) => f.code === 'LF-PPTX-PRESET-ADJUSTMENT-IGNORED' && f.location.elementId === 'pptx_2',
    );
    expect(honoredFlag).toBeUndefined();
  });

  // T-242b — non-honored preset adjustments emit LF-PPTX-PRESET-ADJUSTMENT-IGNORED.
  it('emits LF-PPTX-PRESET-ADJUSTMENT-IGNORED for unhonored callout adjustments', async () => {
    const tree = await parsePptx(buildAdjustedShapesFixture());
    const ignored = tree.lossFlags.filter((f) => f.code === 'LF-PPTX-PRESET-ADJUSTMENT-IGNORED');
    expect(ignored.length).toBe(2);
    expect(ignored.every((f) => f.severity === 'info')).toBe(true);
    expect(ignored.every((f) => f.category === 'shape')).toBe(true);
    const snippets = ignored.map((f) => f.originalSnippet).sort();
    expect(snippets).toEqual(['wedgeRectCallout.adj1=-30000', 'wedgeRectCallout.adj2=50000']);
  });

  // Determinism — same input -> same output (incl. flag ids).
  it('is deterministic: same buffer in, same loss-flag ids out', async () => {
    const a = await parsePptx(buildPictureFixture());
    const b = await parsePptx(buildPictureFixture());
    expect(a.lossFlags.map((f) => f.id)).toEqual(b.lossFlags.map((f) => f.id));
  });

  // T-243b — video fixture parses and emits a single ParsedVideoElement.
  it('emits ParsedVideoElement for a <p:videoFile> fixture (T-243b)', async () => {
    const tree = await parsePptx(buildVideoFixture());
    const slide = tree.slides[0];
    expect(slide).toBeDefined();
    const v = slide?.elements[0];
    expect(v?.type).toBe('video');
    if (v?.type !== 'video') return;
    const video = v as ParsedVideoElement;
    expect(video.src.kind).toBe('unresolved');
    if (video.src.kind !== 'unresolved') return;
    expect(video.src.oocxmlPath).toBe('ppt/media/video1.mp4');
    const flag = tree.lossFlags.find((f) => f.code === 'LF-PPTX-UNRESOLVED-VIDEO');
    expect(flag).toBeDefined();
  });

  // T-243b AC #15 — full pipeline emits zero unresolved-asset flags after resolveAssets.
  it('parsePptx → resolveAssets clears every unresolved-asset flag for an image+video fixture', async () => {
    const buf = buildVideoAndImageFixture();
    const tree = await parsePptx(buf);

    // Pre-resolve: both flags are present.
    expect(tree.lossFlags.find((f) => f.code === 'LF-PPTX-UNRESOLVED-ASSET')).toBeDefined();
    expect(tree.lossFlags.find((f) => f.code === 'LF-PPTX-UNRESOLVED-VIDEO')).toBeDefined();

    const storage: AssetStorage = {
      async put(_bytes, opts) {
        return { id: opts.contentHash.slice(0, 16) };
      },
    };
    const resolved = await resolveAssets(tree, unpackPptx(buf), storage);

    expect(resolved.lossFlags.find((f) => f.code === 'LF-PPTX-UNRESOLVED-ASSET')).toBeUndefined();
    expect(resolved.lossFlags.find((f) => f.code === 'LF-PPTX-UNRESOLVED-VIDEO')).toBeUndefined();
    expect(
      resolved.lossFlags.find((f) => f.code === 'LF-PPTX-MISSING-ASSET-BYTES'),
    ).toBeUndefined();

    // And the elements themselves are resolved.
    const slide = resolved.slides[0];
    const img = slide?.elements.find((e) => e.type === 'image');
    const vid = slide?.elements.find((e) => e.type === 'video');
    expect(img?.type === 'image' && img.src.kind === 'resolved').toBe(true);
    expect(vid?.type === 'video' && vid.src.kind === 'resolved').toBe(true);
  });
});
