// packages/renderer-cdp/src/reference-fixtures.ts
// Three T-090 reference documents. Each is a tiny, deterministic
// `RIRDocument` that exercises a different shape of Phase 4 pipeline
// input:
//
//   solidBackgroundFixture  — one clip element (content-type: clip);
//                             shortest + simplest; tests that
//                             preflight + adapter.mount + encoder
//                             close out on a minimal doc.
//   multiElementFixture     — text + shape (no clips); tests the
//                             "no clips, still renders" path.
//   videoClipFixture        — video content with a remote URL; tests
//                             the asset-preflight integration (the
//                             test uses an InMemoryAssetResolver with
//                             a fixture map to stub the fetch).
//
// The canvas-placeholder host HTML ignores the document contents and
// paints a deterministic frame-number gradient — these fixtures prove
// the orchestration shape, not the runtime output. Pixel-faithful
// reference renders arrive with the T-100 parity harness once a real
// host bundle is wired.

import type { RIRDocument } from '@stageflip/rir';

/**
 * Minimal one-element document — a single full-bleed rectangle. Uses a
 * `shape` rather than a runtime-backed `clip` so preflight resolves
 * cleanly without requiring any runtime registration at test time. The
 * canvas placeholder host ignores the content shape anyway; this
 * fixture exists to prove the shortest possible dispatcher path.
 */
export const solidBackgroundFixture: RIRDocument = {
  id: 'fixture-solid-background',
  width: 320,
  height: 240,
  frameRate: 30,
  durationFrames: 30, // 1 second
  mode: 'slide',
  elements: [
    {
      id: 'bg',
      type: 'shape',
      transform: { x: 0, y: 0, width: 320, height: 240, rotation: 0, opacity: 1 },
      timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
      zIndex: 0,
      visible: true,
      locked: false,
      stacking: 'auto',
      animations: [],
      content: { type: 'shape', shape: 'rect', fill: '#1e3a8a' },
    },
  ],
  stackingMap: { bg: 'auto' },
  fontRequirements: [],
  meta: {
    sourceDocId: 'fixture',
    sourceVersion: 1,
    compilerVersion: '0.0.0-fixture',
    digest: 'fixture-solid-background',
  },
};

/** Text + shape; no clips. Tests preflight on a clip-free document. */
export const multiElementFixture: RIRDocument = {
  id: 'fixture-multi-element',
  width: 320,
  height: 240,
  frameRate: 30,
  durationFrames: 15,
  mode: 'slide',
  elements: [
    {
      id: 'bg',
      type: 'shape',
      transform: { x: 0, y: 0, width: 320, height: 240, rotation: 0, opacity: 1 },
      timing: { startFrame: 0, endFrame: 15, durationFrames: 15 },
      zIndex: 0,
      visible: true,
      locked: false,
      stacking: 'auto',
      animations: [],
      content: { type: 'shape', shape: 'rect', fill: '#0ea5e9' },
    },
    {
      id: 'title',
      type: 'text',
      transform: { x: 24, y: 24, width: 272, height: 40, rotation: 0, opacity: 1 },
      timing: { startFrame: 0, endFrame: 15, durationFrames: 15 },
      zIndex: 10,
      visible: true,
      locked: false,
      stacking: 'auto',
      animations: [],
      content: {
        type: 'text',
        text: 'StageFlip T-090',
        fontFamily: 'Inter',
        fontSize: 24,
        fontWeight: 600,
        color: '#ffffff',
        align: 'left',
        lineHeight: 1.2,
      },
    },
  ],
  stackingMap: { bg: 'auto', title: 'auto' },
  fontRequirements: [{ family: 'Inter', weight: 600, style: 'normal' }],
  meta: {
    sourceDocId: 'fixture',
    sourceVersion: 1,
    compilerVersion: '0.0.0-fixture',
    digest: 'fixture-multi-element',
  },
};

/** Video content with a remote URL — exercises asset preflight. */
export const videoClipFixture: RIRDocument = {
  id: 'fixture-video-clip',
  width: 320,
  height: 240,
  frameRate: 30,
  durationFrames: 15,
  mode: 'video',
  elements: [
    {
      id: 'clip',
      type: 'video',
      transform: { x: 0, y: 0, width: 320, height: 240, rotation: 0, opacity: 1 },
      timing: { startFrame: 0, endFrame: 15, durationFrames: 15 },
      zIndex: 0,
      visible: true,
      locked: false,
      stacking: 'auto',
      animations: [],
      content: {
        type: 'video',
        srcUrl: 'https://cdn.example/test.mp4',
        muted: true,
        loop: false,
        playbackRate: 1,
      },
    },
  ],
  stackingMap: { clip: 'auto' },
  fontRequirements: [],
  meta: {
    sourceDocId: 'fixture',
    sourceVersion: 1,
    compilerVersion: '0.0.0-fixture',
    digest: 'fixture-video-clip',
  },
};

/** All three fixtures as a keyed map, for iteration in tests. */
export const REFERENCE_FIXTURES = {
  solidBackground: solidBackgroundFixture,
  multiElement: multiElementFixture,
  videoClip: videoClipFixture,
} as const;

export type ReferenceFixtureName = keyof typeof REFERENCE_FIXTURES;
