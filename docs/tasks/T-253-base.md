---
title: T-253-base — @stageflip/export-pptx — foundational PPTX writer
id: docs/tasks/T-253-base
phase: 11
size: M
owner_role: implementer
status: draft
last_updated: 2026-04-26
---

# T-253-base — `@stageflip/export-pptx` — foundational PPTX writer

**Branch**: `task/T-253-base-export-pptx`

## Goal

Convert the `@stageflip/export-pptx` stub (a single `export {}` file at `packages/export-pptx/src/index.ts`) into the foundational PPTX writer. The package's plan-row text (v1.24, `docs/implementation-plan.md:542`) assumes "the existing exporter" exists — it does not. T-253-base ships the foundation so that **T-253-rider** (the placeholder-inheritance write-back originally framed as the whole T-253) can land cleanly on top.

The writer is the inverse of `@stageflip/import-pptx` (`parsePptx → CanonicalSlideTree`):

```
exportPptx(doc: Document, storage: AssetReader): Promise<Uint8Array>
```

Takes a fully-materialized `Document` (post-`applyInheritance` and post-`resolveAssets` from the import side, or an editor-authored document with no `inheritsFrom` references) plus an `AssetReader` that resolves `AssetRef` → bytes, and returns the ZIP bytes of a valid PPTX file.

**T-253-base ships the foundation only**: `presentation.xml`, slide parts, content-types, rels, theme stub, media embedding for image assets, and round-trip support for the four most common element types (text, image, shape with preset geometry, group). Tables, videos, embedded fonts, layouts, and masters are deferred to follow-on riders (T-253-rider for layouts/masters; future riders for tables/videos/fonts as the matching importer-side gap closes).

## Dependencies

