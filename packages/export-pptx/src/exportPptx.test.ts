// packages/export-pptx/src/exportPptx.test.ts
// Integration tests for the public `exportPptx` driver. Cover the public
// surface ACs (#1–#4), ZIP layout (#5–#7), content-types (#8), presentation
// (#9–#11), loss flags (#21–#25), determinism source-grep (#28).

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Document } from '@stageflip/schema';
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { AssetReader } from './assets/types.js';
import { exportPptx } from './exportPptx.js';
import { buildDoc } from './test-helpers/build-doc.js';

const TRANSFORM = { x: 0, y: 0, width: 100, height: 50 };

describe('exportPptx — public surface', () => {
  it('AC #1 returns { bytes: Uint8Array; lossFlags: LossFlag[] } with non-empty bytes', async () => {
    const doc = buildDoc({
      slides: [
        { id: 's1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'hi' }] },
      ],
    });
    const r = await exportPptx(doc);
    expect(r.bytes).toBeInstanceOf(Uint8Array);
    expect(r.bytes.length).toBeGreaterThan(0);
    expect(Array.isArray(r.lossFlags)).toBe(true);
  });

  it('AC #2 byte-deterministic across two calls with the same modifiedAt', async () => {
    const doc = buildDoc({
      slides: [
        { id: 's1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'hi' }] },
      ],
    });
    const ts = new Date('2025-06-15T12:00:00Z');
    const a = (await exportPptx(doc, { modifiedAt: ts })).bytes;
    const b = (await exportPptx(doc, { modifiedAt: ts })).bytes;
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('AC #3 byte-deterministic when modifiedAt is omitted (frozen-epoch fallback)', async () => {
    const doc = buildDoc({
      slides: [
        { id: 's1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'hi' }] },
      ],
    });
    const a = (await exportPptx(doc)).bytes;
    const b = (await exportPptx(doc)).bytes;
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('AC #4 output is a valid ZIP that fflate.unzipSync can open', async () => {
    const doc = buildDoc({
      slides: [
        { id: 's1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'hi' }] },
      ],
    });
    const { bytes } = await exportPptx(doc);
    expect(() => unzipSync(bytes)).not.toThrow();
  });
});

describe('exportPptx — ZIP layout', () => {
  it('AC #5 archive contains every required part for a no-image deck', async () => {
    const doc = buildDoc({
      slides: [
        { id: 's1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'a' }] },
        { id: 's2', elements: [{ id: 'e2', type: 'text', transform: TRANSFORM, text: 'b' }] },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unzipSync(bytes);
    const paths = Object.keys(entries).sort();
    expect(paths).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'docProps/app.xml',
      'docProps/core.xml',
      'ppt/_rels/presentation.xml.rels',
      'ppt/presentation.xml',
      'ppt/slides/_rels/slide1.xml.rels',
      'ppt/slides/_rels/slide2.xml.rels',
      'ppt/slides/slide1.xml',
      'ppt/slides/slide2.xml',
      'ppt/theme/theme1.xml',
    ]);
  });

  it('AC #5 archive includes ppt/media/imageN for image elements', async () => {
    const reader: AssetReader = {
      get: async (id) => {
        if (id === 'i1') return { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png' };
        return undefined;
      },
    };
    const doc = buildDoc({
      slides: [
        {
          id: 's1',
          elements: [
            { id: 'e1', type: 'image', transform: TRANSFORM, src: 'asset:i1', fit: 'cover' },
          ],
        },
      ],
    });
    const { bytes } = await exportPptx(doc, { assets: reader });
    const entries = unzipSync(bytes);
    expect(Object.keys(entries)).toContain('ppt/media/image1.png');
    expect(entries['ppt/media/image1.png']).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe('exportPptx — presentation.xml', () => {
  it('AC #9 emits <p:sldSz cx="9144000" cy="5143500"/> by default', async () => {
    const doc = buildDoc({
      slides: [
        { id: 's1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'a' }] },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unzipSync(bytes);
    const xml = new TextDecoder().decode(entries['ppt/presentation.xml']);
    expect(xml).toContain('<p:sldSz cx="9144000" cy="5143500"/>');
  });

  it('AC #10 emits <p:sldIdLst> with one rId per slide in document order', async () => {
    const doc = buildDoc({
      slides: [
        { id: 's1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'a' }] },
        { id: 's2', elements: [{ id: 'e2', type: 'text', transform: TRANSFORM, text: 'b' }] },
        { id: 's3', elements: [{ id: 'e3', type: 'text', transform: TRANSFORM, text: 'c' }] },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unzipSync(bytes);
    const xml = new TextDecoder().decode(entries['ppt/presentation.xml']);
    expect(xml).toContain('<p:sldId id="256" r:id="rId1"/>');
    expect(xml).toContain('<p:sldId id="257" r:id="rId2"/>');
    expect(xml).toContain('<p:sldId id="258" r:id="rId3"/>');
  });

  it('AC #11 base writer does not emit <p:sldMasterIdLst> content', async () => {
    const doc = buildDoc({
      slides: [
        { id: 's1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'a' }] },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unzipSync(bytes);
    const xml = new TextDecoder().decode(entries['ppt/presentation.xml']);
    expect(xml).not.toContain('<p:sldMasterIdLst');
  });
});

describe('exportPptx — loss flags', () => {
  it('AC #17 emits LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT for table/video/audio/chart/embed/code/clip', async () => {
    const doc = buildDoc({
      slides: [
        {
          id: 's1',
          elements: [
            { id: 'e1', type: 'text', transform: TRANSFORM, text: 'ok' },
            { id: 'e2', type: 'video', transform: TRANSFORM, src: 'asset:v1' },
            { id: 'e3', type: 'audio', transform: TRANSFORM, src: 'asset:a1' },
            { id: 'e4', type: 'table', transform: TRANSFORM, rows: 1, columns: 1, cells: [] },
            {
              id: 'e5',
              type: 'chart',
              transform: TRANSFORM,
              chartKind: 'bar',
              data: { labels: [], series: [] },
            },
            { id: 'e6', type: 'embed', transform: TRANSFORM, src: 'https://example.com/' },
            { id: 'e7', type: 'code', transform: TRANSFORM, code: '', language: 'plaintext' },
            { id: 'e8', type: 'clip', transform: TRANSFORM, runtime: 'css', clipName: 'c' },
          ],
        },
      ],
    });
    const { lossFlags } = await exportPptx(doc);
    const codes = lossFlags
      .map((f) => f.code)
      .filter((c) => c === 'LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT');
    expect(codes.length).toBe(7);
  });

  it('AC #19 emits LF-PPTX-EXPORT-ASSET-MISSING when AssetReader.get returns undefined', async () => {
    const reader: AssetReader = { get: async () => undefined };
    const doc = buildDoc({
      slides: [
        {
          id: 's1',
          elements: [
            { id: 'e1', type: 'image', transform: TRANSFORM, src: 'asset:nope', fit: 'cover' },
          ],
        },
      ],
    });
    const { bytes, lossFlags } = await exportPptx(doc, { assets: reader });
    expect(lossFlags.some((f) => f.code === 'LF-PPTX-EXPORT-ASSET-MISSING')).toBe(true);
    const entries = unzipSync(bytes);
    expect(Object.keys(entries).filter((p) => p.startsWith('ppt/media/'))).toEqual([]);
  });

  it('AC #21 emits LF-PPTX-EXPORT-ANIMATIONS-DROPPED once per slide with animations', async () => {
    const doc = buildDoc({
      slides: [
        {
          id: 's1',
          elements: [
            {
              id: 'e1',
              type: 'text',
              transform: TRANSFORM,
              text: 'hi',
              animations: [
                {
                  id: 'a1',
                  timing: { kind: 'absolute', startFrame: 0, durationFrames: 30 },
                  animation: { kind: 'fade', from: 0, to: 1, easing: 'ease-out' },
                },
              ],
            },
          ],
        },
        {
          // No animations on this slide.
          id: 's2',
          elements: [{ id: 'e2', type: 'text', transform: TRANSFORM, text: 'no anim' }],
        },
      ],
    });
    const { lossFlags } = await exportPptx(doc);
    const animFlags = lossFlags.filter((f) => f.code === 'LF-PPTX-EXPORT-ANIMATIONS-DROPPED');
    expect(animFlags.length).toBe(1);
    expect(animFlags[0]?.location.slideId).toBe('s1');
  });

  it('AC #22 emits LF-PPTX-EXPORT-NOTES-DROPPED once per slide with non-empty notes', async () => {
    const doc = buildDoc({
      slides: [
        {
          id: 's1',
          notes: 'these are speaker notes',
          elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'hi' }],
        },
        {
          id: 's2',
          elements: [{ id: 'e2', type: 'text', transform: TRANSFORM, text: 'no notes' }],
        },
      ],
    });
    const { lossFlags } = await exportPptx(doc);
    const notesFlags = lossFlags.filter((f) => f.code === 'LF-PPTX-EXPORT-NOTES-DROPPED');
    expect(notesFlags.length).toBe(1);
    expect(notesFlags[0]?.location.slideId).toBe('s1');
  });

  it('AC #23 emits LF-PPTX-EXPORT-THEME-FLATTENED exactly once when theme is non-default', async () => {
    const doc = buildDoc({
      slides: [
        { id: 's1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'a' }] },
      ],
      theme: { tokens: { 'color.primary': '#FF0000' } },
    });
    const { lossFlags } = await exportPptx(doc);
    const themeFlags = lossFlags.filter((f) => f.code === 'LF-PPTX-EXPORT-THEME-FLATTENED');
    expect(themeFlags.length).toBe(1);
  });

  it('AC #23 negative case — default theme emits no THEME-FLATTENED flag', async () => {
    const doc = buildDoc({
      slides: [
        { id: 's1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'a' }] },
      ],
    });
    const { lossFlags } = await exportPptx(doc);
    const themeFlags = lossFlags.filter((f) => f.code === 'LF-PPTX-EXPORT-THEME-FLATTENED');
    expect(themeFlags.length).toBe(0);
  });

  it('AC #24 every emitted flag has source: pptx-export', async () => {
    const doc = buildDoc({
      slides: [
        {
          id: 's1',
          notes: 'n',
          elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'hi' }],
        },
      ],
    });
    const { lossFlags } = await exportPptx(doc);
    expect(lossFlags.length).toBeGreaterThan(0);
    for (const f of lossFlags) expect(f.source).toBe('pptx-export');
  });
});

describe('exportPptx — slide background (AC #17a / #17b)', () => {
  it('emits <p:bg> with <a:solidFill> for color background', async () => {
    const doc = buildDoc({
      slides: [
        {
          id: 's1',
          background: { kind: 'color', value: '#FF0000' },
          elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'a' }],
        },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unzipSync(bytes);
    const xml = new TextDecoder().decode(entries['ppt/slides/slide1.xml']);
    expect(xml).toContain('<p:bg>');
    expect(xml).toContain('<a:solidFill>');
    expect(xml).toContain('<a:srgbClr val="FF0000"/>');
  });

  it('AC #17b emits no <p:bg> when background is undefined', async () => {
    const doc = buildDoc({
      slides: [
        { id: 's1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'a' }] },
      ],
    });
    const { bytes } = await exportPptx(doc);
    const entries = unzipSync(bytes);
    const xml = new TextDecoder().decode(entries['ppt/slides/slide1.xml']);
    expect(xml).not.toContain('<p:bg>');
  });

  it('emits LF-PPTX-EXPORT-IMAGE-BACKGROUND-FALLBACK when background.kind === asset', async () => {
    // Image-fill backgrounds emit a placeholder solid-white <p:bg> (real
    // <a:blipFill> emission deferred to a follow-on rider). The fallback
    // breadcrumb flag tells consumers fidelity was lost.
    const doc = buildDoc({
      slides: [
        {
          id: 's1',
          background: { kind: 'asset', value: 'asset:bg-image-id' },
          elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'a' }],
        },
      ],
    });
    const { lossFlags } = await exportPptx(doc);
    const fallbackFlags = lossFlags.filter(
      (f) => f.code === 'LF-PPTX-EXPORT-IMAGE-BACKGROUND-FALLBACK',
    );
    expect(fallbackFlags).toHaveLength(1);
    expect(fallbackFlags[0]?.location.slideId).toBe('s1');
    expect(fallbackFlags[0]?.severity).toBe('warn');
    expect(fallbackFlags[0]?.category).toBe('media');
  });
});

describe('exportPptx — non-slide-mode early-return (coverage gap)', () => {
  // Covers the doc.content.mode !== 'slide' branch in exportPptx.ts.
  // Base writer only emits slide-mode docs; video/display return an
  // intentionally empty shell with a single LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT
  // flag carrying the unsupported mode in originalSnippet.

  it('video-mode doc returns shell + 1 unsupported-element flag', async () => {
    const doc: Document = {
      meta: {
        title: 'video',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      theme: { tokens: {} },
      variables: {},
      components: {},
      masters: [],
      layouts: [],
      content: {
        mode: 'video',
        aspectRatio: '16:9',
        durationMs: 1000,
        frameRate: 30,
        tracks: [{ id: 't1', kind: 'visual', muted: false, elements: [] }],
      },
    };
    const { bytes, lossFlags } = await exportPptx(doc);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    const unsupported = lossFlags.filter((f) => f.code === 'LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT');
    expect(unsupported).toHaveLength(1);
    expect(unsupported[0]?.originalSnippet).toBe('video');
  });

  it('display-mode doc returns shell + 1 unsupported-element flag', async () => {
    const doc: Document = {
      meta: {
        title: 'display',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      theme: { tokens: {} },
      variables: {},
      components: {},
      masters: [],
      layouts: [],
      content: {
        mode: 'display',
        aspectRatio: '16:9',
        canonicalSizes: ['300x250'],
        durationMs: 1000,
        elements: [],
      } as never,
    };
    const { lossFlags } = await exportPptx(doc);
    const unsupported = lossFlags.filter((f) => f.code === 'LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT');
    expect(unsupported).toHaveLength(1);
    expect(unsupported[0]?.originalSnippet).toBe('display');
  });
});

describe('exportPptx — determinism source-grep (AC #28)', () => {
  it('package source does not call Date.now / new Date() / Math.random / performance.now', async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const root = resolve(here);
    const tsFiles: string[] = [];
    async function walk(dir: string): Promise<void> {
      const items = await readdir(dir, { withFileTypes: true });
      for (const it of items) {
        const full = join(dir, it.name);
        if (it.isDirectory()) {
          await walk(full);
          continue;
        }
        if (!it.name.endsWith('.ts')) continue;
        if (it.name.endsWith('.test.ts')) continue;
        if (full.includes('/test-helpers/')) continue;
        tsFiles.push(full);
      }
    }
    await walk(root);
    expect(tsFiles.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const f of tsFiles) {
      const text = await readFile(f, 'utf8');
      // The single permitted occurrence is `new Date('2024-01-01T00:00:00Z')`
      // (the FROZEN_EPOCH constant in types.ts) and the spec-quoted ISO
      // literal in TSDoc/comments. Strip line comments / block comments
      // before scanning so the comments don't trip the grep.
      const stripped = stripComments(text);
      const banned: { pattern: RegExp; api: string }[] = [
        { pattern: /\bDate\.now\(/g, api: 'Date.now()' },
        { pattern: /\bMath\.random\(/g, api: 'Math.random()' },
        { pattern: /\bperformance\.now\(/g, api: 'performance.now()' },
      ];
      for (const { pattern, api } of banned) {
        if (pattern.test(stripped)) {
          violations.push(`${relative(root, f)}: ${api}`);
        }
      }
      // `new Date(...)` is allowed only with the frozen-epoch literal.
      const newDateMatches = stripped.match(/\bnew Date\([^)]*\)/g) ?? [];
      for (const m of newDateMatches) {
        if (!m.includes("'2024-01-01T00:00:00Z'") && !m.includes('"2024-01-01T00:00:00Z"')) {
          violations.push(`${relative(root, f)}: ${m}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe('exportPptx — T-441 AI content extension', () => {
  function unpackPresentationXml(bytes: Uint8Array): string {
    const entries = unzipSync(bytes);
    const raw = entries['ppt/presentation.xml'];
    if (raw === undefined) throw new Error('presentation.xml missing');
    return new TextDecoder().decode(raw);
  }

  const SIMPLE_DOC = (): Document =>
    buildDoc({
      slides: [
        { id: 's1', elements: [{ id: 'e1', type: 'text', transform: TRANSFORM, text: 'hi' }] },
      ],
    });

  it('AC #9: presentation.xml is byte-identical when aiElements is absent vs not passed', async () => {
    const doc = SIMPLE_DOC();
    const ts = new Date('2025-06-15T12:00:00Z');
    const a = unpackPresentationXml((await exportPptx(doc, { modifiedAt: ts })).bytes);
    const b = unpackPresentationXml(
      (await exportPptx(doc, { modifiedAt: ts, aiElements: undefined })).bytes,
    );
    expect(a).toBe(b);
    expect(a).not.toContain('<p:extLst>');
  });

  it('AC #10: aiElements with one AI-generated row splices <p:extLst> into presentation.xml', async () => {
    const doc = SIMPLE_DOC();
    const r = await exportPptx(doc, {
      aiElements: [
        {
          elementId: 'el-tts',
          slideId: 's1',
          provenance: {
            kind: 'tts',
            provider: 'tts-kokoro',
            model: 'kokoro-82m',
            cacheKey: 'sha256-tts-abc',
            prompt: 'narrator: hello world',
          },
        },
      ],
    });
    const xml = unpackPresentationXml(r.bytes);
    expect(xml).toContain('<p:extLst>');
    expect(xml).toContain('https://stageflip.dev/extensions/ai-content/v1');
    expect(xml).toContain('<sf:aiContent');
    expect(xml).toContain('id="el-tts"');
    expect(xml).toContain('provider="tts-kokoro"');
    expect(xml).toContain('modality="tts"');
    expect(xml).toContain('slideId="s1"');
    expect(xml).toContain('cacheKey="sha256-tts-abc"');
    expect(xml).toContain('prompt="narrator: hello world"');
    // Element ordering: extLst comes after notesSz and before </p:presentation>.
    const idxNotesSz = xml.indexOf('<p:notesSz');
    const idxExtLst = xml.indexOf('<p:extLst');
    const idxClose = xml.indexOf('</p:presentation>');
    expect(idxNotesSz).toBeGreaterThan(0);
    expect(idxExtLst).toBeGreaterThan(idxNotesSz);
    expect(idxClose).toBeGreaterThan(idxExtLst);
  });

  it('AC #11: aiElements containing only imported / no-provenance rows produces no extension', async () => {
    const doc = SIMPLE_DOC();
    const r = await exportPptx(doc, {
      aiElements: [
        { elementId: 'el-imported', provenance: { kind: 'imported' } },
        { elementId: 'el-no-prov' },
      ],
    });
    const xml = unpackPresentationXml(r.bytes);
    expect(xml).not.toContain('<p:extLst>');
    expect(xml).not.toContain('stageflip.dev/extensions/ai-content');
  });

  it('AC #12: determinism — two consecutive exports with identical aiElements are byte-identical', async () => {
    const doc = SIMPLE_DOC();
    const ts = new Date('2025-06-15T12:00:00Z');
    const aiElements = [
      {
        elementId: 'el-1',
        provenance: { kind: 'image-gen' as const, provider: 'image-flux', model: 'flux-1' },
      },
    ];
    const a = (await exportPptx(doc, { modifiedAt: ts, aiElements })).bytes;
    const b = (await exportPptx(doc, { modifiedAt: ts, aiElements })).bytes;
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('AC #13: PPTX with <p:extLst> round-trips through @stageflip/import-pptx with no extra loss flags', async () => {
    // Lazy import so the test file doesn't pull import-pptx for unrelated tests.
    const { parsePptx } = await import('@stageflip/import-pptx');
    const doc = SIMPLE_DOC();
    const baseline = await parsePptx((await exportPptx(doc)).bytes);
    const withExt = await parsePptx(
      (
        await exportPptx(doc, {
          aiElements: [
            { elementId: 'el-1', provenance: { kind: 'image-gen', provider: 'image-flux' } },
          ],
        })
      ).bytes,
    );
    // Importer treats unknown extensions opaquely; flag count must not grow.
    expect(withExt.lossFlags.length).toBe(baseline.lossFlags.length);
  });

  it('emits multiple <sf:element> rows in input order', async () => {
    const doc = SIMPLE_DOC();
    const r = await exportPptx(doc, {
      aiElements: [
        { elementId: 'b', provenance: { kind: 'tts', provider: 'tts-kokoro' } },
        { elementId: 'a', provenance: { kind: 'image-gen', provider: 'image-flux' } },
        { elementId: 'c', provenance: { kind: 'video-gen', provider: 'video-seedance' } },
      ],
    });
    const xml = unpackPresentationXml(r.bytes);
    const idxB = xml.indexOf('id="b"');
    const idxA = xml.indexOf('id="a"');
    const idxC = xml.indexOf('id="c"');
    expect(idxB).toBeGreaterThan(0);
    expect(idxA).toBeGreaterThan(idxB);
    expect(idxC).toBeGreaterThan(idxA);
  });
});

/**
 * Strip line and block comments. Naive but adequate for our source —
 * we don't write '/*' inside string literals in this package.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}
