// packages/import-pptx/src/parts/embedded-fonts.test.ts
// T-243c acceptance tests for the parser layer (ACs #1-#7 and the
// unresolved-relId edge from AC #8). Synthetic in-memory ZipEntries
// exercise `readEmbeddedFonts` directly without rebuilding a full PPTX
// fixture per case. The full-pipeline AC (#14) lives in `parsePptx.test.ts`.

import { strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { ZipEntries } from '../zip.js';
import { readEmbeddedFonts } from './embedded-fonts.js';

const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL_TYPE_FONT = `${NS_R}/font`;

const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

interface RelRow {
  id: string;
  type?: string;
  target: string;
  targetMode?: 'Internal' | 'External';
}

/** Wrap one or more `<p:embeddedFont>` blocks into a presentation.xml. */
function presentationXml(embeddedFontBlocks: string[]): string {
  const lst =
    embeddedFontBlocks.length === 0
      ? ''
      : `<p:embeddedFontLst>${embeddedFontBlocks.join('')}</p:embeddedFontLst>`;
  return `${xmlHeader}
<p:presentation xmlns:p="${NS_P}" xmlns:r="${NS_R}">
<p:sldIdLst/>
${lst}
</p:presentation>`;
}

function presentationRels(rows: RelRow[]): string {
  const lines = rows.map((r) => {
    const tm = r.targetMode === undefined ? '' : ` TargetMode="${r.targetMode}"`;
    const type = r.type ?? REL_TYPE_FONT;
    return `<Relationship Id="${r.id}" Type="${type}" Target="${r.target}"${tm}/>`;
  });
  return `${xmlHeader}
<Relationships xmlns="${NS_R}/package/2006/relationships">
${lines.join('\n')}
</Relationships>`;
}

function buildEntries(args: { embeddedFonts: string[]; rels: RelRow[] }): ZipEntries {
  return {
    'ppt/presentation.xml': strToU8(presentationXml(args.embeddedFonts)),
    'ppt/_rels/presentation.xml.rels': strToU8(presentationRels(args.rels)),
  };
}

describe('readEmbeddedFonts — T-243c parser layer', () => {
  // AC #1 — single font with one face resolves the relId to its target path.
  it('parses a single <p:embeddedFont> with <p:regular r:id> into one ParsedEmbeddedFont', () => {
    const entries = buildEntries({
      embeddedFonts: [
        `<p:embeddedFont><p:font typeface="Custom"/><p:regular r:id="rIdF1"/></p:embeddedFont>`,
      ],
      rels: [{ id: 'rIdF1', target: 'fonts/font1.ttf' }],
    });

    const { fonts } = readEmbeddedFonts(entries);
    expect(fonts.length).toBe(1);
    const f = fonts[0];
    expect(f?.family).toBe('Custom');
    expect(f?.faces.regular?.kind).toBe('unresolved');
    if (f?.faces.regular?.kind !== 'unresolved') return;
    expect(f.faces.regular.oocxmlPath).toBe('ppt/fonts/font1.ttf');
    expect(f.faces.bold).toBeUndefined();
    expect(f.faces.italic).toBeUndefined();
    expect(f.faces.boldItalic).toBeUndefined();
  });

  // AC #2 — all four typeface variants emit four parsed face refs.
  it('populates all four faces (regular / bold / italic / boldItalic) when all are present', () => {
    const entries = buildEntries({
      embeddedFonts: [
        `<p:embeddedFont>
          <p:font typeface="Quad"/>
          <p:regular r:id="rId1"/>
          <p:bold r:id="rId2"/>
          <p:italic r:id="rId3"/>
          <p:boldItalic r:id="rId4"/>
        </p:embeddedFont>`,
      ],
      rels: [
        { id: 'rId1', target: 'fonts/quad-r.ttf' },
        { id: 'rId2', target: 'fonts/quad-b.ttf' },
        { id: 'rId3', target: 'fonts/quad-i.ttf' },
        { id: 'rId4', target: 'fonts/quad-bi.ttf' },
      ],
    });

    const { fonts } = readEmbeddedFonts(entries);
    expect(fonts.length).toBe(1);
    const faces = fonts[0]?.faces;
    expect(faces?.regular?.kind).toBe('unresolved');
    expect(faces?.bold?.kind).toBe('unresolved');
    expect(faces?.italic?.kind).toBe('unresolved');
    expect(faces?.boldItalic?.kind).toBe('unresolved');
    if (faces?.regular?.kind === 'unresolved') {
      expect(faces.regular.oocxmlPath).toBe('ppt/fonts/quad-r.ttf');
    }
    if (faces?.boldItalic?.kind === 'unresolved') {
      expect(faces.boldItalic.oocxmlPath).toBe('ppt/fonts/quad-bi.ttf');
    }
  });

  // AC #3 — partial faces: a font with only <p:regular> leaves the rest undefined.
  it('leaves faces undefined when the source <p:embeddedFont> omits them', () => {
    const entries = buildEntries({
      embeddedFonts: [
        `<p:embeddedFont><p:font typeface="OnlyRegular"/><p:regular r:id="rId1"/></p:embeddedFont>`,
      ],
      rels: [{ id: 'rId1', target: 'fonts/only-r.ttf' }],
    });

    const { fonts } = readEmbeddedFonts(entries);
    const f = fonts[0];
    expect(Object.keys(f?.faces ?? {})).toEqual(['regular']);
  });

  // AC #4 — PANOSE attribute round-trips opaque.
  it('preserves the panose attribute when present, leaves it undefined otherwise', () => {
    const entries = buildEntries({
      embeddedFonts: [
        `<p:embeddedFont><p:font typeface="WithPanose" panose="020B0604020202020204"/><p:regular r:id="rId1"/></p:embeddedFont>`,
        `<p:embeddedFont><p:font typeface="NoPanose"/><p:regular r:id="rId2"/></p:embeddedFont>`,
      ],
      rels: [
        { id: 'rId1', target: 'fonts/a.ttf' },
        { id: 'rId2', target: 'fonts/b.ttf' },
      ],
    });

    const { fonts } = readEmbeddedFonts(entries);
    expect(fonts[0]?.panose).toBe('020B0604020202020204');
    expect(fonts[1]?.panose).toBeUndefined();
  });

  // AC #5 — no <p:embeddedFontLst> in presentation.xml → empty result.
  it('returns an empty fonts list when <p:embeddedFontLst> is absent', () => {
    const entries = buildEntries({ embeddedFonts: [], rels: [] });
    const { fonts, flags } = readEmbeddedFonts(entries);
    expect(fonts).toEqual([]);
    expect(flags).toEqual([]);
  });

  // AC #6 — multiple fonts produce a multi-entry array in document order.
  it('returns a 2-entry array (in document order) for two <p:embeddedFont> entries', () => {
    const entries = buildEntries({
      embeddedFonts: [
        `<p:embeddedFont><p:font typeface="Alpha"/><p:regular r:id="rId1"/></p:embeddedFont>`,
        `<p:embeddedFont><p:font typeface="Beta"/><p:regular r:id="rId2"/></p:embeddedFont>`,
      ],
      rels: [
        { id: 'rId1', target: 'fonts/alpha.ttf' },
        { id: 'rId2', target: 'fonts/beta.ttf' },
      ],
    });

    const { fonts } = readEmbeddedFonts(entries);
    expect(fonts.map((f) => f.family)).toEqual(['Alpha', 'Beta']);
  });

  // AC #7 — one LF-PPTX-UNRESOLVED-FONT per family with severity/category/snippet.
  it('emits one LF-PPTX-UNRESOLVED-FONT per family (severity=info, category=font, snippet=family)', () => {
    const entries = buildEntries({
      embeddedFonts: [
        `<p:embeddedFont><p:font typeface="Alpha"/><p:regular r:id="rId1"/><p:bold r:id="rId2"/></p:embeddedFont>`,
        `<p:embeddedFont><p:font typeface="Beta"/><p:regular r:id="rId3"/></p:embeddedFont>`,
      ],
      rels: [
        { id: 'rId1', target: 'fonts/alpha-r.ttf' },
        { id: 'rId2', target: 'fonts/alpha-b.ttf' },
        { id: 'rId3', target: 'fonts/beta.ttf' },
      ],
    });

    const { flags } = readEmbeddedFonts(entries);
    const fontFlags = flags.filter((f) => f.code === 'LF-PPTX-UNRESOLVED-FONT');
    expect(fontFlags.length).toBe(2);
    expect(fontFlags.every((f) => f.severity === 'info')).toBe(true);
    expect(fontFlags.every((f) => f.category === 'font')).toBe(true);
    expect(fontFlags.map((f) => f.originalSnippet).sort()).toEqual(['Alpha', 'Beta']);
  });

  // AC #8 — broken relId drops the face but leaves family-level flag in place.
  it('drops a face whose r:id does not resolve in presentation.xml.rels', () => {
    const entries = buildEntries({
      embeddedFonts: [
        `<p:embeddedFont>
          <p:font typeface="PartialBroken"/>
          <p:regular r:id="rIdMissing"/>
          <p:bold r:id="rIdBoldOk"/>
        </p:embeddedFont>`,
      ],
      // Only the bold rel is present; regular is broken.
      rels: [{ id: 'rIdBoldOk', target: 'fonts/pb-b.ttf' }],
    });

    const { fonts, flags } = readEmbeddedFonts(entries);
    const f = fonts[0];
    expect(f?.faces.regular).toBeUndefined();
    expect(f?.faces.bold?.kind).toBe('unresolved');

    // Family-level flag still emits.
    expect(flags.find((g) => g.code === 'LF-PPTX-UNRESOLVED-FONT')).toBeDefined();
  });

  // AC #8 (defensive) — external r:link targets are dropped at parse time.
  it('drops faces whose rel carries TargetMode="External" (external embedded-font URL)', () => {
    const entries = buildEntries({
      embeddedFonts: [
        `<p:embeddedFont><p:font typeface="ExtFont"/><p:regular r:id="rIdExt"/></p:embeddedFont>`,
      ],
      rels: [
        {
          id: 'rIdExt',
          target: 'https://fonts.example.com/ext.ttf',
          targetMode: 'External',
        },
      ],
    });

    const { fonts } = readEmbeddedFonts(entries);
    expect(fonts[0]?.faces.regular).toBeUndefined();
  });

  // Skipping <p:embeddedFont> entries that lack <p:font typeface="…">.
  it('skips <p:embeddedFont> entries with no <p:font typeface> attribute', () => {
    const entries = buildEntries({
      embeddedFonts: [
        `<p:embeddedFont><p:regular r:id="rId1"/></p:embeddedFont>`,
        `<p:embeddedFont><p:font typeface="Valid"/><p:regular r:id="rId2"/></p:embeddedFont>`,
      ],
      rels: [
        { id: 'rId1', target: 'fonts/a.ttf' },
        { id: 'rId2', target: 'fonts/v.ttf' },
      ],
    });

    const { fonts, flags } = readEmbeddedFonts(entries);
    expect(fonts.length).toBe(1);
    expect(fonts[0]?.family).toBe('Valid');
    expect(flags.length).toBe(1);
  });
});
