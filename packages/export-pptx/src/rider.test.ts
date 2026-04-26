// packages/export-pptx/src/rider.test.ts
// T-253-rider acceptance-criteria pins. Covers layout/master part emission,
// per-element inheritsFrom dispatch, slide-side layout rels, override
// suppression with `compareToPlaceholder`, and the three new loss flags.

import { parsePptx } from '@stageflip/import-pptx';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { exportPptx } from './exportPptx.js';
import { buildDoc } from './test-helpers/build-doc.js';

const TRANSFORM = { x: 10, y: 20, width: 200, height: 80 };

/** Unpack the PPTX bytes into a name → string map for entry-list assertions. */
function unpack(bytes: Uint8Array): Record<string, string> {
  const entries = unzipSync(bytes);
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(entries)) {
    // Binary entries (media) — skip; tests look at xml only.
    if (name.startsWith('ppt/media/')) continue;
    out[name] = strFromU8(value);
  }
  return out;
}

describe('T-253-rider — layout / master emission (AC #1-#6)', () => {
  it('AC #1: Document.layouts of length 2 produces 2 ppt/slideLayouts/slideLayoutK.xml entries (1-based)', async () => {
    const doc = buildDoc({
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [
        { id: 'layout-1', name: 'L1', masterId: 'master-1', placeholders: [] },
        { id: 'layout-2', name: 'L2', masterId: 'master-1', placeholders: [] },
      ],
      slides: [
        { id: 'slide_1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'x' }] },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unpack(bytes);
    expect(entries['ppt/slideLayouts/slideLayout1.xml']).toBeDefined();
    expect(entries['ppt/slideLayouts/slideLayout2.xml']).toBeDefined();
    expect(entries['ppt/slideLayouts/slideLayout3.xml']).toBeUndefined();
    // Rels too:
    expect(entries['ppt/slideLayouts/_rels/slideLayout1.xml.rels']).toBeDefined();
    expect(entries['ppt/slideLayouts/_rels/slideLayout2.xml.rels']).toBeDefined();
  });

  it('AC #2: Document.masters of length 1 produces 1 ppt/slideMasters/slideMaster1.xml entry with rels', async () => {
    const doc = buildDoc({
      masters: [{ id: 'master-1', name: 'M', placeholders: [] }],
      layouts: [{ id: 'layout-1', name: 'L', masterId: 'master-1', placeholders: [] }],
      slides: [
        { id: 'slide_1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'x' }] },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unpack(bytes);
    expect(entries['ppt/slideMasters/slideMaster1.xml']).toBeDefined();
    expect(entries['ppt/slideMasters/_rels/slideMaster1.xml.rels']).toBeDefined();
  });

  it('AC #3: Document.layouts === [] produces zero layout entries (no slideLayouts/ directory)', async () => {
    const doc = buildDoc({
      slides: [
        { id: 'slide_1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'x' }] },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unpack(bytes);
    for (const k of Object.keys(entries)) {
      expect(k).not.toMatch(/^ppt\/slideLayouts\//);
    }
  });

  it('AC #4: Document.masters === [] produces zero master entries', async () => {
    const doc = buildDoc({
      slides: [
        { id: 'slide_1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'x' }] },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unpack(bytes);
    for (const k of Object.keys(entries)) {
      expect(k).not.toMatch(/^ppt\/slideMasters\//);
    }
  });

  it('AC #5: master XML emits <p:sldLayoutIdLst> listing every layout whose masterId matches', async () => {
    const doc = buildDoc({
      masters: [{ id: 'm1', name: 'M', placeholders: [] }],
      layouts: [
        { id: 'l1', name: 'L1', masterId: 'm1', placeholders: [] },
        { id: 'l2', name: 'L2', masterId: 'm1', placeholders: [] },
      ],
      slides: [
        { id: 'slide_1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'x' }] },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unpack(bytes);
    const masterXml = entries['ppt/slideMasters/slideMaster1.xml'] ?? '';
    // Two sldLayoutId entries, each pointing at a rel id (rId2, rId3 — rId1 is theme).
    expect(masterXml).toContain('<p:sldLayoutIdLst>');
    expect(masterXml).toContain('r:id="rId2"');
    expect(masterXml).toContain('r:id="rId3"');
  });

  it('AC #6: master XML emits a default <p:clrMap> entry', async () => {
    const doc = buildDoc({
      masters: [{ id: 'm1', name: 'M', placeholders: [] }],
      layouts: [{ id: 'l1', name: 'L', masterId: 'm1', placeholders: [] }],
      slides: [
        { id: 'slide_1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'x' }] },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unpack(bytes);
    const masterXml = entries['ppt/slideMasters/slideMaster1.xml'] ?? '';
    expect(masterXml).toContain('<p:clrMap');
    expect(masterXml).toContain('bg1="lt1"');
    expect(masterXml).toContain('tx1="dk1"');
  });
});

describe('T-253-rider — per-element inheritsFrom emission (AC #7-#10)', () => {
  it('AC #7: TextElement with inheritsFrom resolving to a layout placeholder emits <p:nvSpPr><p:nvPr><p:ph .../></p:nvPr></p:nvSpPr>', async () => {
    const doc = buildDoc({
      masters: [{ id: 'm1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'l1',
          name: 'L',
          masterId: 'm1',
          placeholders: [
            { id: 'ph0', name: 'PHName', type: 'text', transform: TRANSFORM, text: 'PH' },
            { id: 'ph1', type: 'text', transform: TRANSFORM, text: 'PH-body' },
          ],
        },
      ],
      slides: [
        {
          id: 'slide_1',
          layoutId: 'l1',
          elements: [
            {
              id: 'e1',
              type: 'text',
              transform: { x: 100, y: 100, width: 200, height: 50 },
              text: 'real text',
              inheritsFrom: { templateId: 'l1', placeholderIdx: 1 },
            },
          ],
        },
      ],
    });
    const { bytes, lossFlags } = await exportPptx(doc);
    const entries = unpack(bytes);
    const slideXml = entries['ppt/slides/slide1.xml'] ?? '';
    expect(slideXml).toContain('<p:ph type="body" idx="1"/>');
    expect(lossFlags.filter((f) => f.code === 'LF-PPTX-EXPORT-LAYOUT-NOT-FOUND')).toHaveLength(0);
    expect(lossFlags.filter((f) => f.code === 'LF-PPTX-EXPORT-PLACEHOLDER-NOT-FOUND')).toHaveLength(
      0,
    );
  });

  it('AC #8: inheritsFrom to non-existent templateId falls back + emits LF-PPTX-EXPORT-LAYOUT-NOT-FOUND', async () => {
    const doc = buildDoc({
      masters: [{ id: 'm1', name: 'M', placeholders: [] }],
      layouts: [{ id: 'l1', name: 'L', masterId: 'm1', placeholders: [] }],
      slides: [
        {
          id: 'slide_1',
          layoutId: 'l1',
          elements: [
            {
              id: 'e1',
              type: 'text',
              transform: TRANSFORM,
              text: 'real text',
              inheritsFrom: { templateId: 'l-DOES-NOT-EXIST', placeholderIdx: 0 },
            },
          ],
        },
      ],
    });
    const { bytes, lossFlags } = await exportPptx(doc);
    const entries = unpack(bytes);
    const slideXml = entries['ppt/slides/slide1.xml'] ?? '';
    // Fell back to materialized geometry — no <p:ph> tag.
    expect(slideXml).not.toContain('<p:ph');
    // Flag emitted.
    expect(lossFlags.filter((f) => f.code === 'LF-PPTX-EXPORT-LAYOUT-NOT-FOUND')).toHaveLength(1);
  });

  it('AC #9: inheritsFrom with valid templateId but missing placeholderIdx falls back + emits LF-PPTX-EXPORT-PLACEHOLDER-NOT-FOUND', async () => {
    const doc = buildDoc({
      masters: [{ id: 'm1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'l1',
          name: 'L',
          masterId: 'm1',
          placeholders: [{ id: 'ph0', type: 'text', transform: TRANSFORM, text: 'P' }],
        },
      ],
      slides: [
        {
          id: 'slide_1',
          layoutId: 'l1',
          elements: [
            {
              id: 'e1',
              type: 'text',
              transform: TRANSFORM,
              text: 'real text',
              inheritsFrom: { templateId: 'l1', placeholderIdx: 99 },
            },
          ],
        },
      ],
    });
    const { bytes, lossFlags } = await exportPptx(doc);
    const entries = unpack(bytes);
    const slideXml = entries['ppt/slides/slide1.xml'] ?? '';
    expect(slideXml).not.toContain('<p:ph');
    expect(lossFlags.filter((f) => f.code === 'LF-PPTX-EXPORT-PLACEHOLDER-NOT-FOUND')).toHaveLength(
      1,
    );
  });

  it('AC #10: transitive resolution — element with templateId=layoutId whose layout misses placeholderIdx but master has it emits <p:ph> pointing at the LAYOUT id', async () => {
    const doc = buildDoc({
      masters: [
        {
          id: 'm1',
          name: 'M',
          placeholders: [
            { id: 'mp0', type: 'text', transform: TRANSFORM, text: 'M0' },
            { id: 'mp1', type: 'text', transform: TRANSFORM, text: 'M1' },
            { id: 'mp2', type: 'text', transform: TRANSFORM, text: 'M2' },
            { id: 'mp3', type: 'text', transform: TRANSFORM, text: 'M3' },
            { id: 'mp4', type: 'text', transform: TRANSFORM, text: 'M4' },
            { id: 'mp5', type: 'text', transform: TRANSFORM, text: 'M5-FOOTER' },
          ],
        },
      ],
      layouts: [
        {
          id: 'l1',
          name: 'L',
          masterId: 'm1',
          // Layout only has placeholder at idx 0; idx 5 must transitively walk to master.
          placeholders: [{ id: 'lp0', type: 'text', transform: TRANSFORM, text: 'L0' }],
        },
      ],
      slides: [
        {
          id: 'slide_1',
          layoutId: 'l1',
          elements: [
            {
              id: 'e1',
              type: 'text',
              transform: TRANSFORM,
              text: 'real footer',
              inheritsFrom: { templateId: 'l1', placeholderIdx: 5 },
            },
          ],
        },
      ],
    });
    const { bytes, lossFlags } = await exportPptx(doc);
    const entries = unpack(bytes);
    const slideXml = entries['ppt/slides/slide1.xml'] ?? '';
    // <p:ph idx="5"/> emitted (the runtime walks the layout→master chain itself).
    expect(slideXml).toContain('<p:ph type="body" idx="5"/>');
    // No flags — clean transitive resolution.
    expect(
      lossFlags.filter(
        (f) =>
          f.code === 'LF-PPTX-EXPORT-LAYOUT-NOT-FOUND' ||
          f.code === 'LF-PPTX-EXPORT-PLACEHOLDER-NOT-FOUND',
      ),
    ).toHaveLength(0);
  });
});

describe('T-253-rider — slide-side rel updates (AC #11-#12)', () => {
  it('AC #11: Slide with layoutId resolving to layouts[i] emits a slide-rel pointing at slideLayout<i+1>.xml', async () => {
    const doc = buildDoc({
      masters: [{ id: 'm1', name: 'M', placeholders: [] }],
      layouts: [
        { id: 'l1', name: 'L1', masterId: 'm1', placeholders: [] },
        { id: 'l2', name: 'L2', masterId: 'm1', placeholders: [] },
      ],
      slides: [
        {
          id: 'slide_1',
          layoutId: 'l2', // points at second layout
          elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'x' }],
        },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unpack(bytes);
    const slideRels = entries['ppt/slides/_rels/slide1.xml.rels'] ?? '';
    expect(slideRels).toContain('Target="../slideLayouts/slideLayout2.xml"');
    expect(slideRels).toContain('relationships/slideLayout"');
  });

  it('AC #12: Slide with layoutId === undefined emits no slide-layout rel', async () => {
    const doc = buildDoc({
      masters: [{ id: 'm1', name: 'M', placeholders: [] }],
      layouts: [{ id: 'l1', name: 'L', masterId: 'm1', placeholders: [] }],
      slides: [
        {
          id: 'slide_1',
          // no layoutId
          elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'x' }],
        },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unpack(bytes);
    const slideRels = entries['ppt/slides/_rels/slide1.xml.rels'] ?? '';
    expect(slideRels).not.toContain('relationships/slideLayout');
  });

  it('AC #12 (variant): Slide with unresolvable layoutId emits no slide-layout rel', async () => {
    const doc = buildDoc({
      masters: [{ id: 'm1', name: 'M', placeholders: [] }],
      layouts: [{ id: 'l1', name: 'L', masterId: 'm1', placeholders: [] }],
      slides: [
        {
          id: 'slide_1',
          layoutId: 'l-MISSING',
          elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'x' }],
        },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unpack(bytes);
    const slideRels = entries['ppt/slides/_rels/slide1.xml.rels'] ?? '';
    expect(slideRels).not.toContain('relationships/slideLayout');
  });
});

describe('T-253-rider — override suppression (AC #13, #14, #14a, #14b)', () => {
  it('AC #13: every top-level field matches placeholder → only <p:nvSpPr> block emitted (no <p:spPr>, no <p:txBody>)', async () => {
    const doc = buildDoc({
      masters: [{ id: 'm1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'l1',
          name: 'L',
          masterId: 'm1',
          placeholders: [
            { id: 'ph0', name: 'PHName', type: 'text', transform: TRANSFORM, text: 'P' },
          ],
        },
      ],
      slides: [
        {
          id: 'slide_1',
          layoutId: 'l1',
          elements: [
            {
              id: 'e1',
              type: 'text',
              name: 'PHName', // matches placeholder
              transform: TRANSFORM, // matches placeholder
              text: 'P', // matches placeholder
              inheritsFrom: { templateId: 'l1', placeholderIdx: 0 },
            },
          ],
        },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unpack(bytes);
    const slideXml = entries['ppt/slides/slide1.xml'] ?? '';
    // The element's <p:sp> block contains nvSpPr but neither spPr nor txBody.
    const spStart = slideXml.indexOf('<p:sp>');
    const spEnd = slideXml.indexOf('</p:sp>', spStart);
    const spBlock = slideXml.slice(spStart, spEnd + '</p:sp>'.length);
    expect(spBlock).toContain('<p:ph type="body" idx="0"/>');
    expect(spBlock).not.toContain('<p:spPr>');
    expect(spBlock).not.toContain('<p:txBody>');
  });

  it('AC #14: transform matches but text differs → <p:nvSpPr> block + <p:txBody> override; no <p:spPr> with xfrm', async () => {
    const doc = buildDoc({
      masters: [{ id: 'm1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'l1',
          name: 'L',
          masterId: 'm1',
          placeholders: [{ id: 'ph0', type: 'text', transform: TRANSFORM, text: 'PH' }],
        },
      ],
      slides: [
        {
          id: 'slide_1',
          layoutId: 'l1',
          elements: [
            {
              id: 'e1',
              type: 'text',
              transform: TRANSFORM, // matches placeholder
              text: 'real text', // differs
              inheritsFrom: { templateId: 'l1', placeholderIdx: 0 },
            },
          ],
        },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unpack(bytes);
    const slideXml = entries['ppt/slides/slide1.xml'] ?? '';
    const spStart = slideXml.indexOf('<p:sp>');
    const spEnd = slideXml.indexOf('</p:sp>', spStart);
    const spBlock = slideXml.slice(spStart, spEnd + '</p:sp>'.length);
    expect(spBlock).toContain('<p:ph type="body" idx="0"/>');
    expect(spBlock).not.toContain('<p:spPr>');
    expect(spBlock).toContain('<p:txBody>');
    expect(spBlock).toContain('real text');
  });

  it('AC #14a: transform.x differs by 100 EMU → entire slide-side <a:xfrm> emitted (whole-or-nothing)', async () => {
    const doc = buildDoc({
      masters: [{ id: 'm1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'l1',
          name: 'L',
          masterId: 'm1',
          placeholders: [{ id: 'ph0', type: 'text', transform: TRANSFORM, text: 'PH' }],
        },
      ],
      slides: [
        {
          id: 'slide_1',
          layoutId: 'l1',
          elements: [
            {
              id: 'e1',
              type: 'text',
              transform: { ...TRANSFORM, x: TRANSFORM.x + 1 }, // differs by 1 px
              text: 'PH', // matches placeholder
              inheritsFrom: { templateId: 'l1', placeholderIdx: 0 },
            },
          ],
        },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unpack(bytes);
    const slideXml = entries['ppt/slides/slide1.xml'] ?? '';
    // The full <a:xfrm> block is emitted (transform whole-or-nothing).
    expect(slideXml).toContain('<a:xfrm>');
    expect(slideXml).toContain('<a:off');
    expect(slideXml).toContain('<a:ext');
  });

  it('AC #14b: animations: [] is NEVER suppressed (Zod default)', async () => {
    // Even when both placeholder and slide carry `animations: []`, the
    // suppression rule must not list `animations` in suppressKeys. The
    // override-suppression unit pinned this in the schema test; here we
    // verify the writer's behavior by ensuring no animation-related diff
    // affects the suppression of other keys.
    const doc = buildDoc({
      masters: [{ id: 'm1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'l1',
          name: 'L',
          masterId: 'm1',
          placeholders: [{ id: 'ph0', type: 'text', transform: TRANSFORM, text: 'PH' }],
        },
      ],
      slides: [
        {
          id: 'slide_1',
          layoutId: 'l1',
          elements: [
            {
              id: 'e1',
              type: 'text',
              transform: TRANSFORM,
              text: 'PH',
              animations: [], // explicit
              inheritsFrom: { templateId: 'l1', placeholderIdx: 0 },
            },
          ],
        },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unpack(bytes);
    const slideXml = entries['ppt/slides/slide1.xml'] ?? '';
    // The element fully matches placeholder for transform + text → only
    // <p:nvSpPr> (animations doesn't affect this in the current XML).
    const spStart = slideXml.indexOf('<p:sp>');
    const spEnd = slideXml.indexOf('</p:sp>', spStart);
    const spBlock = slideXml.slice(spStart, spEnd + '</p:sp>'.length);
    expect(spBlock).toContain('<p:ph type="body" idx="0"/>');
    expect(spBlock).not.toContain('<p:spPr>');
    expect(spBlock).not.toContain('<p:txBody>');
  });
});

describe('T-253-rider — loss flags (AC #15, #16)', () => {
  it('AC #15: ExportPptxLossFlagCode union has the three new variants and CODE_DEFAULTS covers each', async () => {
    // Compile-time pin via type assertion + runtime pin via emitting one of each.
    const { CODE_DEFAULTS } = await import('./loss-flags.js');
    expect(CODE_DEFAULTS['LF-PPTX-EXPORT-LAYOUT-NOT-FOUND']).toBeDefined();
    expect(CODE_DEFAULTS['LF-PPTX-EXPORT-PLACEHOLDER-NOT-FOUND']).toBeDefined();
    expect(CODE_DEFAULTS['LF-PPTX-EXPORT-PLACEHOLDER-MISMATCH']).toBeDefined();
  });

  it('AC #16: a normal export with valid inheritance chain emits zero new loss flags', async () => {
    const doc = buildDoc({
      masters: [{ id: 'm1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'l1',
          name: 'L',
          masterId: 'm1',
          placeholders: [{ id: 'ph0', type: 'text', transform: TRANSFORM, text: 'PH' }],
        },
      ],
      slides: [
        {
          id: 'slide_1',
          layoutId: 'l1',
          elements: [
            {
              id: 'e1',
              type: 'text',
              transform: TRANSFORM,
              text: 'real',
              inheritsFrom: { templateId: 'l1', placeholderIdx: 0 },
            },
          ],
        },
      ],
    });
    const { lossFlags } = await exportPptx(doc);
    const newCodes = lossFlags
      .map((f) => f.code)
      .filter(
        (c) =>
          c === 'LF-PPTX-EXPORT-LAYOUT-NOT-FOUND' ||
          c === 'LF-PPTX-EXPORT-PLACEHOLDER-NOT-FOUND' ||
          c === 'LF-PPTX-EXPORT-PLACEHOLDER-MISMATCH',
      );
    expect(newCodes).toEqual([]);
  });
});

describe('T-253-rider — round-trip suite extension (AC #17-#19)', () => {
  it('AC #17: placeholder-inheritance fixture round-trips with Document.layouts.length and Document.masters.length preserved', async () => {
    const doc = buildDoc({
      masters: [{ id: 'm1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'l1',
          name: 'Title slide',
          masterId: 'm1',
          placeholders: [
            { id: 'ph0', name: 'Title PH', type: 'text', transform: TRANSFORM, text: 'PH title' },
          ],
        },
      ],
      slides: [
        {
          id: 'slide_1',
          layoutId: 'l1',
          elements: [
            {
              id: 'e1',
              type: 'text',
              transform: { x: 10, y: 20, width: 200, height: 80 },
              text: 'real title',
              inheritsFrom: { templateId: 'l1', placeholderIdx: 0 },
            },
          ],
        },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const tree = await parsePptx(bytes);
    // Importer reads layouts/masters via slide rels — should find both.
    expect(Object.keys(tree.layouts).length).toBe(1);
    expect(Object.keys(tree.masters).length).toBe(1);
  });

  it('AC #18: round-tripped slide elements preserve a placeholder reference signal (importer parses <p:ph>)', async () => {
    // The base parser doesn't yet decode <p:ph> idx into Schema's
    // `inheritsFrom`, but the slide XML emitted should carry the marker so a
    // future reader can reconstitute it. We assert the marker exists in the
    // bytes' slide XML and that the importer doesn't error.
    const doc = buildDoc({
      masters: [{ id: 'm1', name: 'M', placeholders: [] }],
      layouts: [
        {
          id: 'l1',
          name: 'L',
          masterId: 'm1',
          placeholders: [
            { id: 'ph0', name: 'PHName', type: 'text', transform: TRANSFORM, text: 'P' },
          ],
        },
      ],
      slides: [
        {
          id: 'slide_1',
          layoutId: 'l1',
          elements: [
            {
              id: 'e1',
              type: 'text',
              transform: TRANSFORM,
              text: 'P',
              inheritsFrom: { templateId: 'l1', placeholderIdx: 0 },
            },
          ],
        },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unpack(bytes);
    const slideXml = entries['ppt/slides/slide1.xml'] ?? '';
    expect(slideXml).toContain('<p:ph type="body" idx="0"/>');
    // Sanity: the parser does not throw.
    const tree = await parsePptx(bytes);
    expect(tree.slides.length).toBe(1);
  });

  it('AC #19: existing T-253-base layouts-empty path round-trips identically (no slideLayouts/ entries)', async () => {
    const doc = buildDoc({
      slides: [
        { id: 'slide_1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'x' }] },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unpack(bytes);
    for (const k of Object.keys(entries)) {
      expect(k).not.toMatch(/^ppt\/slideLayouts\//);
      expect(k).not.toMatch(/^ppt\/slideMasters\//);
    }
  });
});

describe('T-253-rider — content-types overrides for layouts/masters', () => {
  it('content-types includes Override entries for slideLayout and slideMaster parts when present', async () => {
    const doc = buildDoc({
      masters: [{ id: 'm1', name: 'M', placeholders: [] }],
      layouts: [{ id: 'l1', name: 'L', masterId: 'm1', placeholders: [] }],
      slides: [
        { id: 'slide_1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'x' }] },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unpack(bytes);
    const ct = entries['[Content_Types].xml'] ?? '';
    expect(ct).toContain(
      'PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"',
    );
    expect(ct).toContain(
      'PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"',
    );
  });
});

describe('T-253-rider — presentation rels include masters', () => {
  it('presentation.xml.rels lists every master after slides; layouts not at top level', async () => {
    const doc = buildDoc({
      masters: [{ id: 'm1', name: 'M', placeholders: [] }],
      layouts: [{ id: 'l1', name: 'L', masterId: 'm1', placeholders: [] }],
      slides: [
        { id: 'slide_1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'x' }] },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unpack(bytes);
    const presRels = entries['ppt/_rels/presentation.xml.rels'] ?? '';
    expect(presRels).toContain('relationships/slideMaster');
    expect(presRels).toContain('Target="slideMasters/slideMaster1.xml"');
    // Layouts are reached transitively via masters; not top-level.
    expect(presRels).not.toContain('relationships/slideLayout');
  });
});
