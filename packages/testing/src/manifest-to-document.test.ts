// packages/testing/src/manifest-to-document.test.ts
// Unit tests for the `manifestToDocument` converter. Exercises the
// shape mapping, Zod validation, deterministic digest, and option
// overrides using a hand-built `FixtureManifest` rather than loading
// the real 5 parity fixtures — tests stay stable even when the
// fixtures under `packages/testing/fixtures/` drift.

import { rirDocumentSchema } from '@stageflip/rir';
import { describe, expect, it } from 'vitest';

import type { FixtureManifest } from './fixture-manifest.js';
import { manifestToDocument } from './manifest-to-document.js';

function mkManifest(overrides: Partial<FixtureManifest> = {}): FixtureManifest {
  return {
    name: 'test-fixture',
    runtime: 'css',
    kind: 'solid-background',
    description: 'for tests',
    composition: { width: 320, height: 240, fps: 30, durationInFrames: 30 },
    clip: { from: 0, durationInFrames: 30, props: { color: '#1e3a8a' } },
    referenceFrames: [0, 15, 29],
    ...overrides,
  };
}

describe('manifestToDocument', () => {
  it('maps composition → doc-level fields and mode defaults to slide', () => {
    const m = mkManifest();
    const doc = manifestToDocument(m);
    expect(doc.width).toBe(320);
    expect(doc.height).toBe(240);
    expect(doc.frameRate).toBe(30);
    expect(doc.durationFrames).toBe(30);
    expect(doc.mode).toBe('slide');
  });

  it('emits a single clip element wrapping {runtime, kind, props}', () => {
    const m = mkManifest({
      runtime: 'gsap',
      kind: 'motion-text-gsap',
      clip: { from: 5, durationInFrames: 20, props: { text: 'hi', scale: 1.2 } },
    });
    const doc = manifestToDocument(m);
    expect(doc.elements).toHaveLength(1);
    const el = doc.elements[0]!;
    expect(el.type).toBe('clip');
    expect(el.content).toEqual({
      type: 'clip',
      runtime: 'gsap',
      clipName: 'motion-text-gsap',
      params: { text: 'hi', scale: 1.2 },
    });
  });

  it('sets clip timing window from clip.from + clip.durationInFrames', () => {
    const m = mkManifest({
      composition: { width: 320, height: 240, fps: 30, durationInFrames: 60 },
      clip: { from: 10, durationInFrames: 40, props: {} },
    });
    const doc = manifestToDocument(m);
    const el = doc.elements[0]!;
    expect(el.timing.startFrame).toBe(10);
    expect(el.timing.endFrame).toBe(50);
    expect(el.timing.durationFrames).toBe(40);
  });

  it('sets a full-bleed transform at opacity 1 and rotation 0', () => {
    const m = mkManifest();
    const doc = manifestToDocument(m);
    const el = doc.elements[0]!;
    expect(el.transform).toEqual({
      x: 0,
      y: 0,
      width: m.composition.width,
      height: m.composition.height,
      rotation: 0,
      opacity: 1,
    });
  });

  it('sets visible + unlocked defaults and stacking to auto', () => {
    const m = mkManifest();
    const doc = manifestToDocument(m);
    const el = doc.elements[0]!;
    expect(el.visible).toBe(true);
    expect(el.locked).toBe(false);
    expect(el.stacking).toBe('auto');
    expect(el.zIndex).toBe(0);
    expect(el.animations).toEqual([]);
  });

  it('propagates element id into stackingMap', () => {
    const m = mkManifest();
    const doc = manifestToDocument(m, { elementId: 'my-clip' });
    expect(doc.elements[0]?.id).toBe('my-clip');
    expect(doc.stackingMap).toEqual({ 'my-clip': 'auto' });
  });

  it('uses deterministic defaults: documentId = fixture-<name>, digest = <name>', () => {
    const m = mkManifest({ name: 'css-solid-background' });
    const doc = manifestToDocument(m);
    expect(doc.id).toBe('fixture-css-solid-background');
    expect(doc.meta.digest).toBe('css-solid-background');
    expect(doc.meta.sourceDocId).toBe('fixture-source-css-solid-background');
  });

  it('two calls on the same manifest return byte-identical documents', () => {
    const m = mkManifest();
    const a = manifestToDocument(m);
    const b = manifestToDocument(m);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('respects documentId + compilerVersion overrides', () => {
    const m = mkManifest();
    const doc = manifestToDocument(m, {
      documentId: 'custom-doc-id',
      compilerVersion: 'test-1.2.3',
    });
    expect(doc.id).toBe('custom-doc-id');
    expect(doc.meta.compilerVersion).toBe('test-1.2.3');
  });

  it('emits fontRequirements as an empty array (manifests carry no font info)', () => {
    expect(manifestToDocument(mkManifest()).fontRequirements).toEqual([]);
  });

  it('parses cleanly through rirDocumentSchema — no shape drift', () => {
    const doc = manifestToDocument(mkManifest());
    expect(() => rirDocumentSchema.parse(doc)).not.toThrow();
  });

  it('handles non-zero clip start (clip does not span the full composition)', () => {
    const m = mkManifest({
      composition: { width: 320, height: 240, fps: 30, durationInFrames: 100 },
      clip: { from: 25, durationInFrames: 50, props: {} },
    });
    const doc = manifestToDocument(m);
    // Doc timeline stays at 100 frames; the clip is positioned inside it.
    expect(doc.durationFrames).toBe(100);
    expect(doc.elements[0]?.timing.startFrame).toBe(25);
    expect(doc.elements[0]?.timing.endFrame).toBe(75);
    expect(doc.elements[0]?.timing.durationFrames).toBe(50);
  });

  it('empty params object is preserved (not stripped to undefined)', () => {
    const m = mkManifest({ clip: { from: 0, durationInFrames: 30, props: {} } });
    const doc = manifestToDocument(m);
    const content = doc.elements[0]?.content;
    expect(content).toBeDefined();
    if (content && content.type === 'clip') {
      expect(content.params).toEqual({});
    }
  });
});
