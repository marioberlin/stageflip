// packages/import-pptx/src/types.ts
// Parser-side intermediate types. CanonicalSlideTree wraps schema-shaped slides
// with parser-only extensions so T-240 can emit a structural tree before
// T-242 / T-243 / T-245 fill in geometries / assets / rasters. See
// docs/tasks/T-240.md §"Type-layer architecture" for the staged narrowing
// contract. LossFlag matches the contract in
// skills/stageflip/concepts/loss-flags/SKILL.md.

import type {
  AssetRef,
  AudioElement,
  ChartElement,
  ClipElement,
  CodeElement,
  ElementBase,
  EmbedElement,
  ImageElement,
  ShapeElement,
  Slide,
  TableElement,
  TextElement,
  VideoElement,
} from '@stageflip/schema';

/**
 * Where an asset reference came from. Resolved variants carry a schema-typed
 * `AssetRef` (the `asset:<id>` form). Unresolved variants point back to the
 * OOXML relationship path; T-243 walks these and uploads the bytes.
 */
export type ParsedAssetRef =
  | { kind: 'resolved'; ref: AssetRef }
  | { kind: 'unresolved'; oocxmlPath: string };

/**
 * Image element coming out of the parser. Mirrors `ImageElement` from
 * `@stageflip/schema` but loosens `src` to `ParsedAssetRef` so unresolved
 * picture relationships can flow through the structural pass.
 */
export type ParsedImageElement = Omit<ImageElement, 'src'> & {
  src: ParsedAssetRef;
};

/**
 * A placeholder for shapes the structural parser cannot resolve into a
 * concrete `ShapeElement`. Carries the original PPTX preset name and (when
 * present) the raw `<a:custGeom>` payload so T-242 + T-245 can either render
 * the SVG path directly or rasterize from a thumbnail. Acceptance criterion
 * #6 in `docs/tasks/T-240.md` pins this shape.
 */
export type UnsupportedShapeElement = ElementBase & {
  type: 'unsupported-shape';
  /** PPTX preset enum name (e.g. `arrowCallout1`, `cloud`) when the source used `<a:prstGeom>`. */
  presetGeom?: string;
  /**
   * Marker indicating the source carried `<a:custGeom>`. T-240 does not
   * preserve the path payload — T-242 must re-parse it from `oocxmlPath`.
   */
  custGeom?: string;
  /** OOXML rel-path of the slide part this came from; useful for diagnostics. */
  oocxmlPath: string;
};

/**
 * Recursive group node mirroring schema's `GroupElement` but with
 * `children: ParsedElement[]` plus parser-side fields the accumulator needs.
 * `groupOrigin` and `groupExtent` capture the OOXML child-coordinate space
 * (`<a:chOff>` / `<a:chExt>`) so T-241a's `accumulateGroupTransforms` can
 * convert child positions from local to world coordinates.
 */
export type ParsedGroupElement = ElementBase & {
  type: 'group';
  children: ParsedElement[];
  clip: boolean;
  /** From `<a:chOff>`. Defaults to `{x:0, y:0}` when absent. EMU-derived px. */
  groupOrigin: { x: number; y: number };
  /** From `<a:chExt>`. Defaults to the group's own `transform.{width,height}` when absent. */
  groupExtent: { width: number; height: number };
};

/**
 * The discriminated union the parser emits per element. Most variants are
 * schema-typed; image and group are parser-typed; `unsupported-shape` is
 * parser-only. Sibling P11 tasks narrow the parser-only variants into
 * schema variants.
 */
export type ParsedElement =
  | TextElement
  | ParsedImageElement
  | VideoElement
  | AudioElement
  | ShapeElement
  | ParsedGroupElement
  | ChartElement
  | TableElement
  | ClipElement
  | EmbedElement
  | CodeElement
  | UnsupportedShapeElement;

/**
 * Slide shape mirroring `Slide` from `@stageflip/schema` but with
 * `elements: ParsedElement[]`. Background and transition are dropped at this
 * stage — themes land with T-249.
 */
export type ParsedSlide = Omit<Slide, 'elements'> & {
  elements: ParsedElement[];
};

/**
 * Stable machine-readable identifiers for every PPTX-specific lossy
 * situation. Sibling importers (T-244 Google Slides, T-247 Hyperframes HTML)
 * define their own `LF-<SRC>-*` codes locally. The `LossFlag.code` field on
 * the canonical shape (defined in `@stageflip/loss-flags`) is typed as
 * `string`; this PPTX-local union narrows it for parser-side type safety.
 */
export type LossFlagCode =
  | 'LF-PPTX-CUSTOM-GEOMETRY'
  | 'LF-PPTX-PRESET-GEOMETRY'
  | 'LF-PPTX-PRESET-ADJUSTMENT-IGNORED'
  | 'LF-PPTX-UNRESOLVED-ASSET'
  | 'LF-PPTX-MISSING-ASSET-BYTES'
  | 'LF-PPTX-UNSUPPORTED-ELEMENT'
  | 'LF-PPTX-UNSUPPORTED-FILL'
  | 'LF-PPTX-NOTES-DROPPED';

/**
 * Re-exports of the canonical `LossFlag` shape and its severity / category
 * vocabulary. The types live in `@stageflip/loss-flags` (T-247-loss-flags) so
 * the editor reporter UI (T-248) and sibling importers (T-244 Google Slides,
 * T-247 Hyperframes HTML) can share one shape without depending on this
 * importer. Re-exported here under the same names for backward compatibility
 * with existing `@stageflip/import-pptx` consumers. Also imported below for
 * use in `CanonicalSlideTree.lossFlags`.
 */
import type { LossFlag } from '@stageflip/loss-flags';

export type {
  LossFlag,
  LossFlagCategory,
  LossFlagSeverity,
  LossFlagSource,
} from '@stageflip/loss-flags';

/**
 * Parser output. Slides, layouts, and masters are kept separate so T-249
 * (theme learning) can later collapse master/layout inheritance. `lossFlags`
 * collects every diagnostic the parser raised.
 *
 * `transformsAccumulated` is the marker T-241a's `accumulateGroupTransforms`
 * sets on its output. It is read on subsequent calls to short-circuit (the
 * accumulator is idempotent — re-running on accumulated input must be a
 * no-op).
 */
export interface CanonicalSlideTree {
  slides: ParsedSlide[];
  layouts: Record<string, ParsedSlide>;
  masters: Record<string, ParsedSlide>;
  lossFlags: LossFlag[];
  transformsAccumulated?: boolean;
  /**
   * Set by T-243's `resolveAssets` after every `ParsedAssetRef.unresolved`
   * has been uploaded and rewritten. Re-running `resolveAssets` on a tree
   * with this flag set is a no-op (idempotent).
   */
  assetsResolved?: boolean;
}

/** Codes carried by `PptxParseError`. Stable surface for callers. */
export type PptxParseErrorCode =
  | 'INVALID_ZIP'
  | 'INVALID_XML'
  | 'MISSING_PART'
  | 'UNSUPPORTED_VERSION';

/**
 * Typed parser error. Always carries a `code` so callers can branch without
 * string-matching the message. `oocxmlPath` is the OPC part path the failure
 * was located at, when meaningful.
 */
export class PptxParseError extends Error {
  override readonly name = 'PptxParseError';
  readonly code: PptxParseErrorCode;
  readonly oocxmlPath?: string;

  constructor(code: PptxParseErrorCode, message: string, oocxmlPath?: string) {
    super(message);
    this.code = code;
    if (oocxmlPath !== undefined) this.oocxmlPath = oocxmlPath;
  }
}
