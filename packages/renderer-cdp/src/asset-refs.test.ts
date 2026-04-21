// packages/renderer-cdp/src/asset-refs.test.ts

import type { RIRDocument, RIRElement, RIRElementContent } from '@stageflip/rir';
import { describe, expect, it } from 'vitest';

import { collectAssetRefs, rewriteDocumentAssets } from './asset-refs';

// --- builders ---------------------------------------------------------------

function base(id: string): Omit<RIRElement, 'content' | 'type'> {
  return {
    id,
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
    timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
    zIndex: 0,
    visible: true,
    locked: false,
    stacking: 'auto',
    animations: [],
  };
}

function image(id: string, srcUrl: string): RIRElement {
  return {
    ...base(id),
    type: 'image',
    content: { type: 'image', srcUrl, fit: 'cover' },
  };
}

function video(id: string, srcUrl: string): RIRElement {
  return {
    ...base(id),
    type: 'video',
    content: { type: 'video', srcUrl, muted: true, loop: false, playbackRate: 1 },
  };
}

function audio(id: string, srcUrl: string): RIRElement {
  return {
    ...base(id),
    type: 'audio',
    content: {
      type: 'audio',
      srcUrl,
      loop: false,
      gain: 1,
      pan: 0,
      fadeInMs: 0,
      fadeOutMs: 0,
    },
  };
}

function embed(id: string, src: string): RIRElement {
  return {
    ...base(id),
    type: 'embed',
    content: { type: 'embed', src, sandbox: [], allowFullscreen: false },
  };
}

function group(id: string, children: readonly RIRElement[]): RIRElement {
  return {
    ...base(id),
    type: 'group',
    content: { type: 'group', clip: false, children: [...children] },
  };
}

function text(id: string): RIRElement {
  return {
    ...base(id),
    type: 'text',
    content: {
      type: 'text',
      text: 'hi',
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 400,
      color: '#000',
      align: 'left',
      lineHeight: 1.2,
    },
  };
}

function doc(elements: readonly RIRElement[]): RIRDocument {
  return {
    id: 'doc-1',
    width: 1920,
    height: 1080,
    frameRate: 30,
    durationFrames: 300,
    mode: 'slide',
    elements: [...elements],
    stackingMap: {},
    fontRequirements: [],
    meta: {
      sourceDocId: 'src-1',
      sourceVersion: 1,
      compilerVersion: '0.0.0-test',
      digest: 'sha-test',
    },
  };
}

// --- collectAssetRefs -------------------------------------------------------

describe('collectAssetRefs', () => {
  it('extracts refs from image, video, audio, and embed content', () => {
    const refs = collectAssetRefs(
      doc([
        image('i', 'https://cdn.example/a.png'),
        video('v', 'https://cdn.example/b.mp4'),
        audio('a', 'https://cdn.example/c.mp3'),
        embed('e', 'https://youtube.com/embed/xyz'),
      ]),
    );
    expect(refs).toHaveLength(4);
    expect(refs.map((r) => r.kind).sort()).toEqual(['audio', 'embed', 'image', 'video']);
  });

  it('skips elements without URL-bearing content (text, shape, code, chart, table)', () => {
    const refs = collectAssetRefs(doc([text('t1'), text('t2')]));
    expect(refs).toHaveLength(0);
  });

  it('recurses into groups', () => {
    const refs = collectAssetRefs(
      doc([
        group('g1', [
          image('img', 'https://cdn/a.png'),
          group('g2', [video('v', 'https://cdn/b.mp4')]),
        ]),
      ]),
    );
    expect(refs.map((r) => r.url).sort()).toEqual(['https://cdn/a.png', 'https://cdn/b.mp4']);
  });

  it('deduplicates by URL, preserving first-seen element id', () => {
    const refs = collectAssetRefs(
      doc([
        image('i1', 'https://cdn/dup.png'),
        image('i2', 'https://cdn/dup.png'), // same URL, second element
        image('i3', 'https://cdn/other.png'),
      ]),
    );
    expect(refs).toHaveLength(2);
    const dup = refs.find((r) => r.url === 'https://cdn/dup.png');
    expect(dup?.firstSeenElementId).toBe('i1');
  });

  it('annotates each ref with its element id(s) for diagnostics', () => {
    const refs = collectAssetRefs(
      doc([image('i1', 'https://cdn/a.png'), image('i2', 'https://cdn/a.png')]),
    );
    expect(refs[0]?.referencedBy).toEqual(['i1', 'i2']);
  });

  it('leaves the document unchanged (pure traversal)', () => {
    const original = doc([image('i', 'https://cdn/a.png')]);
    const snapshot = JSON.stringify(original);
    collectAssetRefs(original);
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

// --- rewriteDocumentAssets --------------------------------------------------

describe('rewriteDocumentAssets', () => {
  it('rewrites image / video / audio / embed srcUrl fields via the resolution map', () => {
    const src = doc([
      image('i', 'https://cdn/a.png'),
      video('v', 'https://cdn/b.mp4'),
      audio('a', 'https://cdn/c.mp3'),
      embed('e', 'https://youtube.com/x'),
    ]);

    const rewritten = rewriteDocumentAssets(src, {
      'https://cdn/a.png': 'file:///tmp/cache/a.png',
      'https://cdn/b.mp4': 'file:///tmp/cache/b.mp4',
      'https://cdn/c.mp3': 'file:///tmp/cache/c.mp3',
      'https://youtube.com/x': 'file:///tmp/cache/x.jpg', // rasterized
    });

    const pickContent = (id: string): RIRElementContent => {
      const el = rewritten.elements.find((e) => e.id === id);
      if (!el) throw new Error(`no ${id}`);
      return el.content;
    };

    expect(pickContent('i')).toMatchObject({ srcUrl: 'file:///tmp/cache/a.png' });
    expect(pickContent('v')).toMatchObject({ srcUrl: 'file:///tmp/cache/b.mp4' });
    expect(pickContent('a')).toMatchObject({ srcUrl: 'file:///tmp/cache/c.mp3' });
    expect(pickContent('e')).toMatchObject({ src: 'file:///tmp/cache/x.jpg' });
  });

  it('leaves URLs without a resolution map entry untouched', () => {
    const src = doc([image('i', 'https://cdn/unmapped.png')]);
    const rewritten = rewriteDocumentAssets(src, {});
    const el = rewritten.elements[0];
    expect(el?.content).toMatchObject({ srcUrl: 'https://cdn/unmapped.png' });
  });

  it('recurses into groups', () => {
    const src = doc([group('g', [image('inner', 'https://cdn/a.png')])]);
    const rewritten = rewriteDocumentAssets(src, { 'https://cdn/a.png': 'file:///local.png' });

    const g = rewritten.elements[0];
    expect(g?.content.type).toBe('group');
    if (g?.content.type !== 'group') throw new Error('expected group');
    expect(g.content.children[0]?.content).toMatchObject({ srcUrl: 'file:///local.png' });
  });

  it('does not mutate the input document', () => {
    const src = doc([image('i', 'https://cdn/a.png')]);
    const before = JSON.stringify(src);
    rewriteDocumentAssets(src, { 'https://cdn/a.png': 'file:///local.png' });
    expect(JSON.stringify(src)).toBe(before);
  });
});
