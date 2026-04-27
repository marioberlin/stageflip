// packages/import-hyperframes-html/src/exportHyperframes.test.ts
// Integration tests for exportHyperframes. Pin AC #2 / #3 / #28-#31.

import type { Document, VideoContent } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import { exportHyperframes } from './exportHyperframes.js';

function trivialDoc(overrides: Partial<VideoContent> = {}): Document {
  const base: VideoContent = {
    mode: 'video',
    aspectRatio: '9:16',
    durationMs: 16040,
    frameRate: 30,
    tracks: [
      {
        id: 'track_1',
        kind: 'visual',
        muted: false,
        elements: [
          {
            id: 'el_1',
            transform: { x: 0, y: 0, width: 100, height: 50, rotation: 0, opacity: 1 },
            visible: true,
            locked: false,
            animations: [],
            type: 'text',
            text: 'A',
            align: 'left',
          },
          {
            id: 'el_2',
            transform: { x: 100, y: 200, width: 50, height: 50, rotation: 0, opacity: 1 },
            visible: true,
            locked: false,
            animations: [],
            type: 'text',
            text: 'B',
            align: 'left',
          },
        ],
      },
    ],
    ...overrides,
  };
  return {
    meta: {
      id: 'doc_1',
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
    content: base,
  };
}

describe('exportHyperframes', () => {
  it('AC #2 + #28: returns masterHtml + compositions map', async () => {
    const result = await exportHyperframes(trivialDoc());
    expect(result.masterHtml).toContain('id="master-root"');
    expect(result.masterHtml).toContain('data-width="1080"');
    expect(result.masterHtml).toContain('data-height="1920"');
    expect(result.masterHtml).toContain('data-duration="16.04"');
    expect(Object.keys(result.compositions).length).toBeGreaterThan(0);
  });

  it('AC #3: outputMode multi-file => non-empty compositions map', async () => {
    const result = await exportHyperframes(trivialDoc(), { outputMode: 'multi-file' });
    expect(Object.keys(result.compositions).length).toBeGreaterThan(0);
  });

  it('AC #3 + #31: outputMode inlined => empty compositions, master contains <template>', async () => {
    const result = await exportHyperframes(trivialDoc(), { outputMode: 'inlined' });
    expect(Object.keys(result.compositions)).toHaveLength(0);
    expect(result.masterHtml).toContain('<template');
  });

  it('AC #29: element transforms emitted as inline left/top/width/height', async () => {
    const result = await exportHyperframes(trivialDoc());
    const compHtml = Object.values(result.compositions)[0];
    expect(compHtml).toBeDefined();
    expect(compHtml).toContain('left: 0px');
    expect(compHtml).toContain('top: 0px');
    expect(compHtml).toContain('width: 100px');
    expect(compHtml).toContain('height: 50px');
  });

  it('AC #30: two consecutive exports produce string-identical output', async () => {
    const a = await exportHyperframes(trivialDoc());
    const b = await exportHyperframes(trivialDoc());
    expect(a.masterHtml).toBe(b.masterHtml);
    expect(a.compositions).toEqual(b.compositions);
  });

  it('rejects non-video content', async () => {
    const doc: Document = {
      ...trivialDoc(),
      content: {
        mode: 'slide',
        aspectRatio: '16:9',
        slides: [],
      } as never,
    };
    await expect(exportHyperframes(doc)).rejects.toThrow(/video-mode/);
  });
});
