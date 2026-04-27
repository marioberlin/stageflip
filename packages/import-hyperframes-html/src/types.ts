// packages/import-hyperframes-html/src/types.ts
// Local types for the Hyperframes HTML importer/exporter. Mirrors patterns
// from `@stageflip/import-pptx`'s `types.ts`: a `ParsedAssetRef` discriminated
// union that flows through the structural pass with unresolved external URLs;
// a closed `LossFlagCode` union scoping the `LF-HYPERFRAMES-HTML-*` codes; and
// a local `AssetReader` interface (per T-247 spec §1's deferred-coupling
// decision) for the export direction's optional asset bytes lookup.

import type { LossFlag } from '@stageflip/loss-flags';
import type {
  AssetRef,
  AudioElement,
  Document,
  ImageElement,
  TextElement,
  VideoElement,
} from '@stageflip/schema';

/**
 * Where an asset reference came from. Mirrors `@stageflip/import-pptx`'s
 * `ParsedAssetRef` shape: resolved variants carry a schema-typed `AssetRef`;
 * unresolved variants carry the original URL as `oocxmlPath` (the field name
 * is reused so consumers walking heterogeneous parsed trees can branch on
 * `kind` without per-importer schemas). For Hyperframes the `oocxmlPath`
 * value is the inline `<img src>` / `<video src>` / `data-asset-src`
 * URL — not an OPC path — but the field shape is identical so downstream
 * `resolveAssets` passes can accept both importers' output.
 */
export type ParsedAssetRef =
  | { kind: 'resolved'; ref: AssetRef }
  | { kind: 'unresolved'; oocxmlPath: string };

/** Stable code names for every Hyperframes-HTML-specific loss situation. */
export type HfhtmlLossFlagCode =
  | 'LF-HYPERFRAMES-HTML-CLASS-STYLE-LOST'
  | 'LF-HYPERFRAMES-HTML-ANIMATIONS-DROPPED'
  | 'LF-HYPERFRAMES-HTML-CAPTIONS-UNRECOGNIZED'
  | 'LF-HYPERFRAMES-HTML-UNSUPPORTED-ELEMENT'
  | 'LF-HYPERFRAMES-HTML-DIMENSION-INFERRED'
  | 'LF-HYPERFRAMES-HTML-ASSET-MISSING';

/**
 * Read-only asset reader passed to `exportHyperframes` so the writer can
 * inline `<img>` data URIs (or any future bytes-bearing emission). Defined
 * locally per T-247 §1 — the equivalent T-253-base reader could lift later
 * but coupling now isn't worth it.
 */
export interface AssetReader {
  get(id: string): Promise<{ bytes: Uint8Array; contentType?: string } | undefined>;
}

/** Parser image element: `src` widened to `ParsedAssetRef` until resolved. */
export type ParsedImageElement = Omit<ImageElement, 'src'> & {
  src: ParsedAssetRef;
};

/** Parser video element: `src` widened to `ParsedAssetRef` until resolved. */
export type ParsedVideoElement = Omit<VideoElement, 'src'> & {
  src: ParsedAssetRef;
};

/** Parser audio element: `src` widened to `ParsedAssetRef` until resolved. */
export type ParsedAudioElement = Omit<AudioElement, 'src'> & {
  src: ParsedAssetRef;
};

export type { LossFlag, Document, TextElement };

/**
 * Result of `parseHyperframes`. The `document` carries `content.mode === 'video'`
 * always; `lossFlags` is empty on a perfectly clean Hyperframes input.
 *
 * Note: image/video/audio elements inside `document.content.tracks[*].elements[*]`
 * carry parser-side `ParsedAssetRef` `src`s where the schema would expect
 * `AssetRef`. Consumers that pass the result through `documentSchema.parse(...)`
 * MUST first run a `resolveAssets`-style pass to upload bytes and rewrite refs;
 * the unresolved-form Document is parser-internal. The `document` field is typed
 * `Document` for ergonomic public-surface ergonomics, but at the value level it
 * carries the `unresolved` shape until a resolver promotes it. Mirrors
 * `CanonicalSlideTree.slides` from `@stageflip/import-pptx`.
 */
export interface ParseHyperframesResult {
  document: Document;
  lossFlags: LossFlag[];
}

/** Output mode for `exportHyperframes`. */
export type ExportOutputMode = 'multi-file' | 'inlined';

export interface ExportHyperframesResult {
  /** Master HTML bytes (UTF-8 string). */
  masterHtml: string;
  /** Map of composition-src relative path -> composition HTML; empty in `inlined` mode. */
  compositions: Record<string, string>;
  /** Loss flags emitted during export. */
  lossFlags: LossFlag[];
}

export interface ParseHyperframesOptions {
  /**
   * Resolves a composition's `data-composition-src` (relative to the master
   * HTML) to the composition's HTML bytes. Caller wires this to whatever
   * fetcher matches its input shape (filesystem / ZIP entry / HTTP).
   */
  fetchCompositionSrc: (relPath: string) => Promise<string>;
}

export interface ExportHyperframesOptions {
  /** Optional asset reader for inlining bytes. T-247 v1 does not inline. */
  assets?: AssetReader;
  /** `'multi-file'` (default) or `'inlined'`. */
  outputMode?: ExportOutputMode;
}
