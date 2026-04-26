---
title: Workflow — Export PPTX
id: skills/stageflip/workflows/export-pptx
tier: workflow
status: substantive
last_updated: 2026-04-26
owner_task: T-253
related:
  - skills/stageflip/workflows/import-pptx
  - skills/stageflip/concepts/loss-flags
  - skills/stageflip/reference/export-pptx
---

# Workflow — Export PPTX

T-253-base ships `@stageflip/export-pptx`'s foundational writer: the inverse
of `@stageflip/import-pptx`. Takes a fully-materialized `Document` (post-
`applyInheritance` and post-`resolveAssets`), plus an `AssetReader`, and
returns ZIP bytes of a valid `.pptx` file.

```ts
exportPptx(doc: Document, opts?: ExportPptxOptions): Promise<ExportPptxResult>
```

## Architecture

The writer flows top-down:

1. **Asset collection** (`assets/collect.ts`) walks every slide and group,
   collects distinct image AssetRef ids, and fetches bytes once per id via
   `AssetReader.get(id)`. Missing or unknown-content-type assets surface as
   `LF-PPTX-EXPORT-ASSET-MISSING`; the corresponding image element is
   dropped.
2. **Per-slide emit** (`parts/slide.ts`) dispatches each `Slide.elements`
   entry to a per-type emitter (`elements/{text,image,shape,group}.ts`).
   Group children recurse through the same dispatcher. The slide writer
   registers per-slide image rels via `SlideEmitContext.registerImageRel`.
3. **Standard parts** (`parts/{content-types,root-rels,presentation,
   theme,doc-props}.ts`) emit `[Content_Types].xml`, `_rels/.rels`,
   `ppt/presentation.xml` + its rels, a hard-coded minimal `theme1.xml`
   (Office 2007 default), and `docProps/{app,core}.xml`.
4. **ZIP packing** (`zip/pack.ts`) sorts entries alphabetically by archive
   path and packs them via `fflate.zipSync` with `level: 6` and per-entry
   `mtime` set uniformly to `opts.modifiedAt` (or the frozen-epoch
   fallback). Sorting + uniform mtime + pinned compression level give
   byte-determinism.

## ZIP layout

```
[Content_Types].xml                              # MIME map
_rels/.rels                                      # root rels → ppt/presentation.xml
ppt/
  presentation.xml                               # <p:presentation>: slide list, sizes
  _rels/presentation.xml.rels                    # → slides + theme
  slides/
    slide1.xml                                   # one per Slide in document order
    slide1.xml.rels                              # → image media (if any)
    ...
  theme/theme1.xml                               # minimal Office default
  media/
    image1.png ...                               # one per resolved AssetRef
docProps/{app,core}.xml                          # creator, last-modified
```

T-253-rider adds `ppt/slideLayouts/` and `ppt/slideMasters/` plus
`<p:sldMasterIdLst>` content in `presentation.xml`. T-253-base does NOT
emit those.

## Element dispatch

| Element type | Output | Notes |
|---|---|---|
| `text` | `<p:sp>` + `<p:txBody>` | per-paragraph + per-run XML; `<a:rPr b="1"/>` for weight ≥ 600, `i="1"` italic, `u="sng"` underline |
| `image` | `<p:pic>` + `<a:blip r:embed="rIdN"/>` | bytes go to `ppt/media/imageN.<ext>`; rel emitted in slide rels |
| `shape` (preset) | `<p:sp>` + `<a:prstGeom prst="..."/>` | schema → preset table is the inverse of importer's `PRESET_TO_SCHEMA` |
| `shape` (custom-path) | `<p:sp>` + `<a:prstGeom prst="rect"/>` | falls back; emits `LF-PPTX-EXPORT-CUSTOM-GEOMETRY-DEGRADED` |
| `group` | `<p:grpSp>` | children recurse; `chOff`/`chExt` set to identity (writer pre-flattens) |
| `table`/`video`/`audio`/`chart`/`embed`/`code`/`clip` | dropped | `LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT` per skipped element |

## Loss flags

Six codes, all `source: 'pptx-export'`:

| Code | Severity | Category | Emitted when |
|---|---|---|---|
| `LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT` | warn | other | Element type not yet supported |
| `LF-PPTX-EXPORT-ASSET-MISSING` | error | media | `AssetReader.get` returned `undefined` or unknown content type |
| `LF-PPTX-EXPORT-CUSTOM-GEOMETRY-DEGRADED` | warn | shape | `'custom-path'` shape fell back to bounding rect |
| `LF-PPTX-EXPORT-ANIMATIONS-DROPPED` | info | animation | One per slide whose elements (or descendants) carry animations |
| `LF-PPTX-EXPORT-NOTES-DROPPED` | info | other | One per slide with non-empty `notes` |
| `LF-PPTX-EXPORT-THEME-FLATTENED` | info | theme | Once per export when `Document.theme` is non-default |

## Determinism

The package is **not** in CLAUDE.md §3's determinism-restricted scope, but
the round-trip suite depends on byte-identity. Source-level rule (AC #28):
the writer code does not call `Date.now()`, `Math.random()`,
`performance.now()`, or `new Date(...)` (except the frozen-epoch literal in
`types.ts`'s `FROZEN_EPOCH`). Pinned by `exportPptx.test.ts`'s grep test.

## What's not in the base writer

T-253-rider activates:
- `<p:sldLayout>` + `<p:sldMaster>` parts
- per-element `<p:ph idx="N"/>` references via `inheritsFrom`

Future riders:
- T-253-tables: `<a:tbl>` write-back
- T-253-videos: `<p:videoFile>` write-back
- T-253-fonts: `<p:embeddedFontLst>` write-back
- T-253-theme: real `theme1.xml` from `Document.theme`
- Custom geometry write-back (`<a:custGeom>`)
- Animations + transitions (`<p:timing>`)
- Speaker-notes write-back (`notesSlide`)

See `docs/tasks/T-253-base.md` §"Out of scope" for the full list.
