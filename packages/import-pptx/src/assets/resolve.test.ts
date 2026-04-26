// packages/import-pptx/src/assets/resolve.test.ts
// T-243 acceptance tests — written first; stub `resolveAssets` throws so
// every test below fails until the implementation lands.

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type {
  CanonicalSlideTree,
  ParsedImageElement,
  ParsedSlide,
  ParsedVideoElement,
} from '../types.js';
import type { ZipEntries } from '../zip.js';
import { resolveAssets } from './resolve.js';
import { AssetResolutionError, type AssetStorage } from './types.js';

/** A recording mock storage: every `put` is logged for assertions. */
function recordingStorage(): AssetStorage & {
  records: { content: Uint8Array; contentType: string; contentHash: string; id: string }[];
  hits: number;
} {
  const records: {
    content: Uint8Array;
    contentType: string;
    contentHash: string;
    id: string;
  }[] = [];
  return {
    records,
    get hits() {
      return records.length;
    },
    async put(content, opts) {
      const id = opts.contentHash.slice(0, 21);
      records.push({ content, contentType: opts.contentType, contentHash: opts.contentHash, id });
      return { id };
    },
  };
}

function failingStorage(): AssetStorage {
  return {
    async put() {
      throw new Error('upstream failure');
    },
  };
}

/** Helper: build a single-slide tree with one unresolved-asset image. */
function singleImageTree(args: {
  oocxmlPath: string;
}): CanonicalSlideTree {
  const img: ParsedImageElement = {
    id: 'pptx_img1',
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
    type: 'image',
    src: { kind: 'unresolved', oocxmlPath: args.oocxmlPath },
    fit: 'cover',
  };
  const slide: ParsedSlide = { id: 'slide_1', elements: [img] };
  return {
    slides: [slide],
    layouts: {},
    masters: {},
    lossFlags: [
      {
        id: 'flag1',
        source: 'pptx',
        code: 'LF-PPTX-UNRESOLVED-ASSET',
        severity: 'info',
        category: 'media',
        location: { slideId: 'slide_1', elementId: 'pptx_img1', oocxmlPath: args.oocxmlPath },
        message: 'image bytes deferred to T-243',
      },
    ],
  };
}

const BYTES_A = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic
const BYTES_B = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic

