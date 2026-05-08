# @stageflip/import-pptx

## 0.1.0

### Minor Changes

- ea7e66a: T-240: `@stageflip/import-pptx` — ZIP + PresentationML structural parser.

  `parsePptx(buffer: Uint8Array): Promise<CanonicalSlideTree>` reads a `.pptx`
  file and emits a parser-side intermediate tree. The tree mirrors the
  canonical schema for variants the structural parser can resolve (text,
  schema-mapped preset shapes, top-level groups) and uses parser-only types
  for variants deferred to sibling P11 tasks:
  - `ParsedAssetRef` — image bytes deferred to T-243.
  - `UnsupportedShapeElement` — custom + un-mapped preset geometries deferred to T-242 / T-245.
  - Group transforms not accumulated into descendants — deferred to T-241a.

  `LossFlag` matches `skills/stageflip/concepts/loss-flags`; the parser-side
  `code` field carries the `LF-PPTX-*` enum so the editor and export manifest
  filter by stable cause.

  Public surface:

  ```ts
  import {
    parsePptx,
    PptxParseError,
    emitLossFlag,
    type CanonicalSlideTree,
    type LossFlag,
    type LossFlagCode,
    type ParsedAssetRef,
    type ParsedElement,
    type ParsedGroupElement,
    type ParsedImageElement,
    type ParsedSlide,
    type UnsupportedShapeElement,
  } from "@stageflip/import-pptx";
  ```

  Package is `private: true` for now; the publish posture lands with
  `@stageflip/import-google-slides` (T-244) where importers' distribution
  shape gets pinned.

- cefce71: T-242a: preset geometries — infra + first wave.

  Implements the geometry library spec'd in `docs/tasks/T-242.md`. Six
  representative presets across all six families (rightArrow, wedgeRectCallout,
  ribbon, parallelogram, leftBracket, cloud) plus the `<a:custGeom>` →
  SVG-path translator now produce schema-typed `'shape'` elements with
  `shape: 'custom-path'` instead of T-240's `unsupported-shape` placeholder.

  Public surface adds:
  - `geometryFor(prst, box, adjustments?)` — preset registry entry point.
  - `custGeomToSvgPath(custGeom, box?)` — OOXML path-language translator.
  - `COVERED_PRESETS` / `PRESET_GENERATORS` — introspection / coverage pin.
  - Types: `GeometryBox`, `AdjustmentMap`, `PathGenerator`.

  `LossFlagCode` adds `LF-PPTX-PRESET-ADJUSTMENT-IGNORED` (info severity)
  for the case where a preset has an `<a:avLst>` adjustment we don't honor;
  T-242a uses defaults throughout.

  Coverage of the spec's 50-preset commitment: 6 in this PR. T-242b will
  add the remaining 30 (rest of arrows, callouts, banners, basics, brackets,
  misc) plus honor `roundRect.adj1`.

  Custom-geometry parser supports `<a:moveTo>`, `<a:lnTo>`, `<a:cubicBezTo>`,
  `<a:close>`, and multi-`<a:path>` `<a:pathLst>`. `<a:arcTo>` /
  `<a:quadBezTo>` are deferred — payloads using them fall back to
  `unsupported-shape` and surface `LF-PPTX-CUSTOM-GEOMETRY`.

- fc78eac: T-242b first-wave: 10 more presets + `roundRect.adj1` honored as `cornerRadius`.

  Adds path generators for `leftArrow`, `upArrow`, `downArrow`, `trapezoid`,
  `chevron`, `rightBracket`, `leftBrace`, `rightBrace`, `sun`, `heart`. Total
  preset coverage now 16 of the spec's 50-preset commitment; T-242c lands the
  remaining 20.

  `roundRect` parsed shapes now honor the OOXML `adj1` adjustment (stored as
  a 100000ths integer per ECMA-376) and emit a structural-rect `ShapeElement`
  with the schema's existing `cornerRadius` field populated:
  `cornerRadius = (adj × min(w, h)) / 200000`.

  `<a:avLst>` adjustments that the geometry library doesn't read still produce
  the shape (using OOXML defaults) and emit one `LF-PPTX-PRESET-ADJUSTMENT-IGNORED`
  flag (info severity) per ignored adjustment. `HONORED_ADJUSTMENTS` registry
  in the geometry module tracks which adj names each preset actually consumes;
  T-242c will populate it as more adjustments land.

  New `adjusted` programmatic fixture exercises both code paths (honored
  roundRect.adj + ignored callout adjs); 84/84 tests passing (was 69; +15).

