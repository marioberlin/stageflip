// packages/rir/src/compile/finalize.test.ts
// Unit tests for the T-031 finalize pass: stacking-context + timing-flatten
// + animation resolution.

import type { Document } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { compileRIR } from './index.js';

const NOW = '2026-04-20T12:00:00.000Z';
const TF = { x: 0, y: 0, width: 100, height: 50 };

const buildDoc = (partial: Partial<Document>): Document =>
  ({
    meta: { id: 'd1', version: 0, createdAt: NOW, updatedAt: NOW },
    theme: { tokens: {} },
    variables: {},
    components: {},
    ...partial,
  }) as Document;

describe('stacking-context pass', () => {
  it('sets stacking=isolate for embed elements', () => {
    const doc = buildDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's',
            elements: [
              { id: 'em', type: 'embed', transform: TF, src: 'https://example.com/widget' },
              { id: 'tx', type: 'text', transform: TF, text: 'plain' },
            ],
          },
        ],
      },
    });
    const { rir } = compileRIR(doc);
    expect(rir.stackingMap.em).toBe('isolate');
    expect(rir.stackingMap.tx).toBe('auto');
    expect(rir.elements.find((e) => e.id === 'em')?.stacking).toBe('isolate');
  });

  it('sets stacking=isolate for clip elements with runtime three/shader', () => {
    const doc = buildDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's',
            elements: [
              {
                id: 'c3',
                type: 'clip',
                transform: TF,
                runtime: 'three',
                clipName: 'product-reveal',
              },
              {
                id: 'cs',
                type: 'clip',
                transform: TF,
                runtime: 'shader',
                clipName: 'glitch',
              },
              {
                id: 'cg',
                type: 'clip',
                transform: TF,
                runtime: 'gsap',
                clipName: 'motion-text',
              },
            ],
          },
        ],
      },
    });
    const { rir } = compileRIR(doc);
    expect(rir.stackingMap.c3).toBe('isolate');
    expect(rir.stackingMap.cs).toBe('isolate');
    expect(rir.stackingMap.cg).toBe('auto');
  });

  it('propagates stacking decisions to nested group children', () => {
    const doc = buildDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's',
            elements: [
              {
                id: 'g',
                type: 'group',
                transform: TF,
                children: [
                  { id: 'em', type: 'embed', transform: TF, src: 'https://example.com/w' },
                ],
              },
            ],
          },
        ],
      },
    });
    const { rir } = compileRIR(doc);
    expect(rir.stackingMap.em).toBe('isolate');
  });
});

describe('timing-flatten: slide windows', () => {
  it('assigns per-slide windows based on cumulative durationMs', () => {
    const doc = buildDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            durationMs: 1000,
            elements: [{ id: 'a', type: 'text', transform: TF, text: 'a' }],
          },
          {
            id: 's2',
            durationMs: 2000,
            elements: [{ id: 'b', type: 'text', transform: TF, text: 'b' }],
          },
        ],
      },
    });
    const { rir } = compileRIR(doc);
    // Default frameRate for slide mode is 30.
    expect(rir.frameRate).toBe(30);
    expect(rir.elements.find((e) => e.id === 'a')?.timing).toEqual({
      startFrame: 0,
      endFrame: 30,
      durationFrames: 30,
    });
    expect(rir.elements.find((e) => e.id === 'b')?.timing).toEqual({
      startFrame: 30,
      endFrame: 90,
      durationFrames: 60,
    });
  });

  it('video mode: tracks span the full composition window', () => {
    const doc = buildDoc({
      content: {
        mode: 'video',
        aspectRatio: '16:9',
        durationMs: 2000,
        frameRate: 30,
        tracks: [
          {
            id: 'v',
            kind: 'visual',
            elements: [{ id: 'a', type: 'text', transform: TF, text: 'x' }],
          },
        ],
      },
    });
    const { rir } = compileRIR(doc);
    expect(rir.elements[0]?.timing).toEqual({
      startFrame: 0,
      endFrame: 60,
      durationFrames: 60,
    });
  });
});

