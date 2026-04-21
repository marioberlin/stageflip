// packages/renderer-cdp/src/asset-resolver.test.ts

import type { RIRDocument, RIRElement } from '@stageflip/rir';
import { describe, expect, it } from 'vitest';

import type { AssetRef } from './asset-refs';
import { type AssetResolution, InMemoryAssetResolver, resolveAssets } from './asset-resolver';

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

function embed(id: string, src: string): RIRElement {
  return {
    ...base(id),
    type: 'embed',
    content: { type: 'embed', src, sandbox: [], allowFullscreen: false },
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

// --- InMemoryAssetResolver --------------------------------------------------

describe('InMemoryAssetResolver', () => {
  it('returns ok resolutions for URLs in its fetched map', async () => {
    const resolver = new InMemoryAssetResolver({
      'https://cdn/a.png': 'file:///cache/a.png',
    });
    const ref: AssetRef = {
      kind: 'image',
      url: 'https://cdn/a.png',
      firstSeenElementId: 'i',
      referencedBy: ['i'],
    };
    const res = await resolver.resolve(ref);
    expect(res).toEqual({ status: 'ok', localUrl: 'file:///cache/a.png' });
  });

  it('returns a loss-flag for URLs not in its map', async () => {
    const resolver = new InMemoryAssetResolver({});
    const ref: AssetRef = {
      kind: 'image',
      url: 'https://cdn/missing.png',
      firstSeenElementId: 'i',
      referencedBy: ['i'],
    };
    const res = await resolver.resolve(ref);
    expect(res.status).toBe('loss-flag');
    if (res.status === 'loss-flag') {
      expect(res.reason).toMatch(/not in fixture map/);
    }
  });

  it('records every resolve call in order', async () => {
    const resolver = new InMemoryAssetResolver({ 'https://a': 'file:///a' });
    const ref = (url: string): AssetRef => ({
      kind: 'image',
      url,
      firstSeenElementId: 'x',
      referencedBy: ['x'],
    });
    await resolver.resolve(ref('https://a'));
    await resolver.resolve(ref('https://b'));
    expect(resolver.calls.map((c) => c.url)).toEqual(['https://a', 'https://b']);
  });
});

// --- resolveAssets orchestrator ---------------------------------------------

describe('resolveAssets', () => {
  it('resolves every ref, rewrites the document, and surfaces a resolution map', async () => {
    const d = doc([image('i', 'https://cdn/a.png'), image('j', 'https://cdn/b.png')]);
    const resolver = new InMemoryAssetResolver({
      'https://cdn/a.png': 'file:///cache/a.png',
      'https://cdn/b.png': 'file:///cache/b.png',
    });

    const out = await resolveAssets(d, resolver);

    expect(out.lossFlags).toHaveLength(0);
    expect(out.resolutions).toHaveLength(2);
    expect(out.resolutionMap).toEqual({
      'https://cdn/a.png': 'file:///cache/a.png',
      'https://cdn/b.png': 'file:///cache/b.png',
    });
    // Rewritten document: original URLs replaced with file:// ones.
    const srcs = out.document.elements.map((e) =>
      e.content.type === 'image' ? e.content.srcUrl : null,
    );
    expect(srcs).toEqual(['file:///cache/a.png', 'file:///cache/b.png']);
  });

  it('deduplicates fetch calls across elements referencing the same URL', async () => {
    const d = doc([image('i1', 'https://cdn/dup.png'), image('i2', 'https://cdn/dup.png')]);
    const resolver = new InMemoryAssetResolver({
      'https://cdn/dup.png': 'file:///cache/dup.png',
    });

    await resolveAssets(d, resolver);

    expect(resolver.calls.filter((c) => c.url === 'https://cdn/dup.png')).toHaveLength(1);
  });

  it('collects loss-flagged refs without aborting; leaves their URLs unrewritten', async () => {
    const d = doc([image('i', 'https://cdn/a.png'), embed('e', 'https://youtube.com/embed/xyz')]);
    // Only the image resolves; the embed is unknown → loss-flag.
    const resolver = new InMemoryAssetResolver({
      'https://cdn/a.png': 'file:///cache/a.png',
    });

    const out = await resolveAssets(d, resolver);

    expect(out.resolutions).toHaveLength(1);
    expect(out.lossFlags).toHaveLength(1);
    expect(out.lossFlags[0]?.ref.url).toBe('https://youtube.com/embed/xyz');

    const imageEl = out.document.elements.find((e) => e.id === 'i');
    const embedEl = out.document.elements.find((e) => e.id === 'e');
    expect(imageEl?.content.type === 'image' && imageEl.content.srcUrl).toBe('file:///cache/a.png');
    // Embed stays remote because the resolver flagged it as unsupported.
    expect(embedEl?.content.type === 'embed' && embedEl.content.src).toBe(
      'https://youtube.com/embed/xyz',
    );
  });

  it('returns an unchanged document and empty lists for a doc with no URL-bearing content', async () => {
    const d = doc([]);
    const resolver = new InMemoryAssetResolver({});
    const out = await resolveAssets(d, resolver);

    expect(out.resolutions).toHaveLength(0);
    expect(out.lossFlags).toHaveLength(0);
    expect(out.document).toBe(d); // identity — no rewrite needed
  });

  it('preserves document identity when every ref resolves as loss-flag', async () => {
    // Refs exist, but none fetch successfully — resolutionMap stays empty,
    // rewriter is skipped, input document comes back by identity.
    const d = doc([image('i', 'https://cdn/nope.png')]);
    const resolver = new InMemoryAssetResolver({}); // every URL misses

    const out = await resolveAssets(d, resolver);

    expect(out.resolutions).toHaveLength(0);
    expect(out.lossFlags).toHaveLength(1);
    expect(out.document).toBe(d);
  });

  it('resolver errors propagate up (the resolver contract is fail-loud)', async () => {
    const d = doc([image('i', 'https://cdn/a.png')]);
    const throwing = {
      async resolve(_ref: AssetRef): Promise<AssetResolution> {
        throw new Error('network down');
      },
    };
    await expect(resolveAssets(d, throwing)).rejects.toThrow(/network down/);
  });
});
