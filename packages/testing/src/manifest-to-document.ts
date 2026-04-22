// packages/testing/src/manifest-to-document.ts
// Converts a parity `FixtureManifest` (the JSON-manifest shape T-067
// defined and T-102 extended with thresholds + goldens) into a full
// `RIRDocument` suitable for `PuppeteerCdpSession.mount` + any other
// renderer that consumes RIR directly.
//
// Manifests carry only the fields a scoring-time renderer needs:
// composition, one clip's `{runtime, kind, props}` + its window.
// RIR requires a full element tree with transforms, timings, stacking
// hints, and digest metadata. This converter hand-assembles the
// minimum tree that satisfies `rirDocumentSchema`: one full-bleed
// clip element wrapping the manifest's `{runtime, kind, props}`.
//
// The result is Zod-validated before return so a malformed manifest
// produces a loud parse error at conversion time rather than a
// silent runtime failure at mount time.
//
// T-119d ships this in support of T-119b's `stageflip-parity prime`
// gaining a `--parity` flag (future task) that renders the 5 parity
// fixtures under `packages/testing/fixtures/`. Until that wiring
// lands, this converter is standalone + testable.

import { type RIRDocument, rirDocumentSchema } from '@stageflip/rir';

import type { FixtureManifest } from './fixture-manifest.js';

/**
 * Options for `manifestToDocument`. All fields default to values that
 * keep the output byte-stable across calls on the same manifest, so
 * golden PNGs rendered from a converted document are reproducible.
 */
export interface ManifestToDocumentOptions {
  /**
   * Override the single clip element's id. Defaults to
   * `'fixture-clip-0'`. Tests override to assert id propagation to
   * the `stackingMap`.
   */
  readonly elementId?: string;
  /**
   * Override the generated document id. Defaults to
   * `'fixture-<manifest.name>'`.
   */
  readonly documentId?: string;
  /**
   * Override the `meta.compilerVersion` string. Defaults to
   * `'fixture-manifest-0.0.0'` — this isn't a real compiler run, it's
   * a hand-assembly, but RIR requires a non-empty string.
   */
  readonly compilerVersion?: string;
}

const DEFAULT_ELEMENT_ID = 'fixture-clip-0';
const DEFAULT_COMPILER_VERSION = 'fixture-manifest-0.0.0';

/**
 * Convert `manifest` into a renderable `RIRDocument`.
 *
 * Mapping:
 *   - composition → doc width/height/frameRate/durationFrames + mode `'slide'`
 *   - clip.from + clip.durationInFrames → the element's timing window
 *   - full-bleed transform (`0,0 → composition.width,composition.height`)
 *   - {runtime, kind, props} → `content: { type: 'clip', runtime, clipName, params }`
 *   - single-element stackingMap (`'auto'`)
 *   - empty fontRequirements (manifest schema has no font info — if a
 *     clip needs fonts the runtime is responsible for loading them)
 *   - `meta.digest` = `manifest.name` so two conversions of the same
 *     manifest produce byte-identical documents
 */
export function manifestToDocument(
  manifest: FixtureManifest,
  options: ManifestToDocumentOptions = {},
): RIRDocument {
  const elementId = options.elementId ?? DEFAULT_ELEMENT_ID;
  const documentId = options.documentId ?? `fixture-${manifest.name}`;
  const compilerVersion = options.compilerVersion ?? DEFAULT_COMPILER_VERSION;

  const startFrame = manifest.clip.from;
  const endFrame = startFrame + manifest.clip.durationInFrames;

  const doc: RIRDocument = {
    id: documentId,
    width: manifest.composition.width,
    height: manifest.composition.height,
    frameRate: manifest.composition.fps,
    durationFrames: manifest.composition.durationInFrames,
    mode: 'slide',
    elements: [
      {
        id: elementId,
        type: 'clip',
        transform: {
          x: 0,
          y: 0,
          width: manifest.composition.width,
          height: manifest.composition.height,
          rotation: 0,
          opacity: 1,
        },
        timing: {
          startFrame,
          endFrame,
          durationFrames: manifest.clip.durationInFrames,
        },
        zIndex: 0,
        visible: true,
        locked: false,
        stacking: 'auto',
        animations: [],
        content: {
          type: 'clip',
          runtime: manifest.runtime,
          clipName: manifest.kind,
          params: manifest.clip.props,
        },
      },
    ],
    stackingMap: { [elementId]: 'auto' },
    fontRequirements: [],
    meta: {
      sourceDocId: `fixture-source-${manifest.name}`,
      sourceVersion: 1,
      compilerVersion,
      digest: manifest.name,
    },
  };

  // Validate before returning. A shape drift between this converter
  // and `rirDocumentSchema` surfaces as a parse error at conversion
  // time instead of a mysterious mount failure in real Chrome.
  return rirDocumentSchema.parse(doc);
}