- 5a02994: T-242c batch 1: 9 more presets (arrows + callouts).

  Adds path generators for `leftRightArrow`, `upDownArrow`, `bentArrow`,
  `curvedRightArrow`, `wedgeRoundRectCallout`, `wedgeEllipseCallout`,
  `cloudCallout`, `borderCallout1`, `borderCallout2`. Total preset coverage
  now 25 of the 36 custom-path presets the parent T-242 spec commits to;
  T-242c batch 2 lands the next 8 (banners + misc), and T-242d closes out
  with the 3 arc-bearing presets (`chord`, `pie`, `donut`).

  `<a:avLst>` adjustments remain at OOXML defaults for the new generators
  (per T-242c spec); fixtures setting unhonored adjustments still emit
  `LF-PPTX-PRESET-ADJUSTMENT-IGNORED` (info severity) as before.

  `borderCallout1` / `borderCallout2` emit a two-subpath SVG `d` (rectangle
  body + leader line) — renderers that fill/stroke as one shape see the
  expected behavior; finer-grained leader styling lands once the schema
  splits leader-line styling from body styling (out of scope for T-242).

  `cloudCallout` reuses the cubic-Bezier lobed body pattern from `cloud`;
  both will be re-derived from arcs after T-242d lands `<a:arcTo>` parser
  support (handover §4 carry-forward #2).

  98/98 tests passing (was 85; +13). Coverage on `geometries/` module:
  100% lines.

- ca51076: T-242c batch 2: 8 more presets (banners + misc).

  Adds path generators for `ribbon2`, `verticalScroll`, `horizontalScroll`,
  `star10`, `star12`, `moon`, `lightningBolt`, `noSmoking`. Total preset
  coverage now 33 of the 36 custom-path presets the parent T-242 spec commits
  to; T-242d closes out with the 3 arc-bearing presets (`chord`, `pie`,
  `donut`) once `<a:arcTo>` parser support lands.

  `<a:avLst>` adjustments remain at OOXML defaults for the new generators
  (per T-242c spec); fixtures setting unhonored adjustments still emit
  `LF-PPTX-PRESET-ADJUSTMENT-IGNORED` (info severity) as before.

  `noSmoking` ships as a 3-subpath SVG `d` (outer ring + inner cutout +
  diagonal bar) under the SVG even-odd fill convention; the two circles use
  the standard 4-cubic-Bézier ellipse approximation. T-242d may re-derive
  with real arcs alongside `cloud` / `cloudCallout` once `<a:arcTo>` lands.

  The smoke test for `LF-PPTX-PRESET-GEOMETRY` in `parsePptx.test.ts` now
  pins `chord` (deferred to T-242d) instead of `lightningBolt` (now covered).

  106/106 tests passing (was 98; +8). Coverage on `geometries/` module: 100%
  lines.

- 226d85b: T-242d Sub-PR 2: `<a:custGeom>` walker now translates `<a:arcTo>` to SVG `A`
  arc segments (ECMA-376 §20.1.9.3 sign convention: positive `swAng` =
  clockwise = SVG `sweep-flag = 1` in y-down coordinates), with pen-position
  state advancing through the path. Adds the trailing 3 custom-path presets
  (`chord`, `pie`, `donut`) built on real arcs, bringing T-242 coverage to
  36/36 custom-path + 14 structural = 50/50 presets. The
  `LF-PPTX-CUSTOM-GEOMETRY` and (committed-set) `LF-PPTX-PRESET-GEOMETRY`
  loss flags are no longer emitted from the parser.
- d4d690d: T-243b: PPTX video asset extraction.

  `<p:videoFile>` shape extensions on `<p:sp>` now parse to a new
  `ParsedVideoElement` (parser-side type that mirrors schema's `VideoElement`
  but with `src: ParsedAssetRef`). The walker disambiguates in-ZIP videos
  (`r:embed` or `r:link` with `TargetMode="Internal"`) from external `r:link`
  URLs — in-ZIP videos route through `parseVideo` and drop any shape body
  (text / geometry) with an info `LF-PPTX-UNSUPPORTED-ELEMENT` flag; external
  URLs fall through to `parseShape` and emit `LF-PPTX-UNSUPPORTED-ELEMENT`
  with `originalSnippet: 'external video URL'` (until a future task adds
  `LF-PPTX-LINKED-VIDEO`).

  `resolveAssets` extends with a `'video'` branch that mirrors the existing
  image branch: dedup by sha256, upload through the abstract `AssetStorage`,
  rewrite refs to schema-typed `asset:<id>`, drop `LF-PPTX-UNRESOLVED-VIDEO`
  flags, and reuse `LF-PPTX-MISSING-ASSET-BYTES` for absent video bytes.

  Public surface adds `ParsedVideoElement`. `LossFlagCode` gains
  `LF-PPTX-UNRESOLVED-VIDEO`. `inferContentType` extends with the six
  standard video MIMEs (`.mp4` / `.m4v` / `.mov` / `.webm` / `.avi` /
  `.wmv`). `OpcRel` gains an optional `targetMode: 'Internal' | 'External'`.

  No schema changes (`VideoElement` is already a stable shape). Audio and
  embedded-font extraction remain follow-up tasks.

- 46a4a3a: T-243c: PPTX embedded font asset extraction.

  `<p:embeddedFontLst>` in `ppt/presentation.xml` now parses to a
  deck-level `CanonicalSlideTree.embeddedFonts: ParsedEmbeddedFont[]`
  collection. Each `<p:embeddedFont>` becomes one record carrying a
  `family` (from `<p:font typeface="…">`), an optional opaque `panose`,
  and up to four typeface-variant face refs (`regular` / `bold` /
  `italic` / `boldItalic`). Faces start as `ParsedAssetRef.unresolved`
  pointing at the in-ZIP byte path; faces whose relId does not resolve
  in `presentation.xml.rels` (or whose rel carries
  `TargetMode="External"`) are dropped at parse time so resolveAssets
  sees only well-formed in-package refs.

  `resolveAssets` extends with a deck-level font branch that mirrors
  the existing image / video branches: dedup by sha256 across image,
  video, and font bytes; upload through the abstract `AssetStorage`;
  rewrite each face ref to schema-typed `asset:<id>`; drop a family's
  `LF-PPTX-UNRESOLVED-FONT` flag once every populated face resolves.
  Idempotent via the existing `assetsResolved` marker.

  Public surface adds `ParsedEmbeddedFont`, the `embeddedFonts?` field
  on `CanonicalSlideTree`, and the `readEmbeddedFonts` parser entry
  point. `LossFlagCode` gains `LF-PPTX-UNRESOLVED-FONT`
  (severity `info`, category `font`). `inferContentType` extends with
  five font MIMEs (`.ttf` → `font/ttf`, `.otf` → `font/otf`, `.eot` →
  `application/vnd.ms-fontobject`, `.woff` → `font/woff`, `.woff2` →
  `font/woff2`).

  Schema integration (binding `Document.embeddedFonts` to the canonical
  schema and wiring text elements' `fontFamily` to resolved font assets)
  is a follow-up after T-251.

### Patch Changes

- eeee940: Drop the flaky `fixtures.test.ts > "all five fixture builders are stable across two builds"` assertion. `fflate.zipSync` embeds 2-second-resolution mtimes, so two consecutive `build()` calls only produce byte-identical output when they land in the same 2-second window. The functional determinism contract (parser output + loss-flag ids stable across re-imports) is pinned by `parsePptx.test.ts` and is what actually matters for downstream consumers.
- acbc394: `<a:custGeom>` parser now translates `<a:quadBezTo>` (quadratic Béziers) into
  SVG `Q` commands. `<a:custGeom>` payloads using only the supported subset
  (`<a:moveTo>`, `<a:lnTo>`, `<a:cubicBezTo>`, `<a:quadBezTo>`, `<a:close>`,
  multi-`<a:path>`) round-trip without emitting `LF-PPTX-CUSTOM-GEOMETRY`.

  `<a:arcTo>` remains the only unsupported command. Its SVG translation needs
  the current pen position from the previous command, which the walk-by-kind
  traversal can't reliably provide; lifting that needs a workspace-wide
  `preserveOrder: true` switch in the shared XML parser. Tracked as a future
  follow-up.

- e2f5e55: T-241a: nested group transform accumulator.

  `parsePptx` now runs `accumulateGroupTransforms` as a post-walk pass before
  returning. Group transforms — including `<a:chOff>` / `<a:chExt>` child-coord
  scaling and rotation around the group's center — are folded into descendant
  transforms so leaf children carry world-space coordinates.

  `ParsedGroupElement` gains parser-side fields `groupOrigin` and `groupExtent`
  capturing the OOXML child-coordinate space. `CanonicalSlideTree` gains a
  `transformsAccumulated?: boolean` marker — the accumulator is idempotent
  (re-running on accumulated input is a no-op).

  Public surface adds `accumulateGroupTransforms`. Removes the
  `LF-PPTX-NESTED-GROUP-TRANSFORM` variant from `LossFlagCode` since the
  placeholder flag is no longer emitted.

  Note for downstream callers: this is an enum-shape break (a `LossFlagCode`
  literal disappears), but `@stageflip/import-pptx` is `private: true` and has
  no external consumers; bump kept at `patch` per workspace convention.

- 29701d5: T-242d Sub-PR 1: switch the shared XML parser to `preserveOrder: true` and
  cascade the callsite updates. Internal refactor only — every existing test
  passes byte-identical (no behavioral change). Adds `firstChild`, `children`,
  `attrs`, `attr`, `allChildren`, `tagOf` helpers in `opc.ts` for the new
  node shape; element converters consume them via the `elements/shared.ts`
  re-export. Sub-PR 2 will land `<a:arcTo>` cust-geom support and
  `chord` / `pie` / `donut` preset generators on top.
- 84c917a: T-243: image asset extraction.

  `resolveAssets(tree, entries, storage): Promise<CanonicalSlideTree>` walks the
  parser-side tree, hashes each `ParsedAssetRef.unresolved` payload via sha256,
  uploads through an abstract `AssetStorage` interface, and rewrites refs to the
  schema-typed `asset:<id>` form. Dedup is by content-hash; identical bytes
  across multiple slides upload once. Broken rels (path absent from the ZIP)
  emit a new `LF-PPTX-MISSING-ASSET-BYTES` flag (`error` severity) and leave
  the ref unresolved. Idempotent via `tree.assetsResolved`.

  Public surface adds `resolveAssets`, `AssetStorage`, `AssetResolutionError`,
  `inferContentType`, and promotes the previously internal `unpackPptx` /
  `ZipEntries`. `LossFlagCode` gains `LF-PPTX-MISSING-ASSET-BYTES`.

  Scope is images only; videos and fonts are explicit follow-ups (T-243b,
  T-243c) since T-240 doesn't yet surface them. The concrete Firebase Storage
  adapter is a separate small follow-up (`T-243-storage-adapter`) that wraps
  the abstract interface around T-230's primitives.

- 3280984: Extract `LossFlag` from `@stageflip/import-pptx` into a new
  `@stageflip/loss-flags` package (T-247-loss-flags).

  **New package `@stageflip/loss-flags`**:
  - `LossFlag` interface — canonical record shape per
    `skills/stageflip/concepts/loss-flags/SKILL.md`. `code` and `source`
    typed as `string` so each importer extends with its own
    `LF-<SRC>-*` enum locally; new importers never touch this package.
  - `LossFlagSeverity` (`'info' | 'warn' | 'error'`) and `LossFlagCategory`
    (`'shape' | 'animation' | 'font' | 'media' | 'theme' | 'script' |
'other'`) — closed unions per the concept skill.
  - `LossFlagSource` — `string` alias documenting the per-importer source
    identifier convention.
  - `emitLossFlag(input)` — pure deterministic-id emitter. Hashes
    `source + code + slideId + elementId + oocxmlPath + originalSnippet`
    with sha256 (12-hex slice). Same input → same id across runs.
  - `EmitLossFlagInput` — input shape for the generic emitter.

  **Why**: T-248 (loss-flag reporter UI) and sibling importers (T-244
  Google Slides, T-247 Hyperframes HTML) need to share one shape /
  vocabulary / id-hashing scheme without depending on
  `@stageflip/import-pptx`. Editor-shell depending on importers is the
  wrong direction.

  **`@stageflip/import-pptx` changes** (zero behaviour change):
  - `LossFlag`, `LossFlagSeverity`, `LossFlagCategory`, `LossFlagSource`
    re-exported from `@stageflip/loss-flags` under the same names —
    every existing consumer import continues to compile and link.
  - `LossFlagCode` stays PPTX-local (PPTX-specific union).
  - `emitLossFlag` is now a thin wrapper: looks up the per-code default
    severity / category, auto-fills `source: 'pptx'`, and delegates to
    `@stageflip/loss-flags`'s generic `emitLossFlag`. Byte-identical
    output to the pre-extraction implementation (8 fixtures pinned).

- Updated dependencies [3280984]
- Updated dependencies [2f0ae52]
- Updated dependencies [6cfbb4c]
- Updated dependencies [6474d98]
- Updated dependencies [a36fcbe]
- Updated dependencies [8ddef40]
- Updated dependencies [e054d6d]
- Updated dependencies [4fe6fda]
- Updated dependencies [12a98d3]
- Updated dependencies [ca945df]
- Updated dependencies [5af6789]
- Updated dependencies [22d44d6]
- Updated dependencies [b6d2229]
- Updated dependencies [a4bb803]
- Updated dependencies [bbcbd38]
- Updated dependencies [d393eff]
- Updated dependencies [3112c98]
- Updated dependencies [e422e50]
- Updated dependencies [7c0165c]
- Updated dependencies [732f6c7]
- Updated dependencies [36d0c5d]
- Updated dependencies [38e4017]
  - @stageflip/loss-flags@0.1.0
  - @stageflip/schema@0.1.0