describe('resolveAssets — T-243 acceptance', () => {
  // AC #1
  it('rewrites unresolved refs to resolved with `asset:<id>`', async () => {
    const tree = singleImageTree({ oocxmlPath: 'ppt/media/image1.png' });
    const entries: ZipEntries = { 'ppt/media/image1.png': BYTES_A };
    const storage = recordingStorage();

    const out = await resolveAssets(tree, entries, storage);

    const img = out.slides[0]?.elements[0];
    expect(img?.type).toBe('image');
    if (img?.type !== 'image') return;
    expect(img.src.kind).toBe('resolved');
    if (img.src.kind !== 'resolved') return;
    expect(img.src.ref).toMatch(/^asset:[A-Za-z0-9_-]+$/);
    // The id (sans prefix) matches what the storage mock returned.
    expect(img.src.ref).toBe(`asset:${storage.records[0]?.id}`);
  });

  // AC #2 — bytes uploaded match what's in entries.
  it('uploads the exact bytes from the ZIP entry at the rel-resolved path', async () => {
    const tree = singleImageTree({ oocxmlPath: 'ppt/media/image1.png' });
    const entries: ZipEntries = { 'ppt/media/image1.png': BYTES_A };
    const storage = recordingStorage();

    await resolveAssets(tree, entries, storage);

    expect(storage.hits).toBe(1);
    expect(storage.records[0]?.content).toEqual(BYTES_A);
    expect(storage.records[0]?.contentType).toBe('image/png');
  });

  // AC #3 — dedup by content-hash.
  it('uploads each unique content payload exactly once (dedup by content-hash)', async () => {
    // Two image elements, both pointing at the same path -> same bytes.
    const sharedPath = 'ppt/media/image1.png';
    const baseTree = singleImageTree({ oocxmlPath: sharedPath });
    const slide = baseTree.slides[0];
    if (slide === undefined) throw new Error('seed slide missing');
    const dupImg: ParsedImageElement = {
      id: 'pptx_img2',
      transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
      visible: true,
      locked: false,
      animations: [],
      type: 'image',
      src: { kind: 'unresolved', oocxmlPath: sharedPath },
      fit: 'cover',
    };
    slide.elements.push(dupImg);
    baseTree.lossFlags.push({
      id: 'flag2',
      source: 'pptx',
      code: 'LF-PPTX-UNRESOLVED-ASSET',
      severity: 'info',
      category: 'media',
      location: { slideId: 'slide_1', elementId: 'pptx_img2', oocxmlPath: sharedPath },
      message: 'image bytes deferred to T-243',
    });

    const entries: ZipEntries = { [sharedPath]: BYTES_A };
    const storage = recordingStorage();

    const out = await resolveAssets(baseTree, entries, storage);

    expect(storage.hits).toBe(1); // dedup: one upload
    const elements = out.slides[0]?.elements ?? [];
    const ids = elements
      .filter((e): e is ParsedImageElement => e.type === 'image')
      .map((e) => (e.src.kind === 'resolved' ? e.src.ref : null));
    expect(ids[0]).toBe(ids[1]); // both got the same asset ref
  });

  // AC #4 — flags cleared.
  it('drops every LF-PPTX-UNRESOLVED-ASSET after a successful resolution', async () => {
    const tree = singleImageTree({ oocxmlPath: 'ppt/media/image1.png' });
    const entries: ZipEntries = { 'ppt/media/image1.png': BYTES_A };

    const out = await resolveAssets(tree, entries, recordingStorage());

    expect(out.lossFlags.find((f) => f.code === 'LF-PPTX-UNRESOLVED-ASSET')).toBeUndefined();
  });

  // AC #5 — broken-rel handling.
  it('emits LF-PPTX-MISSING-ASSET-BYTES when the ZIP entry is absent; does not throw', async () => {
    const tree = singleImageTree({ oocxmlPath: 'ppt/media/missing.png' });
    const entries: ZipEntries = {}; // no entry present

    const out = await resolveAssets(tree, entries, recordingStorage());

    const flag = out.lossFlags.find((f) => f.code === 'LF-PPTX-MISSING-ASSET-BYTES');
    expect(flag).toBeDefined();
    expect(flag?.severity).toBe('error');
    // The unresolved flag for the broken ref stays — we couldn't resolve it.
    const stillUnresolved = out.lossFlags.find(
      (f) => f.code === 'LF-PPTX-UNRESOLVED-ASSET' && f.location.elementId === 'pptx_img1',
    );
    expect(stillUnresolved).toBeDefined();
    // The image's src is left as unresolved.
    const img = out.slides[0]?.elements[0];
    expect(img?.type).toBe('image');
    if (img?.type !== 'image') return;
    expect(img.src.kind).toBe('unresolved');
  });

  // AC #5 (extra) — partial: one resolves, one missing.
  it('resolves available refs and flags missing ones in the same pass', async () => {
    const sharedTree = singleImageTree({ oocxmlPath: 'ppt/media/image1.png' });
    const slide = sharedTree.slides[0];
    if (slide === undefined) throw new Error('seed slide missing');
    slide.elements.push({
      id: 'pptx_img2',
      transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
      visible: true,
      locked: false,
      animations: [],
      type: 'image',
      src: { kind: 'unresolved', oocxmlPath: 'ppt/media/missing.png' },
      fit: 'cover',
    });
    sharedTree.lossFlags.push({
      id: 'flag2',
      source: 'pptx',
      code: 'LF-PPTX-UNRESOLVED-ASSET',
      severity: 'info',
      category: 'media',
      location: {
        slideId: 'slide_1',
        elementId: 'pptx_img2',
        oocxmlPath: 'ppt/media/missing.png',
      },
      message: 'image bytes deferred to T-243',
    });

    const entries: ZipEntries = { 'ppt/media/image1.png': BYTES_A };
    const storage = recordingStorage();
    const out = await resolveAssets(sharedTree, entries, storage);

    expect(storage.hits).toBe(1);
    const els = out.slides[0]?.elements ?? [];
    const img1 = els[0];
    const img2 = els[1];
    expect(img1?.type === 'image' && img1.src.kind === 'resolved').toBe(true);
    expect(img2?.type === 'image' && img2.src.kind === 'unresolved').toBe(true);
  });

  // AC #6 — storage failure throws AssetResolutionError.
  it('throws AssetResolutionError(STORAGE_UPLOAD_FAILED) when storage rejects', async () => {
    const tree = singleImageTree({ oocxmlPath: 'ppt/media/image1.png' });
    const entries: ZipEntries = { 'ppt/media/image1.png': BYTES_A };

    await expect(resolveAssets(tree, entries, failingStorage())).rejects.toBeInstanceOf(
      AssetResolutionError,
    );
    try {
      await resolveAssets(tree, entries, failingStorage());
    } catch (err) {
      expect(err).toBeInstanceOf(AssetResolutionError);
      expect((err as AssetResolutionError).code).toBe('STORAGE_UPLOAD_FAILED');
    }
  });

  // AC #8 — assetsResolved marker + idempotence.
  it('sets assetsResolved and short-circuits a second call with no new uploads', async () => {
    const tree = singleImageTree({ oocxmlPath: 'ppt/media/image1.png' });
    const entries: ZipEntries = { 'ppt/media/image1.png': BYTES_A };
    const storage = recordingStorage();

    const once = await resolveAssets(tree, entries, storage);
    expect(once.assetsResolved).toBe(true);
    expect(storage.hits).toBe(1);

    const twice = await resolveAssets(once, entries, storage);
    expect(twice.assetsResolved).toBe(true);
    expect(storage.hits).toBe(1); // no second upload
    expect(twice).toEqual(once);
  });

  // AC #2 (extra) — content-hash hint matches sha256 of bytes.
  it("passes the bytes' sha256 as contentHash to storage", async () => {
    const tree = singleImageTree({ oocxmlPath: 'ppt/media/image1.png' });
    const entries: ZipEntries = { 'ppt/media/image1.png': BYTES_B };
    const storage = recordingStorage();

    await resolveAssets(tree, entries, storage);

    const expected = createHash('sha256').update(BYTES_B).digest('hex');
    expect(storage.records[0]?.contentHash).toBe(expected);
  });

  // Bonus — different bytes get separate uploads (no false dedup).
  it('uploads twice when two refs have different content', async () => {
    const tree = singleImageTree({ oocxmlPath: 'ppt/media/image1.png' });
    const slide = tree.slides[0];
    if (slide === undefined) throw new Error('seed slide missing');
    slide.elements.push({
      id: 'pptx_img2',
      transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
      visible: true,
      locked: false,
      animations: [],
      type: 'image',
      src: { kind: 'unresolved', oocxmlPath: 'ppt/media/image2.jpg' },
      fit: 'cover',
    });
    tree.lossFlags.push({
      id: 'flag2',
      source: 'pptx',
      code: 'LF-PPTX-UNRESOLVED-ASSET',
      severity: 'info',
      category: 'media',
      location: { slideId: 'slide_1', elementId: 'pptx_img2', oocxmlPath: 'ppt/media/image2.jpg' },
      message: 'image bytes deferred to T-243',
    });

    const entries: ZipEntries = {
      'ppt/media/image1.png': BYTES_A,
      'ppt/media/image2.jpg': BYTES_B,
    };
    const storage = recordingStorage();
    await resolveAssets(tree, entries, storage);

    expect(storage.hits).toBe(2);
    expect(storage.records.map((r) => r.contentType).sort()).toEqual(['image/jpeg', 'image/png']);
  });

  // Bonus — non-image, non-group elements (text, shape) pass through unchanged.
  it('leaves non-image, non-group elements unchanged', async () => {
    const tree = singleImageTree({ oocxmlPath: 'ppt/media/image1.png' });
    const slide = tree.slides[0];
    if (slide === undefined) throw new Error('seed slide missing');
    slide.elements.push(
      {
        id: 'pptx_text1',
        transform: { x: 0, y: 0, width: 100, height: 50, rotation: 0, opacity: 1 },
        visible: true,
        locked: false,
        animations: [],
        type: 'text',
        text: 'hello',
        align: 'left',
      },
      {
        id: 'pptx_shape1',
        transform: { x: 0, y: 0, width: 50, height: 50, rotation: 0, opacity: 1 },
        visible: true,
        locked: false,
        animations: [],
        type: 'shape',
        shape: 'rect',
      },
    );

    const entries: ZipEntries = { 'ppt/media/image1.png': BYTES_A };
    const out = await resolveAssets(tree, entries, recordingStorage());

    const els = out.slides[0]?.elements ?? [];
    expect(els[1]).toEqual(slide.elements[1]); // text passthrough
    expect(els[2]).toEqual(slide.elements[2]); // shape passthrough
  });

  // T-243b AC #10 — video resolution rewrites src to schema-typed asset:<id>.
  it('resolves a ParsedVideoElement: rewrites src to asset:<id> and uploads bytes', async () => {
    const video: ParsedVideoElement = {
      id: 'pptx_v1',
      transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
      visible: true,
      locked: false,
      animations: [],
      type: 'video',
      src: { kind: 'unresolved', oocxmlPath: 'ppt/media/video1.mp4' },
      muted: false,
      loop: false,
      playbackRate: 1,
    };
    const slide: ParsedSlide = { id: 'slide_1', elements: [video] };
    const tree: CanonicalSlideTree = {
      slides: [slide],
      layouts: {},
      masters: {},
      lossFlags: [
        {
          id: 'flag-v1',
          source: 'pptx',
          code: 'LF-PPTX-UNRESOLVED-VIDEO',
          severity: 'info',
          category: 'media',
          location: {
            slideId: 'slide_1',
            elementId: 'pptx_v1',
            oocxmlPath: 'ppt/media/video1.mp4',
          },
          message: 'video bytes deferred to T-243b',
        },
      ],
    };
    const entries: ZipEntries = { 'ppt/media/video1.mp4': BYTES_A };
    const storage = recordingStorage();

    const out = await resolveAssets(tree, entries, storage);

    expect(storage.hits).toBe(1);
    expect(storage.records[0]?.contentType).toBe('video/mp4');
    expect(storage.records[0]?.content).toEqual(BYTES_A);

    const v = out.slides[0]?.elements[0];
    expect(v?.type).toBe('video');
    if (v?.type !== 'video') return;
    expect(v.src.kind).toBe('resolved');
    if (v.src.kind !== 'resolved') return;
    expect(v.src.ref).toMatch(/^asset:[A-Za-z0-9_-]+$/);
  });

  // T-243b AC #11 — LF-PPTX-UNRESOLVED-VIDEO drops after resolution.
  it('drops LF-PPTX-UNRESOLVED-VIDEO from lossFlags after a successful video resolution', async () => {
    const video: ParsedVideoElement = {
      id: 'pptx_v1',
      transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
      visible: true,
      locked: false,
      animations: [],
      type: 'video',
      src: { kind: 'unresolved', oocxmlPath: 'ppt/media/video1.mp4' },
      muted: false,
      loop: false,
      playbackRate: 1,
    };
    const tree: CanonicalSlideTree = {
      slides: [{ id: 'slide_1', elements: [video] }],
      layouts: {},
      masters: {},
      lossFlags: [
        {
          id: 'flag-v1',
          source: 'pptx',
          code: 'LF-PPTX-UNRESOLVED-VIDEO',
          severity: 'info',
          category: 'media',
          location: {
            slideId: 'slide_1',
            elementId: 'pptx_v1',
            oocxmlPath: 'ppt/media/video1.mp4',
          },
          message: 'video bytes deferred to T-243b',
        },
      ],
    };
    const entries: ZipEntries = { 'ppt/media/video1.mp4': BYTES_A };
    const out = await resolveAssets(tree, entries, recordingStorage());
    expect(out.lossFlags.find((f) => f.code === 'LF-PPTX-UNRESOLVED-VIDEO')).toBeUndefined();
  });

  // T-243b AC #12 — missing video bytes → LF-PPTX-MISSING-ASSET-BYTES, ref stays unresolved.
  it('emits LF-PPTX-MISSING-ASSET-BYTES for absent video bytes (ref stays unresolved)', async () => {
    const video: ParsedVideoElement = {
      id: 'pptx_v1',
      transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
      visible: true,
      locked: false,
      animations: [],
      type: 'video',
      src: { kind: 'unresolved', oocxmlPath: 'ppt/media/missing.mp4' },
      muted: false,
      loop: false,
      playbackRate: 1,
    };
    const tree: CanonicalSlideTree = {
      slides: [{ id: 'slide_1', elements: [video] }],
      layouts: {},
      masters: {},
      lossFlags: [
        {
          id: 'flag-v1',
          source: 'pptx',
          code: 'LF-PPTX-UNRESOLVED-VIDEO',
          severity: 'info',
          category: 'media',
          location: {
            slideId: 'slide_1',
            elementId: 'pptx_v1',
            oocxmlPath: 'ppt/media/missing.mp4',
          },
          message: 'video bytes deferred to T-243b',
        },
      ],
    };
    const entries: ZipEntries = {};
    const out = await resolveAssets(tree, entries, recordingStorage());

    const missingFlag = out.lossFlags.find((f) => f.code === 'LF-PPTX-MISSING-ASSET-BYTES');
    expect(missingFlag).toBeDefined();
    expect(missingFlag?.severity).toBe('error');

    // Unresolved-video flag stays (we couldn't resolve it).
    const stillUnresolved = out.lossFlags.find(
      (f) => f.code === 'LF-PPTX-UNRESOLVED-VIDEO' && f.location.elementId === 'pptx_v1',
    );
    expect(stillUnresolved).toBeDefined();

    const v = out.slides[0]?.elements[0];
    expect(v?.type).toBe('video');
    if (v?.type !== 'video') return;
    expect(v.src.kind).toBe('unresolved');
  });

  // T-243b AC #14 — idempotence on a video tree.
  it('is idempotent across a second resolveAssets call (no extra video upload)', async () => {
    const video: ParsedVideoElement = {
      id: 'pptx_v1',
      transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
      visible: true,
      locked: false,
      animations: [],
      type: 'video',
      src: { kind: 'unresolved', oocxmlPath: 'ppt/media/video1.mp4' },
      muted: false,
      loop: false,
      playbackRate: 1,
    };
    const tree: CanonicalSlideTree = {
      slides: [{ id: 'slide_1', elements: [video] }],
      layouts: {},
      masters: {},
      lossFlags: [
        {
          id: 'flag-v1',
          source: 'pptx',
          code: 'LF-PPTX-UNRESOLVED-VIDEO',
          severity: 'info',
          category: 'media',
          location: {
            slideId: 'slide_1',
            elementId: 'pptx_v1',
            oocxmlPath: 'ppt/media/video1.mp4',
          },
          message: 'video bytes deferred to T-243b',
        },
      ],
    };
    const entries: ZipEntries = { 'ppt/media/video1.mp4': BYTES_A };
    const storage = recordingStorage();

    const once = await resolveAssets(tree, entries, storage);
    expect(once.assetsResolved).toBe(true);
    expect(storage.hits).toBe(1);

    const twice = await resolveAssets(once, entries, storage);
    expect(storage.hits).toBe(1);
    expect(twice).toEqual(once);
  });

  // T-243b — videos inside groups still resolve.
  it('walks videos nested inside <p:grpSp> groups', async () => {
    const video: ParsedVideoElement = {
      id: 'pptx_v1',
      transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
      visible: true,
      locked: false,
      animations: [],
      type: 'video',
      src: { kind: 'unresolved', oocxmlPath: 'ppt/media/video1.mp4' },
      muted: false,
      loop: false,
      playbackRate: 1,
    };
    const tree: CanonicalSlideTree = {
      slides: [
        {
          id: 'slide_1',
          elements: [
            {
              id: 'pptx_g1',
              transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
              visible: true,
              locked: false,
              animations: [],
              type: 'group',
              children: [video],
              clip: false,
              groupOrigin: { x: 0, y: 0 },
              groupExtent: { width: 100, height: 100 },
            },
          ],
        },
      ],
      layouts: {},
      masters: {},
      lossFlags: [],
    };
    const entries: ZipEntries = { 'ppt/media/video1.mp4': BYTES_A };
    const storage = recordingStorage();
    const out = await resolveAssets(tree, entries, storage);

    expect(storage.hits).toBe(1);
    const group = out.slides[0]?.elements[0];
    expect(group?.type).toBe('group');
    if (group?.type !== 'group') return;
    const child = group.children[0];
    expect(child?.type).toBe('video');
    if (child?.type !== 'video') return;
    expect(child.src.kind).toBe('resolved');
  });

  // Bonus — layouts and masters are walked.
  it('walks layouts and masters in addition to slides', async () => {
    const baseSlide = singleImageTree({ oocxmlPath: 'ppt/media/image1.png' }).slides[0];
    if (baseSlide === undefined) throw new Error('seed slide missing');
    const tree: CanonicalSlideTree = {
      slides: [],
      layouts: { L1: baseSlide },
      masters: { M1: baseSlide },
      lossFlags: [
        {
          id: 'flag1',
          source: 'pptx',
          code: 'LF-PPTX-UNRESOLVED-ASSET',
          severity: 'info',
          category: 'media',
          location: {
            slideId: 'slide_1',
            elementId: 'pptx_img1',
            oocxmlPath: 'ppt/media/image1.png',
          },
          message: 'image bytes deferred to T-243',
        },
      ],
    };
    const entries: ZipEntries = { 'ppt/media/image1.png': BYTES_A };
    const storage = recordingStorage();
    const out = await resolveAssets(tree, entries, storage);

    const layoutImg = out.layouts.L1?.elements[0];
    expect(layoutImg?.type === 'image' && layoutImg.src.kind === 'resolved').toBe(true);
    const masterImg = out.masters.M1?.elements[0];
    expect(masterImg?.type === 'image' && masterImg.src.kind === 'resolved').toBe(true);
  });
});
