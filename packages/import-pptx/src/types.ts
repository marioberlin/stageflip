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
 * define their own `LF-<SRC>-*` codes. The `LossFlag.code` field is a
 * parser-side extension to the canonical `LossFlag` shape in
 * `skills/stageflip/concepts/loss-flags/SKILL.md` — it lets the editor and
 * the export manifest filter by stable cause without parsing `message`.
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

/** Severity bands per the loss-flags concept skill. */
export type LossFlagSeverity = 'info' | 'warn' | 'error';

/** Categories per the loss-flags concept skill. */
export type LossFlagCategory =
  | 'shape'
  | 'animation'
  | 'font'
  | 'media'
  | 'theme'
  | 'script'
  | 'other';

/**
 * Canonical loss-flag record. Shape matches
 * `skills/stageflip/concepts/loss-flags/SKILL.md`; `code` is a parser-side
 * extension. `id` is content-hash derived (sha256-12) so re-imports produce
 * stable identifiers.
 */
export interface LossFlag {
  /** sha256(source + category + location + originalSnippet).slice(0, 12). */
  id: string;
  source: 'pptx';
  code: LossFlagCode;
  severity: LossFlagSeverity;
  category: LossFlagCategory;
  location: {
    slideId?: string;
    elementId?: string;
    /** OPC part the flag was raised from. */
    oocxmlPath?: string;
  };
  message: string;
  recovery?: string;
  originalSnippet?: string;
}

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
