// packages/import-pptx/src/elements/video.test.ts
// T-243b acceptance tests for the parser layer (ACs #1-#9). Written first;
// the `parseVideo` stub returns `{ flags: [] }` until the implementation
// lands, so every test below fails on a clean checkout.

import { strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { OpcRelMap, OrderedXmlNode } from '../opc.js';
import { firstChild, parseXml } from '../opc.js';
import { walkSpTree } from '../parts/sp-tree.js';
import type { ParsedVideoElement } from '../types.js';
import type { ZipEntries } from '../zip.js';

const NS = `xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`;

/**
 * Build a `<p:spTree>` root containing a single `<p:sp>` plus an outer
 * `<p:nvGrpSpPr>` skeleton. Returns the OrderedXmlNode for the tree.
 */
function makeSpTree(spXml: string): OrderedXmlNode {
  const xml = `<?xml version="1.0"?>
<p:spTree ${NS}>
<p:nvGrpSpPr><p:cNvPr id="1" name="root"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr/>
${spXml}
</p:spTree>`;
  const entries: ZipEntries = { 'tmp.xml': strToU8(xml) };
  const doc = parseXml(entries, 'tmp.xml');
  const tree = firstChild(doc, 'p:spTree');
  if (tree === undefined) throw new Error('failed to parse test XML');
  return tree;
}

/** Wrap a `<p:videoFile>` into a `<p:sp>` skeleton with the given xfrm. */
function spVideoXml(args: {
  id: number;
  name: string;
  relAttr: 'r:embed' | 'r:link';
  relId: string;
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  withBody?: boolean;
}): string {
  const x = args.x ?? 0;
  const y = args.y ?? 0;
  const cx = args.cx ?? 4000000;
  const cy = args.cy ?? 3000000;
  const body =
    args.withBody === true
      ? '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>caption</a:t></a:r></a:p></p:txBody>'
      : '';
  const geom = args.withBody === true ? '<a:custGeom><a:pathLst/></a:custGeom>' : '';
  return `<p:sp>
<p:nvSpPr>
<p:cNvPr id="${args.id}" name="${args.name}"/>
<p:cNvSpPr/>
<p:nvPr><p:videoFile ${args.relAttr}="${args.relId}"/></p:nvPr>
</p:nvSpPr>
<p:spPr>
<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
${geom}
</p:spPr>
${body}
</p:sp>`;
}

/** Wrap a plain `<p:sp>` (no video extension, with text body). */
function spPlainTextXml(): string {
  return `<p:sp>
<p:nvSpPr>
<p:cNvPr id="42" name="PlainShape"/>
<p:cNvSpPr/>
<p:nvPr/>
</p:nvSpPr>
<p:spPr>
<a:xfrm><a:off x="0" y="0"/><a:ext cx="1000000" cy="500000"/></a:xfrm>
<a:prstGeom prst="rect"/>
</p:spPr>
<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>plain</a:t></a:r></a:p></p:txBody>
</p:sp>`;
}

/** Build a synthetic context with the given rels map. */
function ctxWith(rels: OpcRelMap): {
  slideId: string;
  oocxmlPath: string;
  rels: OpcRelMap;
} {
  return { slideId: 'slide_1', oocxmlPath: 'ppt/slides/slide1.xml', rels };
}

const RELS_INTERNAL_EMBED: OpcRelMap = {
  rIdVid1: {
    id: 'rIdVid1',
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/video',
    target: '../media/video1.mp4',
    resolvedTarget: 'ppt/media/video1.mp4',
  },
};

const RELS_INTERNAL_LINK: OpcRelMap = {
  rIdVid1: {
    id: 'rIdVid1',
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/video',
    target: '../media/video1.mp4',
    resolvedTarget: 'ppt/media/video1.mp4',
    targetMode: 'Internal',
  },
};

const RELS_EXTERNAL_LINK: OpcRelMap = {
  rIdVid1: {
    id: 'rIdVid1',
    type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/video',
    target: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    resolvedTarget: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    targetMode: 'External',
  },
};

describe('parseVideo / walkSpTree video dispatch — T-243b ACs #1–#9', () => {
  // AC #1
  it('parses <p:sp> with <p:videoFile r:link> + Internal rel as a ParsedVideoElement (unresolved)', () => {
    const sp = spVideoXml({ id: 7, name: 'Vid', relAttr: 'r:link', relId: 'rIdVid1' });
    const tree = makeSpTree(sp);
    const out = walkSpTree(tree, ctxWith(RELS_INTERNAL_LINK));

    expect(out.elements.length).toBe(1);
    const el = out.elements[0];
    expect(el?.type).toBe('video');
    if (el?.type !== 'video') return;
    const v = el as ParsedVideoElement;
    expect(v.src.kind).toBe('unresolved');
    if (v.src.kind !== 'unresolved') return;
    expect(v.src.oocxmlPath).toBe('ppt/media/video1.mp4');
  });

  // AC #2 — r:embed maps to the same in-ZIP byte path.
  it('parses <p:sp> with <p:videoFile r:embed> as a ParsedVideoElement (unresolved)', () => {
    const sp = spVideoXml({ id: 7, name: 'Vid', relAttr: 'r:embed', relId: 'rIdVid1' });
    const tree = makeSpTree(sp);
    const out = walkSpTree(tree, ctxWith(RELS_INTERNAL_EMBED));

    expect(out.elements.length).toBe(1);
    const el = out.elements[0];
    expect(el?.type).toBe('video');
    if (el?.type !== 'video') return;
    const v = el as ParsedVideoElement;
    expect(v.src.kind).toBe('unresolved');
    if (v.src.kind !== 'unresolved') return;
    expect(v.src.oocxmlPath).toBe('ppt/media/video1.mp4');
  });

  // AC #3 — walker dispatch positive case: shape body dropped on video extension.
  it('emits exactly one ParsedVideoElement (zero ParsedShapeElements) when a <p:sp> carries body + <p:videoFile>', () => {
    const sp = spVideoXml({
      id: 7,
      name: 'VideoWithBody',
      relAttr: 'r:link',
      relId: 'rIdVid1',
      withBody: true,
    });
    const tree = makeSpTree(sp);
    const out = walkSpTree(tree, ctxWith(RELS_INTERNAL_LINK));

    const videos = out.elements.filter((e) => e.type === 'video');
    const shapes = out.elements.filter(
      (e) => e.type === 'shape' || e.type === 'text' || e.type === 'unsupported-shape',
    );
    expect(videos.length).toBe(1);
    expect(shapes.length).toBe(0);

    const dropFlag = out.flags.find(
      (f) =>
        f.code === 'LF-PPTX-UNSUPPORTED-ELEMENT' &&
        f.originalSnippet === 'shape body dropped on video extension',
    );
    expect(dropFlag).toBeDefined();
  });

  // AC #4 — walker dispatch external-URL case.
  it('emits ParsedShapeElement + LF-PPTX-UNSUPPORTED-ELEMENT for external r:link videos (no ParsedVideoElement)', () => {
    const sp = spVideoXml({ id: 7, name: 'ExtVid', relAttr: 'r:link', relId: 'rIdVid1' });
    const tree = makeSpTree(sp);
    const out = walkSpTree(tree, ctxWith(RELS_EXTERNAL_LINK));

    const videos = out.elements.filter((e) => e.type === 'video');
    expect(videos.length).toBe(0);

    const externalFlag = out.flags.find(
      (f) => f.code === 'LF-PPTX-UNSUPPORTED-ELEMENT' && f.originalSnippet === 'external video URL',
    );
    expect(externalFlag).toBeDefined();
  });

  // AC #5 — no <p:videoFile> child: existing parseShape path runs unchanged.
  it('leaves a plain <p:sp> (no <p:videoFile>) parsing as a ParsedShapeElement / TextElement', () => {
    const sp = spPlainTextXml();
    const tree = makeSpTree(sp);
    const out = walkSpTree(tree, ctxWith({}));

    expect(out.elements.length).toBe(1);
    const el = out.elements[0];
    // The plain shape has a text body so it surfaces as 'text' (existing parseShape behavior).
    expect(el?.type === 'text' || el?.type === 'shape').toBe(true);
    expect(out.flags.find((f) => f.code === 'LF-PPTX-UNSUPPORTED-ELEMENT')).toBeUndefined();
  });

  // AC #6 — transform extracted from <a:xfrm>.
  it('lifts the <p:sp> <a:xfrm> into ParsedVideoElement.transform (frame coords)', () => {
    const sp = spVideoXml({
      id: 7,
      name: 'V',
      relAttr: 'r:embed',
      relId: 'rIdVid1',
      x: 914400, // 1 inch
      y: 1828800, // 2 inches
      cx: 6858000, // 7.2 inches
      cy: 1143000, // 1.2 inches
    });
    const tree = makeSpTree(sp);
    const out = walkSpTree(tree, ctxWith(RELS_INTERNAL_EMBED));
    const el = out.elements[0];
    expect(el?.type).toBe('video');
    if (el?.type !== 'video') return;
    // EMU→px at 96 DPI: 914400 / 9525 = 96 px exactly.
    expect(el.transform.x).toBeCloseTo(96, 0);
    expect(el.transform.y).toBeCloseTo(192, 0);
    expect(el.transform.width).toBeCloseTo(720, 0);
    expect(el.transform.height).toBeCloseTo(120, 0);
  });

  // AC #7 — id derives from <p:cNvPr id> via makeElementId.
  it('derives ParsedVideoElement.id from <p:cNvPr id="…"> via makeElementId (`pptx_<id>`)', () => {
    const sp = spVideoXml({ id: 42, name: 'V', relAttr: 'r:embed', relId: 'rIdVid1' });
    const tree = makeSpTree(sp);
    const out = walkSpTree(tree, ctxWith(RELS_INTERNAL_EMBED));
    expect(out.elements[0]?.id).toBe('pptx_42');
  });

  // AC #8 — name inherits from <p:cNvPr name>.
  it('inherits ParsedVideoElement.name from <p:cNvPr name="…">', () => {
    const sp = spVideoXml({ id: 7, name: 'Hero Reel', relAttr: 'r:embed', relId: 'rIdVid1' });
    const tree = makeSpTree(sp);
    const out = walkSpTree(tree, ctxWith(RELS_INTERNAL_EMBED));
    const el = out.elements[0];
    expect(el?.type).toBe('video');
    if (el?.type !== 'video') return;
    expect(el.name).toBe('Hero Reel');
  });

  // AC #9 — LF-PPTX-UNRESOLVED-VIDEO emits with severity/category/location/snippet.
  it('emits LF-PPTX-UNRESOLVED-VIDEO (info / media) keyed to elementId, snippet=relId', () => {
    const sp = spVideoXml({ id: 9, name: 'V', relAttr: 'r:link', relId: 'rIdVid1' });
    const tree = makeSpTree(sp);
    const out = walkSpTree(tree, ctxWith(RELS_INTERNAL_LINK));

    const flag = out.flags.find((f) => f.code === 'LF-PPTX-UNRESOLVED-VIDEO');
    expect(flag).toBeDefined();
    expect(flag?.severity).toBe('info');
    expect(flag?.category).toBe('media');
    expect(flag?.location.elementId).toBe('pptx_9');
    expect(flag?.originalSnippet).toBe('rIdVid1');
  });
});