- T-251 merged (#196). `Document.layouts` / `Document.masters` / `Slide.layoutId` / `ElementBase.inheritsFrom` are present in the schema. T-253-base reads but does NOT write these — they pass through unchanged when present and are ignored by the writer; T-253-rider activates the write path.
- T-243a + T-243-storage-adapter merged (#172, #173). The `AssetStorage` interface from `@stageflip/import-pptx` provides image bytes. T-253-base consumes a narrowed `AssetReader` interface (read-only `.get(id)` rather than the full `.put(...)` surface) — see §"Public surface".
- T-243b merged (#201). `<p:videoFile>` parsing on the import side; not used by T-253-base (videos deferred), but listed because the LossFlagCode union the importer extended is what T-253-base extends in turn.
- T-243c merged (#202). Same — embedded fonts deferred to a later rider; LossFlagCode union extended.
- T-247-loss-flags merged. `LossFlag` + `LossFlagSource` (open `string`) live in `@stageflip/loss-flags`; the export package wraps `emitLossFlag` with `source: 'pptx-export'`.
- T-248 merged. The reporter UI consumes `source` + `code` as opaque strings; new `LF-PPTX-EXPORT-*` codes flow through with no consumer changes.

**Does NOT depend on**: T-244 (Google Slides import), T-245 (rasterization primitive), T-246 (AI-QC loop), T-252 (`export-google-slides`), T-247 (`import-hyperframes-html`).

**Blocks**: **T-253-rider** (placeholder-inheritance write-back). T-253-rider is a small follow-on that adds `<p:sldLayout>` / `<p:sldMaster>` parts + `<p:ph>` per-element references on top of the base writer.

## Out of scope

| Item | Why deferred |
|---|---|
| `<p:sldLayout>` / `<p:sldMaster>` parts | T-253-rider. Base writer flattens placeholder inheritance: every slide element ships fully materialized geometry. `Document.layouts` / `Document.masters` pass through as ignored input. |
| `inheritsFrom` write-back | T-253-rider. Base writer drops `inheritsFrom` from per-element output (the materialized geometry is already in the slide; the inheritance pointer is redundant). |
| `<a:tbl>` table emission | A future T-253-tables rider. Base writer emits `LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT` for `TableElement` and skips. |
| `<p:videoFile>` emission + media-rel for video | A future T-253-videos rider. Base writer emits `LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT` for `VideoElement` and skips. |
| `<p:embeddedFontLst>` write-back | A future T-253-fonts rider. Base writer drops `Document` font-asset references (if any). |
| `<a:custGeom>` emission | Future task. Base writer falls back to a bounding `<a:prstGeom prst="rect">` and emits `LF-PPTX-EXPORT-CUSTOM-GEOMETRY-DEGRADED`. |
| Animations (`<p:timing>`, `<p:cTn>`, etc.) | Future task. Base writer drops `ElementBase.animations` and emits one `LF-PPTX-EXPORT-ANIMATIONS-DROPPED` per slide that had any. |
| Slide transitions | Same as animations. |
| Speaker notes write-back (`notesSlide`) | Future task. `Slide.notes` are dropped with `LF-PPTX-EXPORT-NOTES-DROPPED`. |
| Theme write-back | Base ships a minimal hard-coded `theme1.xml` (Office 2007 default theme verbatim). `Document.theme` does NOT round-trip through the base writer — the materialized resolved color/font values land on each element directly. A future rider can write a real `theme1.xml` and round-trip the theme. Emit `LF-PPTX-EXPORT-THEME-FLATTENED` once per export. |
| Cross-package gate (`pnpm parity`) | Parity is configured for the renderer fixtures, not for round-trip. T-253-base introduces a separate `pnpm test` round-trip suite; parity gate untouched. |

## Architectural decisions

### 1. Public surface

```ts
// packages/export-pptx/src/index.ts
import type { Document } from '@stageflip/schema';
import type { AssetReader } from './assets/types.js';
import type { LossFlag } from '@stageflip/loss-flags';

export interface ExportPptxResult {
  /** ZIP bytes of the PPTX file. */
  bytes: Uint8Array;
  /** Loss flags emitted during export. Empty on a perfect round-trip. */
  lossFlags: LossFlag[];
}

export interface ExportPptxOptions {
  /** Provides bytes for AssetRef inputs. Required when the document has any image element. */
  assets?: AssetReader;
  /** Override the embedded creator string. Default: 'StageFlip'. */
  creator?: string;
  /** Stable timestamp for ZIP entries (overrides `new Date()` inside the writer). Required for deterministic output. */
  modifiedAt?: Date;
}

export function exportPptx(doc: Document, opts?: ExportPptxOptions): Promise<ExportPptxResult>;

export type { AssetReader, ExportPptxResult, ExportPptxOptions };
export type { ExportPptxLossFlagCode } from './types.js';
```

```ts
// packages/export-pptx/src/assets/types.ts
export interface AssetReader {
  /** Resolves an asset id (the `<id>` of `asset:<id>`) to bytes + content type. */
  get(id: string): Promise<{ bytes: Uint8Array; contentType: string } | undefined>;
}
```

The narrow `AssetReader` interface lets unit tests use an in-memory map; production callers wrap their `@stageflip/storage-firebase` adapter to implement `AssetReader`.

### 2. Determinism

The writer is **deterministic**: same input + same `modifiedAt` produces byte-identical ZIP output. Three sources of non-determinism to control:

- **ZIP entry order**: emit entries in a fixed sorted order (alphabetic by archive path). Pin via test that exports the same doc twice and `Buffer.equals` the results.
- **ZIP timestamps**: every entry gets `opts.modifiedAt`; required when caller wants byte-determinism. Default to a frozen Unix epoch (`new Date('2024-01-01T00:00:00Z')`) when `modifiedAt` is omitted, NOT `new Date()` — the writer code is in `packages/export-pptx/src/**` and is **not** in CLAUDE.md §3's determinism-restricted scope (which covers only `frame-runtime`, `runtimes/**/clips`, `renderer-core/clips`), but round-trip tests still depend on byte-identity, so the rule is enforced at the source level.
- **XML serialization order**: every emitted XML element's attribute order and child order is fixed by the writer's emit functions, not by `Object.keys` iteration. Pin via test.

### 3. ZIP layout

Standard OOXML PPTX skeleton:

```
[Content_Types].xml                              # MIME map for every part below
_rels/.rels                                      # root-level rels — points at ppt/presentation.xml
ppt/
  presentation.xml                               # <p:presentation> — slide list, slide-master ref, sizes
  _rels/presentation.xml.rels                    # rels — to slides + theme + (in T-253-rider) slideMasters
  slides/
    slide1.xml                                   # one per Slide in document order
    slide1.xml.rels                              # rels to image media + (in T-253-rider) layouts
    slide2.xml ...
  slideLayouts/                                  # T-253-rider only
    slideLayout1.xml ...
  slideMasters/                                  # T-253-rider only
    slideMaster1.xml ...
  theme/
    theme1.xml                                   # T-253-base ships a minimal default
  media/
    image1.png                                   # one per resolved AssetRef
    image2.jpeg ...
docProps/
  app.xml                                        # minimal app metadata (creator, etc.)
  core.xml                                       # minimal core metadata (title, modified)
```

T-253-base writes everything in this list except the `slideLayouts/` and `slideMasters/` directories (T-253-rider).

### 4. Element-level emission

For each `Slide.elements` entry, the writer dispatches by element type:

- **`TextElement`** → `<p:sp>` with `<p:nvSpPr>` + `<p:spPr>` (geometry) + `<p:txBody>` (per-paragraph + per-run XML). Text runs emit `<a:rPr>` carrying the run's resolved color / font / size / weight / italic / underline.
- **`ImageElement`** → `<p:pic>` with `<p:blipFill>` carrying an `<a:blip r:embed="rIdN"/>` reference. The image bytes are added to `ppt/media/imageN.<ext>` and a slide-rel entry is emitted. Content-type detection mirrors `@stageflip/import-pptx/src/assets/content-type.ts`'s reverse mapping (mime → extension).
- **`ShapeElement` with preset geometry** → `<p:sp>` with `<a:prstGeom prst="<presetName>"/>` + `<p:spPr>` (geometry, fill, line). Adjustment values for parametric presets emit as `<a:avLst><a:gd .../></a:avLst>` if the schema's `ShapeElement.shapeAdjustments` is populated.
- **`ShapeElement` with custom geometry** → falls back to `<a:prstGeom prst="rect"/>` (bounding rect) + `LF-PPTX-EXPORT-CUSTOM-GEOMETRY-DEGRADED`. (Real `<a:custGeom>` write-back is a future rider.)
- **`GroupElement`** → `<p:grpSp>` with `<p:grpSpPr>` (group transform, chOff/chExt set to identity since the writer pre-flattens nested transforms — same as `@stageflip/import-pptx`'s post-`accumulateGroupTransforms` shape, so no-op composition is the inverse). Children recurse.
- **All other element types** (`TableElement`, `VideoElement`, `AudioElement`, `ChartElement`, `EmbedElement`, `CodeElement`, `ClipElement`) → emit `LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT` and skip the element.

### 5. Loss flags taxonomy

Six new codes, all with `source: 'pptx-export'`:

| Code | Severity | Category | Emitted when |
|---|---|---|---|
| `LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT` | `warn` | `other` | An element type isn't implemented yet (table / video / audio / chart / embed / code / clip). Skipped. |
| `LF-PPTX-EXPORT-ASSET-MISSING` | `error` | `media` | An `AssetRef` was supplied but `AssetReader.get(id)` returned `undefined`. The image element is dropped with this flag. |
| `LF-PPTX-EXPORT-CUSTOM-GEOMETRY-DEGRADED` | `warn` | `shape` | A `ShapeElement` carried custom geometry; the writer fell back to a bounding rect. |
| `LF-PPTX-EXPORT-ANIMATIONS-DROPPED` | `info` | `animation` | One per slide that had any `ElementBase.animations`. |
| `LF-PPTX-EXPORT-NOTES-DROPPED` | `info` | `other` | One per slide that had non-empty `Slide.notes`. |
| `LF-PPTX-EXPORT-THEME-FLATTENED` | `info` | `theme` | Always emitted exactly once when `Document.theme` was non-default (the writer flattens to per-element resolved values). Suppressed when `Document.theme` is the schema's default. |

### 6. Round-trip guarantee + parity test

T-253-base ships a `roundtrip.test.ts` suite that, for every fixture in `packages/import-pptx/src/fixtures/`, exports the parsed `Document` (post `parsePptx → applyInheritance → resolveAssets` per the documented full pipeline), re-parses the exported bytes through `parsePptx`, and asserts the second-pass `CanonicalSlideTree` is structurally equal to the first-pass tree (modulo loss flags expected for unsupported types).

This is a strong contract: a fixture that round-trips clean today must continue to round-trip clean as the writer evolves. Adding a new element-type writer (e.g., T-253-tables-rider) is gated on extending the round-trip suite; the suite itself is part of T-253-base.

### 7. AssetReader injection vs. AssetStorage reuse

The importer's `AssetStorage` interface is read-write (`.put(...)` returns an id). The exporter only reads. The narrower `AssetReader` interface lets:

- Unit tests pass a `Map<string, { bytes, contentType }>` without faking the upload path.
- Production callers thinly wrap their `@stageflip/storage-firebase` adapter (which already exposes a read primitive used by the renderer's CDP host).

The `AssetReader` interface does NOT live in `@stageflip/import-pptx` (different role, different package). It lives in `@stageflip/export-pptx/src/assets/types.ts`. A future refactor could lift both `AssetReader` + `AssetStorage` into `@stageflip/storage` (a new shared package); not in scope here.

### 8. XML emission

A small library-free emitter lives in `packages/export-pptx/src/xml/emit.ts`:

```ts
export function emitElement(name: string, attrs: Record<string, string | number>, children: string[]): string;
export function emitSelfClosing(name: string, attrs: Record<string, string | number>): string;
export function escapeAttr(value: string): string;
export function escapeText(value: string): string;
```

Reasons for the bespoke emitter:

- **Determinism**: attribute order is the order passed in, not `Object.keys`-induced.
- **Smaller surface**: a real XML lib (`fast-xml-parser`'s emit side, `xmlbuilder2`) would add ~100 KB and bring its own attribute-ordering quirks.
- **Schema-mismatched namespaces are rare**: the OOXML namespace prefixes are always `p:` / `a:` / `r:` / fixed; the emitter doesn't need a registry.
- **License**: stays inside the existing whitelist with no new deps.

The emitter handles the four standard XML escapes (`&` `<` `>` `"`); not full Unicode normalization (PPTX consumers handle UTF-8 raw).

### 9. ZIP emission

JSZip is the industry-standard option but the project doesn't currently depend on it. **Decision**: add `fflate` (MIT, already on the whitelist via `@stageflip/import-pptx` which uses it). `fflate` is ~13 KB, supports deterministic output via `mtime` config, and is faster than JSZip. Pin the workspace dep in this PR; cross-check `pnpm check-licenses` is green.

The writer drives `fflate` synchronously: build the entry list as `Record<string, Uint8Array>`, then `zipSync` → `Uint8Array`. Pin via test that two consecutive exports produce byte-identical output.

### 10. Tests-first contract

Per CLAUDE.md §3, every AC gets a Vitest test failing first. The fixtures that drive `roundtrip.test.ts` are mostly the parsed-side fixtures from `@stageflip/import-pptx`'s `fixtures/`; the exporter copies in a few static `Document` JSON fixtures for the cases the importer doesn't cover (e.g., a hand-authored deck with no inheritance).

## Files to create / modify

```
packages/export-pptx/
  src/
    index.ts                                # MODIFIED — replace export {} stub with full public surface
    exportPptx.ts                           # NEW — entry point
    exportPptx.test.ts                      # NEW — top-level integration tests
    types.ts                                # NEW — ExportPptxLossFlagCode union; extends ExportPptxOptions/Result
    loss-flags.ts                           # NEW — emitLossFlag wrapper, CODE_DEFAULTS for 6 codes
    loss-flags.test.ts                      # NEW
    xml/
      emit.ts                               # NEW — small XML emitter (no deps)
      emit.test.ts                          # NEW
    zip/
      pack.ts                               # NEW — fflate wrapper with deterministic mtime + sorted entry order
      pack.test.ts                          # NEW
    parts/
      content-types.ts                      # NEW — emits [Content_Types].xml
      content-types.test.ts                 # NEW
      root-rels.ts                          # NEW — emits _rels/.rels
      presentation.ts                       # NEW — emits ppt/presentation.xml + ppt/_rels/presentation.xml.rels
      presentation.test.ts                  # NEW
      slide.ts                              # NEW — emits ppt/slides/slideN.xml + slideN.xml.rels
      slide.test.ts                         # NEW
      theme.ts                              # NEW — emits ppt/theme/theme1.xml (minimal Office default)
      theme.test.ts                         # NEW
      doc-props.ts                          # NEW — emits docProps/{app,core}.xml
      doc-props.test.ts                     # NEW
    elements/
      text.ts                               # NEW — TextElement → <p:sp> + <p:txBody>
      text.test.ts                          # NEW
      image.ts                              # NEW — ImageElement → <p:pic> + media-rel
      image.test.ts                         # NEW
      shape.ts                              # NEW — ShapeElement → <p:sp> + <a:prstGeom>
      shape.test.ts                         # NEW
      group.ts                              # NEW — GroupElement → <p:grpSp>
      group.test.ts                         # NEW
      shared.ts                             # NEW — common helpers (transform → <a:xfrm>, fill, line, etc.)
      shared.test.ts                        # NEW
    assets/
      types.ts                              # NEW — AssetReader interface
      collect.ts                            # NEW — walks Document, collects (assetId, slideId, elementId) tuples for media-rel emission
      collect.test.ts                       # NEW
    roundtrip.test.ts                       # NEW — parsePptx ∘ exportPptx round-trip suite
    fixtures/
      hand-authored-deck.json               # NEW — Document JSON for cases parser fixtures don't cover
      empty-deck.json                       # NEW
  package.json                              # MODIFIED — add fflate dep + @stageflip/loss-flags + @stageflip/schema; scripts unchanged
  vitest.config.ts                          # NEW — matches the import-pptx config

skills/stageflip/
  workflows/
    export-pptx/
      SKILL.md                              # NEW — workflow skill: writer architecture, ZIP layout, element dispatch, loss flags, determinism contract
  reference/
    export-pptx/
      SKILL.md                              # NEW — package reference: exportPptx options, AssetReader contract, ExportPptxLossFlagCode enum

.changeset/export-pptx-t253-base.md         # NEW — minor on @stageflip/export-pptx (0.0.0 → 0.1.0)
```

No changes to:
- `@stageflip/schema`, `@stageflip/rir`, `@stageflip/renderer-core` — the writer reads existing schema types.
- `@stageflip/import-pptx` — base writer reuses the `parsePptx` output shape but does not modify the importer.
- `@stageflip/loss-flags` — `source` and `code` fields are open; new codes flow through.
- `packages/engine/src/handlers/qc-export-bulk/handlers.ts` — the existing `EXPORT_PROFILES` catalog string already names `pptx`. No handler wiring in T-253-base; T-253-rider wires the `export_pptx` tool handler.

## Acceptance criteria

Each gets a Vitest test, written first and failing.

### Public surface

1. `exportPptx(doc, opts)` returns `{ bytes: Uint8Array; lossFlags: LossFlag[] }`. Pin via `expect(bytes).toBeInstanceOf(Uint8Array)` and `bytes.length > 0`.
2. `exportPptx(doc, { modifiedAt: <fixed Date>, ...})` is byte-deterministic across two consecutive calls. Pin via `Buffer.from(b1).equals(Buffer.from(b2))`.
3. `exportPptx(doc)` (no `modifiedAt`) is byte-deterministic across two consecutive calls because the default fallback is a frozen epoch, not `new Date()`. Pin via fixture.
4. The output is a valid ZIP that `fflate.unzipSync` opens. Pin via test.

### ZIP layout

5. The unzipped archive contains exactly `[Content_Types].xml`, `_rels/.rels`, `ppt/presentation.xml`, `ppt/_rels/presentation.xml.rels`, `ppt/slides/slide{N}.xml` + rels for every slide, `ppt/theme/theme1.xml`, `docProps/app.xml`, `docProps/core.xml`, plus `ppt/media/*` for each unique resolved AssetRef. Pin entry list via snapshot.
6. ZIP entries are written in sorted-by-path order. Pin via fflate inspection.
7. Every entry's `mtime` matches `opts.modifiedAt` (or the frozen epoch). Pin via test.

### `[Content_Types].xml`

8. Emits one `<Default>` per file extension present (`xml`, `rels`, `png`, `jpeg`, etc.) and one `<Override>` per part with non-default content type (e.g., `ppt/presentation.xml`). Pin against snapshot.

### `presentation.xml`

9. Emits a `<p:sldSz cx="..." cy="..."/>` matching `Document.size` (default 9144000 × 5143500 EMU for 16:9 if size is unset). Pin.
10. Emits `<p:sldIdLst>` listing every slide's rId in document order. Pin.
11. Drops `Document.layouts` / `Document.masters` references silently — base writer does NOT emit `<p:sldMasterIdLst>` content (T-253-rider). Pin: a doc with layouts populated still produces a base-writer output that round-trips lossy on the layouts but lossless on the slides.

### Slide parts

12. **TextElement** round-trips: a one-paragraph one-run text element exports to `<p:sp>` with `<p:txBody>` containing one `<a:p>` with one `<a:r>`. Re-parsing the exported XML through `@stageflip/import-pptx` yields a `ParsedTextElement` structurally equal to the input. Pin via fixture.
13. **ImageElement** round-trips: `<p:pic>` with `<a:blip r:embed="..."/>` references a slide-rel pointing at `ppt/media/imageN.png`; the bytes match the source. Pin via fixture.
14. **ShapeElement (preset)** round-trips: `<p:sp>` with `<a:prstGeom prst="ellipse"/>` re-parses to a `ParsedShapeElement` with `shape: 'ellipse'`. Pin via fixture covering 5 preset names: `rect`, `roundRect`, `ellipse`, `triangle`, `arrowRight`.
15. **ShapeElement (custom geometry)** falls back to `<a:prstGeom prst="rect"/>` and emits `LF-PPTX-EXPORT-CUSTOM-GEOMETRY-DEGRADED`. Pin via fixture.
16. **GroupElement** round-trips: `<p:grpSp>` with two children re-parses to a `ParsedGroupElement` with `children.length === 2`. Pin via fixture.
17. **TableElement / VideoElement / AudioElement / ChartElement / EmbedElement / CodeElement / ClipElement** all skip with `LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT` (one flag per skipped element). Pin via fixture covering every type.

### Asset embedding

18. The writer collects every distinct `AssetRef` across all slides, calls `assets.get(id)` once per id (dedup), and writes one `ppt/media/imageN.<ext>` per unique id. Pin via spy on `assets.get`.
19. When `assets.get(id)` returns `undefined`, the writer emits `LF-PPTX-EXPORT-ASSET-MISSING` and drops the image element. Pin via fixture.
20. Content-type → file extension mapping: `image/png` → `.png`, `image/jpeg` → `.jpeg`, `image/gif` → `.gif`, `image/webp` → `.webp`, `image/svg+xml` → `.svg`. Unknown → `.bin` + `LF-PPTX-EXPORT-ASSET-MISSING` (treated as broken). Pin all 5 mappings.

### Loss flags

21. `LF-PPTX-EXPORT-ANIMATIONS-DROPPED`: emitted exactly once per slide with non-empty `ElementBase.animations` somewhere in its element tree. Pin via fixture.
22. `LF-PPTX-EXPORT-NOTES-DROPPED`: emitted exactly once per slide with non-empty `Slide.notes`. Pin.
23. `LF-PPTX-EXPORT-THEME-FLATTENED`: emitted exactly once when `Document.theme` differs from the schema's default. Pin via fixture with a customized theme; pin negative case (default theme → no flag).
24. The wrapper auto-fills `source: 'pptx-export'`. Pin via test.
25. All six `ExportPptxLossFlagCode` variants resolve to a `CODE_DEFAULTS` entry. Pin via test that iterates the union.

### Round-trip suite

26. Every fixture in `packages/import-pptx/src/fixtures/` produces, via `parsePptx → applyInheritance → resolveAssets → exportPptx → parsePptx`, a `CanonicalSlideTree` that is structurally equal to the first-pass tree (modulo expected `LF-PPTX-EXPORT-*` loss flags for fixtures using deferred element types). Pin via the new `roundtrip.test.ts` suite.
27. The `hand-authored-deck.json` fixture (hand-authored Document with text + image + shape + group, no inheritance) round-trips with **zero** loss flags. Pin.

### Determinism

28. The writer is in `packages/export-pptx/**` which is **not** in CLAUDE.md §3's determinism-restricted scope, so `Date.now()` etc. are technically allowed. **Source-level rule**: the writer code does NOT call `Date.now()` / `new Date()` / `Math.random()` / `performance.now()`. Pin via grep test that scans the package source.

### Coverage + gates

29. Coverage on `packages/export-pptx/src/**` ≥85%; ≥90% on `exportPptx.ts` and `roundtrip.test.ts`'s drivers.
30. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check-licenses`, `pnpm check-remotion-imports`, `pnpm check-determinism`, `pnpm check-skill-drift`, `pnpm size-limit` all green.

## Public-spec / library references

- **ECMA-376** PPTX schema (Office Open XML, 5th edition):
  - §19.3 — Presentation Markup Language
  - §19.3.1.49 — `<p:sld>` (slide root element)
  - §19.3.1.34 — `<p:nvSpPr>` (non-visual shape properties)
  - §19.3.1.46 — `<p:sp>` (shape) — element used for both text and shape primitives
  - §19.3.1.37 — `<p:pic>` (picture)
  - §19.3.1.22 — `<p:grpSp>` (group shape)
  - §20.1.9 — DrawingML preset geometry (`<a:prstGeom>`)
- **OPC** packaging (ECMA-376 Part 2): `[Content_Types].xml`, `_rels/.rels`, per-part `<part>.rels` resolution rules.
- **fflate** (MIT): https://github.com/101arrowz/fflate — already used by `@stageflip/import-pptx`.
- **In-repo precedents**:
  - `packages/import-pptx/src/parsePptx.ts` — sibling parser; the writer is its inverse.
  - `packages/import-pptx/src/parts/{presentation,slide,sp-tree}.ts` — what the writer emits.
  - `packages/import-pptx/src/elements/{picture,shape,text}.ts` — element parsers; writer emits the same XML shapes.
  - `packages/import-pptx/src/assets/content-type.ts` — MIME table reused inverted (extension ← MIME).
  - `packages/import-pptx/src/zip.ts` — `unpackPptx` (fflate `unzipSync`); writer uses `zipSync` from the same package.
  - `packages/import-pptx/src/loss-flags.ts` — the wrapper pattern T-253-base mirrors with `source: 'pptx-export'`.
  - `packages/loss-flags/src/types.ts` — canonical `LossFlag` shape (open `source` and `code` strings).

## Skill updates (in same PR)

- `skills/stageflip/workflows/export-pptx/SKILL.md` (NEW) — workflow skill covering writer architecture, ZIP layout, element dispatch, loss-flag taxonomy, determinism contract. Notes that placeholder-inheritance write-back lands in T-253-rider.
- `skills/stageflip/reference/export-pptx/SKILL.md` (NEW) — package reference: `exportPptx` options, `AssetReader` contract, `ExportPptxLossFlagCode` enum.

T-250 (the sweep skill task in the plan v1.24) will further extend these; T-253-base ships the foundations.

## Quality gates (block merge)

Standard CLAUDE.md §8 set, all green:

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (≥85% coverage on changed files; ≥90% on `exportPptx.ts` per AC #29).
- `pnpm check-licenses` — only new dep is `fflate` (MIT; already on the whitelist via import-pptx). Pin in PR body.
- `pnpm check-remotion-imports` — n/a.
- `pnpm check-determinism` — package not in determinism-restricted scope; the source-level grep test (AC #28) is the equivalent in this package.
- `pnpm check-skill-drift` — two new skills.
- `pnpm size-limit` — package is new; baseline budget in this PR (suggested: 50 KB gzipped).

No parity-fixture runs (parity is renderer-side; round-trip tests live inside Vitest).

## PR template + commit

- Title: `[T-253-base] @stageflip/export-pptx — foundational PPTX writer`
- Conventional commits:
  - Commit 1: `test(export-pptx): T-253-base — failing tests + fixtures + scaffolding`
  - Commit 2: `feat(export-pptx): T-253-base — XML emitter + ZIP packer + content-types`
  - Commit 3: `feat(export-pptx): T-253-base — presentation, slide, theme, docProps parts`
  - Commit 4: `feat(export-pptx): T-253-base — element emitters (text/image/shape/group) + AssetReader`
  - Commit 5: `feat(export-pptx): T-253-base — loss flags + round-trip suite + skill stubs`
  - Optional Commit 6 for non-blocking Reviewer feedback.
- Branch: `task/T-253-base-export-pptx`
- Changesets: `.changeset/export-pptx-t253-base.md` — `minor` on `@stageflip/export-pptx` (0.0.0 → 0.1.0).

## Escalation triggers (CLAUDE.md §6)

Stop and report instead of guessing if:

- A `Document` field has a Zod default that flips between persistence and read (e.g., `[]` vs `undefined`) and round-trip equality fails because of the default-induced asymmetry. The fix is at the schema layer, not the exporter.
- The OOXML preset name list in `@stageflip/import-pptx`'s parser surfaces a preset the writer's emit table doesn't cover. Either extend the table or downgrade to `LF-PPTX-EXPORT-CUSTOM-GEOMETRY-DEGRADED`; do NOT silently emit `prst="rect"` without a flag.
- `fflate.zipSync` produces non-byte-identical output across two calls with the same inputs (e.g., compression-level non-determinism). The fix is to pin a deterministic compression level; if that doesn't work, escalate before adding a custom DEFLATE.
- Round-trip equality fails for an importer fixture where the importer itself emits a fixture-side mutation (e.g., `t-243a` post-resolveAssets adds an `assetsResolved` flag the writer can't preserve). Fix: scope the round-trip equality to canonical-element fields only, not parser-side metadata. Specify the equality predicate carefully in the test helper.
- `@stageflip/import-pptx`'s test count regresses. The base writer must NOT modify the importer; if a workspace test count drift surfaces, investigate before assuming it's benign.

## Notes for the Orchestrator

1. **M-sized; expect five commits + possible cleanup.** XML emitter + ZIP packer are mechanical; the round-trip suite is the substantive correctness contract. Reviewer should focus on AC #26 (round-trip) and AC #28 (determinism source-level rule).
2. **The plan-row faulty premise.** `docs/implementation-plan.md:542` (v1.24) says T-253 is a "rider" assuming an existing exporter. T-253-base is the foundation; T-253-rider is the original plan-row scope. The plan-row update lands in this same PR (alongside the two specs) so future readers don't re-discover the gap.
3. **`AssetReader` is narrower than `AssetStorage` deliberately.** The exporter only reads. Production callers wrap their `@stageflip/storage-firebase` adapter to implement `AssetReader`. Don't widen the interface — a future shared `@stageflip/storage` package can unify both.
4. **Deferred element types are explicit.** Tables, videos, embedded fonts each get their own follow-on rider once the importer-side gap closes. T-253-base does NOT speculate on those riders' shape; it just emits `LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT` and skips.
5. **Theme write-back is deferred.** Base ships a hard-coded Office 2007 default `theme1.xml`. `Document.theme` flattens to per-element resolved values. A future T-253-theme rider can add real theme write-back; not in scope here.
6. **Determinism is at the source level, not the CI gate.** The package isn't in `pnpm check-determinism`'s scope. AC #28 adds a source-grep test inside the package's own Vitest; that's the writer's enforcement mechanism.
7. **Dispatch convention** (this session): foreground Implementer, no `isolation: worktree`. Reviewer dispatch likewise foreground. Per `feedback_subagent_shared_worktree.md`, when a sub-agent is running git ops in the shared tree, the main thread holds off on git work.