describe('timing-flatten: B1–B5 animation resolution', () => {
  const docWithAnim = (timing: unknown) =>
    buildDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's1',
            durationMs: 2000, // 60 frames @ 30fps
            elements: [
              {
                id: 'el',
                type: 'text',
                transform: TF,
                text: 'x',
                animations: [
                  {
                    id: 'a1',
                    timing,
                    animation: { kind: 'fade' },
                    autoplay: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    }) as Document;

  it('B1 absolute: startFrame is relative to element window start', () => {
    const doc = docWithAnim({ kind: 'absolute', startFrame: 10, durationFrames: 20 });
    const { rir, diagnostics } = compileRIR(doc);
    const anim = rir.elements[0]?.animations[0];
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(anim?.timing).toEqual({ startFrame: 10, endFrame: 30, durationFrames: 20 });
  });

  it('B2 relative: offset from element window start; clamps at start', () => {
    const okDoc = docWithAnim({ kind: 'relative', offsetFrames: 5, durationFrames: 10 });
    const { rir: ok } = compileRIR(okDoc);
    expect(ok.elements[0]?.animations[0]?.timing.startFrame).toBe(5);

    const negDoc = docWithAnim({ kind: 'relative', offsetFrames: -100, durationFrames: 10 });
    const { rir: neg } = compileRIR(negDoc);
    // Clamped to the element's start frame (0 here).
    expect(neg.elements[0]?.animations[0]?.timing.startFrame).toBe(0);
  });

  it('B3 anchored: resolves to prior-resolved anchor; unresolved warns', () => {
    // Two elements on the same slide; one anchors to the other's start.
    const doc = buildDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's',
            durationMs: 2000,
            elements: [
              { id: 'anchorEl', type: 'text', transform: TF, text: 'anchor' },
              {
                id: 'other',
                type: 'text',
                transform: TF,
                text: 'anchored',
                animations: [
                  {
                    id: 'a1',
                    timing: {
                      kind: 'anchored',
                      anchor: 'anchorEl',
                      anchorEdge: 'start',
                      durationFrames: 15,
                    },
                    animation: { kind: 'fade' },
                    autoplay: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const { rir, diagnostics } = compileRIR(doc);
    const anim = rir.elements.find((e) => e.id === 'other')?.animations[0];
    expect(anim?.timing.startFrame).toBe(0); // anchorEl start
    expect(anim?.timing.durationFrames).toBe(15);
    expect(diagnostics.some((d) => d.code === 'anchored-unresolved')).toBe(false);
  });

  it('B3 anchored: unresolved anchor emits warn + falls back to element start', () => {
    const doc = docWithAnim({
      kind: 'anchored',
      anchor: 'ghost',
      anchorEdge: 'start',
      durationFrames: 10,
    });
    const { diagnostics } = compileRIR(doc);
    expect(diagnostics.some((d) => d.code === 'anchored-unresolved')).toBe(true);
  });

  it('B4 beat: emits beat-no-bpm warn (feature not wired yet)', () => {
    const doc = docWithAnim({ kind: 'beat', beat: 4, durationBeats: 1 });
    const { diagnostics } = compileRIR(doc);
    expect(diagnostics.some((d) => d.code === 'beat-no-bpm')).toBe(true);
  });

  it('B5 event: emits event-deferred info', () => {
    const doc = docWithAnim({ kind: 'event', event: 'clipComplete', durationFrames: 10 });
    const { diagnostics } = compileRIR(doc);
    expect(diagnostics.some((d) => d.code === 'event-deferred')).toBe(true);
  });
});

describe('finalize: determinism + digest', () => {
  it('digest covers post-T-031 refinements (timing + stacking)', () => {
    const docA = buildDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's',
            elements: [{ id: 'em', type: 'embed', transform: TF, src: 'https://x.com/a' }],
          },
        ],
      },
    });
    const docB = buildDoc({
      content: {
        mode: 'slide',
        slides: [
          {
            id: 's',
            elements: [{ id: 'em', type: 'text', transform: TF, text: 'a' }],
          },
        ],
      },
    });
    // Different element types -> different stacking -> different digests.
    const a = compileRIR(docA).rir.meta.digest;
    const b = compileRIR(docB).rir.meta.digest;
    expect(a).not.toBe(b);
  });
});
