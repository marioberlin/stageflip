// packages/import-hyperframes-html/src/extra.test.ts
// Additional branch coverage tests to satisfy AC #35 (≥90% on parseHyperframes
// and exportHyperframes). These exercise paths the integration tests cover
// only incidentally: image alt, scale-dropped element flag, SVG element,
// master error paths, animations-dropped at composition level, inlined-mode
// round-trip, audio-only single-track classification, image emission.

import type { Document, VideoContent } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { exportHyperframes } from './exportHyperframes.js';
import { parseHyperframes } from './parseHyperframes.js';

const fetcher =
  (files: Record<string, string>) =>
  async (rel: string): Promise<string> => {
    const v = files[rel];
    if (v === undefined) throw new Error(rel);
    return v;
  };

const SIMPLE_MASTER = `<!doctype html><html><body>
  <div id="master-root" data-composition-id="master" data-width="1080" data-height="1920" data-duration="5">
    <div data-composition-id="main-orchestration" data-composition-src="m.html" data-start="0" data-duration="5" data-track-index="0"></div>
  </div></body></html>`;

describe('extra coverage', () => {
  it('image element preserves alt attribute', async () => {
    const result = await parseHyperframes(SIMPLE_MASTER, {
      fetchCompositionSrc: fetcher({
        'm.html':
          '<template id="t"><div data-composition-id="main-orchestration" data-width="1080" data-height="1920" data-duration="5"><img src="https://example.com/p.png" alt="hero" style="left: 0; top: 0; width: 100px; height: 100px" /></div></template>',
      }),
    });
    const v = result.document.content as VideoContent;
    const img = v.tracks[0]?.elements[0] as { type: string; alt?: string };
    expect(img.type).toBe('image');
    expect(img.alt).toBe('hero');
  });

  it('AC #20 (composition-level): scale != 1 on element emits ANIMATIONS-DROPPED', async () => {
    const result = await parseHyperframes(SIMPLE_MASTER, {
      fetchCompositionSrc: fetcher({
        'm.html':
          '<template id="t"><div data-composition-id="main-orchestration" data-width="1080" data-height="1920" data-duration="5"><div style="left: 0; top: 0; width: 100px; height: 100px; transform: scale(0)"></div></div></template>',
      }),
    });
    expect(
      result.lossFlags.some(
        (f) =>
          f.code === 'LF-HYPERFRAMES-HTML-ANIMATIONS-DROPPED' && f.location.elementId !== undefined,
      ),
    ).toBe(true);
  });

  it('SVG element parses to a custom-path shape', async () => {
    const result = await parseHyperframes(SIMPLE_MASTER, {
      fetchCompositionSrc: fetcher({
        'm.html':
          '<template id="t"><div data-composition-id="main-orchestration" data-width="1080" data-height="1920" data-duration="5"><svg style="left: 0; top: 0; width: 100px; height: 100px">M0 0 L10 10</svg></div></template>',
      }),
    });
    const v = result.document.content as VideoContent;
    const shape = v.tracks[0]?.elements[0] as { type: string; shape: string };
    expect(shape.type).toBe('shape');
    expect(shape.shape).toBe('custom-path');
  });

  it('throws when master HTML lacks #master-root', async () => {
    await expect(
      parseHyperframes('<!doctype html><html><body></body></html>', {
        fetchCompositionSrc: fetcher({}),
      }),
    ).rejects.toThrow(/master-root/);
  });

  it('throws when master-root lacks data-width / data-height / data-duration', async () => {
    await expect(
      parseHyperframes('<!doctype html><html><body><div id="master-root"></div></body></html>', {
        fetchCompositionSrc: fetcher({}),
      }),
    ).rejects.toThrow(/data-width/);
  });

  it('master-level composition with GSAP timeline emits ANIMATIONS-DROPPED', async () => {
    const result = await parseHyperframes(SIMPLE_MASTER, {
      fetchCompositionSrc: fetcher({
        'm.html':
          '<template id="t"><div data-composition-id="main-orchestration" data-width="1080" data-height="1920" data-duration="5"><div style="left: 0; top: 0; width: 100px; height: 100px"></div><script>const tl = gsap.timeline({});</script></div></template>',
      }),
    });
    expect(
      result.lossFlags.some(
        (f) =>
          f.code === 'LF-HYPERFRAMES-HTML-ANIMATIONS-DROPPED' && f.location.elementId === undefined,
      ),
    ).toBe(true);
  });

  it('inlined output round-trips through re-parse', async () => {
    const first = await parseHyperframes(SIMPLE_MASTER, {
      fetchCompositionSrc: fetcher({
        'm.html':
          '<template id="t"><div data-composition-id="main-orchestration" data-width="1080" data-height="1920" data-duration="5"><div style="left: 100px; top: 100px; width: 200px; height: 100px">A</div></div></template>',
      }),
    });
    const inlined = await exportHyperframes(first.document, { outputMode: 'inlined' });
    expect(Object.keys(inlined.compositions)).toHaveLength(0);
    expect(inlined.masterHtml).toContain('<template');
    // Re-parse the inlined master directly: caller passes a fetcher that
    // returns nothing because compositions is empty; the master's inlined
    // template is read from the body itself.
    const second = await parseHyperframes(inlined.masterHtml, {
      fetchCompositionSrc: async () => {
        throw new Error('should not fetch in inlined mode');
      },
    });
    const v2 = second.document.content as VideoContent;
    expect(v2.tracks).toHaveLength(1);
  });

  it('exportHyperframes emits image elements with src + alt', async () => {
    const doc: Document = {
      meta: {
        id: 'd',
        version: 0,
        createdAt: '1970-01-01T00:00:00.000Z',
        updatedAt: '1970-01-01T00:00:00.000Z',
        locale: 'en',
        schemaVersion: 1,
      },
      theme: { tokens: {} },
      variables: {},
      components: {},
      masters: [],
      layouts: [],
      content: {
        mode: 'video',
        aspectRatio: '16:9',
        durationMs: 5000,
        frameRate: 30,
        tracks: [
          {
            id: 't1',
            kind: 'visual',
            muted: false,
            elements: [
              {
                id: 'img1',
                transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
                type: 'image',
                src: 'asset:abc',
                alt: 'logo',
                fit: 'cover',
              },
            ],
          },
        ],
      },
    };
    const result = await exportHyperframes(doc);
    const compHtml = Object.values(result.compositions)[0];
    expect(compHtml).toBeDefined();
    expect(compHtml).toContain('<img');
    expect(compHtml).toContain('alt="logo"');
    expect(compHtml).toContain('src="asset:abc"');
  });

  it('exportHyperframes covers all aspect ratio branches', async () => {
    const ratios = ['16:9', '9:16', '1:1', '4:5', '21:9'] as const;
    for (const ratio of ratios) {
      const doc: Document = {
        meta: {
          id: 'd',
          version: 0,
          createdAt: '1970-01-01T00:00:00.000Z',
          updatedAt: '1970-01-01T00:00:00.000Z',
          locale: 'en',
          schemaVersion: 1,
        },
        theme: { tokens: {} },
        variables: {},
        components: {},
        masters: [],
        layouts: [],
        content: {
          mode: 'video',
          aspectRatio: ratio,
          durationMs: 1000,
          frameRate: 30,
          tracks: [
            {
              id: 't',
              kind: 'visual',
              muted: false,
              elements: [],
            },
          ],
        },
      };
      const result = await exportHyperframes(doc);
      expect(result.masterHtml).toContain('id="master-root"');
    }
  });

  it('exportHyperframes covers track-kind composition-id mapping for all kinds', async () => {
    const kinds = ['visual', 'caption', 'audio', 'overlay'] as const;
    for (const kind of kinds) {
      const doc: Document = {
        meta: {
          id: 'd',
          version: 0,
          createdAt: '1970-01-01T00:00:00.000Z',
          updatedAt: '1970-01-01T00:00:00.000Z',
          locale: 'en',
          schemaVersion: 1,
        },
        theme: { tokens: {} },
        variables: {},
        components: {},
        masters: [],
        layouts: [],
        content: {
          mode: 'video',
          aspectRatio: '9:16',
          durationMs: 1000,
          frameRate: 30,
          tracks: [
            {
              id: 't',
              kind,
              muted: false,
              elements: [],
            },
          ],
        },
      };
      const result = await exportHyperframes(doc);
      expect(Object.keys(result.compositions).length).toBeGreaterThan(0);
    }
  });

  it('exportHyperframes emits group + shape + opacity-bearing elements', async () => {
    const doc: Document = {
      meta: {
        id: 'd',
        version: 0,
        createdAt: '1970-01-01T00:00:00.000Z',
        updatedAt: '1970-01-01T00:00:00.000Z',
        locale: 'en',
        schemaVersion: 1,
      },
      theme: { tokens: {} },
      variables: {},
      components: {},
      masters: [],
      layouts: [],
      content: {
        mode: 'video',
        aspectRatio: '9:16',
        durationMs: 1000,
        frameRate: 30,
        tracks: [
          {
            id: 't1',
            kind: 'visual',
            muted: false,
            elements: [
              {
                id: 'g1',
                transform: { x: 0, y: 0, width: 100, height: 100, rotation: 90, opacity: 0.5 },
                visible: true,
                locked: false,
                animations: [],
                type: 'group',
                children: [
                  {
                    id: 't2',
                    transform: { x: 5, y: 5, width: 10, height: 10, rotation: 0, opacity: 1 },
                    visible: true,
                    locked: false,
                    animations: [],
                    type: 'text',
                    text: 'inner',
                    align: 'left',
                  },
                ],
                clip: false,
              },
              {
                id: 's1',
                transform: { x: 100, y: 100, width: 50, height: 50, rotation: 0, opacity: 1 },
                visible: true,
                locked: false,
                animations: [],
                type: 'shape',
                shape: 'custom-path',
                path: 'M0 0 L10 10',
              },
            ],
          },
        ],
      },
    };
    const result = await exportHyperframes(doc);
    const compHtml = Object.values(result.compositions)[0];
    expect(compHtml).toContain('rotate(90deg)');
    expect(compHtml).toContain('opacity: 0.5');
    expect(compHtml).toContain('<svg');
    expect(compHtml).toContain('data-group="1"');
  });

  it('audio-only composition is classified as audio track', async () => {
    const masterHtml = `<!doctype html><html><body>
      <div id="master-root" data-composition-id="master" data-width="1080" data-height="1920" data-duration="5">
        <div data-composition-id="sfx-pack" data-composition-src="s.html" data-start="0" data-duration="5" data-track-index="1"></div>
      </div></body></html>`;
    const result = await parseHyperframes(masterHtml, {
      fetchCompositionSrc: fetcher({
        's.html':
          '<template id="t"><div data-composition-id="sfx-pack" data-width="1080" data-height="1920" data-duration="5"><audio src="https://example.com/sfx.mp3" style="left: 0; top: 0; width: 1px; height: 1px"></audio></div></template>',
      }),
    });
    const v = result.document.content as VideoContent;
    expect(v.tracks[0]?.kind).toBe('audio');
  });
});
