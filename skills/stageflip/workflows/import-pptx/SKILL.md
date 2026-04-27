---
title: Workflow — Import PPTX
id: skills/stageflip/workflows/import-pptx
tier: workflow
status: substantive
last_updated: 2026-04-27
owner_task: T-250
related:
  - skills/stageflip/concepts/loss-flags
  - skills/stageflip/concepts/schema
  - skills/stageflip/concepts/references-tier
  - skills/stageflip/concepts/design-system-learning
---

# Workflow — Import PPTX

T-240 ships the structural parser (`@stageflip/import-pptx`). Subsequent
tasks fill the rest of the import surface; sections below mark which task
owns each gap.

## Geometry coverage (T-242)

T-240 maps a curated subset of `<a:prstGeom prst="X">` values to schema's
structural `ShapeKind` (rect, ellipse, polygon, star, line). T-242 grows
coverage to additional presets via `'custom-path'` with a generated SVG `d`
attribute. T-242a–T-242d ship infra + **36 presets**:

- **Arrows**: rightArrow, leftArrow, upArrow, downArrow, leftRightArrow,
  upDownArrow, bentArrow, curvedRightArrow.
- **Callouts**: wedgeRectCallout, wedgeRoundRectCallout,
  wedgeEllipseCallout, cloudCallout, borderCallout1, borderCallout2.
- **Banners / Scrolls / High-point stars**: ribbon, ribbon2,
  verticalScroll, horizontalScroll, star10, star12.
- **Basics**: parallelogram, trapezoid, chevron, **chord**, **pie**, **donut**.
- **Brackets / Braces**: leftBracket, rightBracket, leftBrace, rightBrace.
- **Misc**: cloud, sun, heart, moon, lightningBolt, noSmoking.

T-242d closes out the parent T-242 commitment: 36/36 custom-path + 14
structural = 50/50 presets. The arc-bearing trio (`chord`, `pie`, `donut`)
ships built on real SVG `A` commands; `noSmoking` retains its earlier
cubic-Bezier ellipse approximation (replacement is non-blocking follow-up
work, paired with `cloud` / `cloudCallout` re-derivation).

`roundRect` honors its `adj1` adjustment: parsed as a 100000ths integer per
ECMA-376; the resulting corner radius lands on the schema's existing
`ShapeElement.cornerRadius` field. Other `<a:avLst>` adjustments are
currently ignored — the parser emits `LF-PPTX-PRESET-ADJUSTMENT-IGNORED`
(info severity) per ignored adjustment so the editor can surface "this
preset has tuning we didn't apply".

`<a:custGeom>` with the supported commands (`<a:moveTo>`, `<a:lnTo>`,
`<a:cubicBezTo>`, `<a:quadBezTo>`, `<a:arcTo>`, `<a:close>`,
multi-`<a:path>`) translates to SVG `d` via `custGeomToSvgPath`. T-242d
Sub-PR 2 closed out `<a:arcTo>` translation by combining the
`preserveOrder: true` parser shape (Sub-PR 1) with a pen-position-aware
walker that converts each OOXML arc to an SVG `A rx ry 0 large-arc sweep
endX endY` segment. ECMA-376 §20.1.9.3 sign convention: positive `swAng`
is clockwise → SVG `sweep-flag = 1` in y-down coordinates. The supported
command set now covers every documented `<a:custGeom>` primitive; the
`LF-PPTX-CUSTOM-GEOMETRY` flag is no longer emitted from the parser.

### Parsed XML shape

`opc.ts`'s `parseXml` runs fast-xml-parser with `preserveOrder: true`. Every
parsed node is therefore an *ordered array* of single-key element records:

```js
[
  { 'a:moveTo': [...children], ':@': { '@_x': '0', '@_y': '0' } },
  { 'a:lnTo':   [...children], ':@': { '@_x': '10', '@_y': '0' } },
  { 'a:close':  [],            ':@': {} },
]
```

Document order is preserved across heterogeneous tags — the precondition
the cust-geom path walker needs. Callers must navigate via the helpers
exported from `opc.ts` (`firstChild` / `children` / `attrs` / `attr` /
`allChildren` / `tagOf`); no production callsite indexes into the raw
`:@` / array shape directly. The `elements/shared.ts` re-export bundles
the same helpers plus `attrNumber` / `textContent` for element converters.

```ts
import { geometryFor, custGeomToSvgPath, COVERED_PRESETS } from '@stageflip/import-pptx';

const path = geometryFor('rightArrow', { w: 200, h: 100 });
// → 'M 0 25 L 100 25 L 100 0 L 200 50 L 100 100 L 100 75 L 0 75 Z'
```

Adjustable handles (`<a:avLst>`) honored: `roundRect.adj1` (corner radius)
in T-242b; `pie` / `chord` start-angle (`adj1`) and sweep-angle (`adj2`),
plus `donut` ring-thickness (`adj1`) in T-242d. Other adjustments emit
`LF-PPTX-PRESET-ADJUSTMENT-IGNORED` (info).

## Image / video / font asset extraction (T-243 / T-243b / T-243c)

`resolveAssets(tree, entries, storage)` is the second post-walk pass. It
visits every `ParsedAssetRef.unresolved` carried by image **and video**
elements **and the deck-level `embeddedFonts` collection**, hashes each
payload via sha256, uploads through an abstract `AssetStorage` interface
(concrete adapter wraps `@stageflip/storage-firebase`), and rewrites refs
to the schema-typed `asset:<id>` form. Dedup is by content-hash, so
identical bytes referenced from multiple slides — or shared across image,
video, and font kinds — upload once. Broken rels (path absent from the
ZIP) emit `LF-PPTX-MISSING-ASSET-BYTES` (error severity) and leave the
ref unresolved. Idempotent via `tree.assetsResolved`.

Video extraction (T-243b) lands `<p:videoFile>` parsing on the same
pipeline. A `<p:sp>` whose `<p:nvSpPr><p:nvPr>` carries a `<p:videoFile>`
child is dispatched to `parseVideo` (not `parseShape`) when the relId
resolves to in-ZIP bytes (`r:embed`, or `r:link` with `TargetMode="Internal"`).
The shape's text body and geometry are dropped on the video extension —
documented by an info `LF-PPTX-UNSUPPORTED-ELEMENT` flag with
`originalSnippet: 'shape body dropped on video extension'`. External-URL
`r:link` videos (e.g., YouTube) fall through to `parseShape` and emit a
matching `LF-PPTX-UNSUPPORTED-ELEMENT` with `originalSnippet: 'external
video URL'`; a future task introduces `LF-PPTX-LINKED-VIDEO` for the
linked-URL case.

Loss flag inventory after the resolve pass:

- `LF-PPTX-UNRESOLVED-ASSET` (cleared by T-243).
- `LF-PPTX-UNRESOLVED-VIDEO` (cleared by T-243b).
- `LF-PPTX-UNRESOLVED-FONT` (cleared by T-243c).
- `LF-PPTX-MISSING-ASSET-BYTES` (error; emitted for any unresolved-asset
  path absent from the ZIP — image, video, or font face).

Composition pattern:

```ts
import { parsePptx, resolveAssets, unpackPptx } from '@stageflip/import-pptx';
import { createFirebaseAssetStorage } from '@stageflip/storage-firebase';
import { getStorage } from 'firebase-admin/storage';

const entries = unpackPptx(buffer);
const tree = await parsePptx(buffer);
const storage = createFirebaseAssetStorage({ bucket: getStorage().bucket() });
const resolved = await resolveAssets(tree, entries, storage);
```

`createFirebaseAssetStorage` wraps a Firebase Admin Storage bucket; tests can
substitute any object satisfying the structural `BucketLike` shape. Storage
path is `pptx-imports/{contentHash[:21]}` by default (content-addressed
dedup).

Embedded font extraction (T-243c) lands `<p:embeddedFontLst>` parsing on
the same pipeline. Embedded fonts are deck-level (not per-element): the
parser reads `ppt/presentation.xml`'s `<p:embeddedFontLst>` and attaches
one `ParsedEmbeddedFont` per `<p:embeddedFont>` to
`CanonicalSlideTree.embeddedFonts`. Each font carries a `family` (from
`<p:font typeface="…">`), an opaque `panose`, and up to four typeface
variants — `regular` / `bold` / `italic` / `boldItalic` — each pointing
at an in-ZIP byte path through its `r:id`. Faces whose relId is broken
or carries `TargetMode="External"` drop at parse time. The
`resolveAssets` font branch uploads each populated face's bytes
(content-typed `font/ttf` / `font/otf` / `application/vnd.ms-fontobject`
/ `font/woff` / `font/woff2`) and rewrites face refs to schema-typed
`asset:<id>`. Schema integration (binding `Document.embeddedFonts` and
wiring text elements' `fontFamily` to resolved font assets) is a
follow-up after T-251.

## Group transform accumulation (T-241a)

`parsePptx` runs `accumulateGroupTransforms` as a post-walk pass before
returning. The pass folds each group's `<a:xfrm>` into its descendants so
leaf children carry world-space coordinates: `chOff` / `chExt` scaling,
group rotation around the group's center, and rotation summation are all
handled. The group node itself stays in the tree with its own transform
preserved so callers that want to render group bounds still can. The
result tree carries `transformsAccumulated: true`, which makes a second
call a no-op (idempotent).

## What lands in T-240

`parsePptx(buffer): Promise<CanonicalSlideTree>` consumes a `.pptx` byte
buffer and returns a parser-side intermediate tree. The tree mirrors the
canonical schema for variants the structural parser can resolve, and uses
parser-only types (`UnsupportedShapeElement`, `ParsedAssetRef`) for the rest.
`docs/tasks/T-240.md` §"Type-layer architecture" pins this contract.

Loss flags (`skills/stageflip/concepts/loss-flags`) are emitted at every
unsupported branch. The canonical `LossFlag` shape and the deterministic-id
emitter live in `@stageflip/loss-flags` (T-247-loss-flags); `@stageflip/import-pptx`
exports `emitLossFlag` as a thin PPTX-defaulted wrapper that auto-fills
`source: 'pptx'` and the per-code severity / category. The PPTX-specific
`code` enum lives in `@stageflip/import-pptx`:

- `LF-PPTX-CUSTOM-GEOMETRY` — historically emitted for `<a:custGeom>` payloads using `<a:arcTo>` / `<a:quadBezTo>`. T-242b added `<a:quadBezTo>` (PR #178) and T-242d added `<a:arcTo>` (Sub-PR 2); the parser now translates every documented command in the supported set, so this code is no longer emitted.
- `LF-PPTX-PRESET-GEOMETRY` — historically emitted for preset shapes outside the T-242 coverage set. After T-242d every committed preset is covered (50/50); the long-tail (~140 OOXML presets outside the commitment) is owned by T-245's rasterization fallback and surfaces under its own loss code.
- `LF-PPTX-PRESET-ADJUSTMENT-IGNORED` — `<a:avLst>` adjustment was present but not honored (T-242a uses defaults).
- `LF-PPTX-UNRESOLVED-ASSET` — picture bytes pending resolution by `resolveAssets` (T-243). Cleared once `resolveAssets` runs.
- `LF-PPTX-MISSING-ASSET-BYTES` — `error` severity. Picture rel pointed at a path not present in the ZIP. Stays after `resolveAssets`; surfaces an actual import problem.
- `LF-PPTX-UNSUPPORTED-ELEMENT` — connection / OLE / chart placeholders. Resolved by T-247 / T-248.
- `LF-PPTX-UNSUPPORTED-FILL` — gradients, patterns. Resolved by T-249 (theme learning).
- `LF-PPTX-NOTES-DROPPED` — speaker notes. Resolved by T-249 / T-250.

## What still needs work

| Task | Gap |
|---|---|
| T-245 | Shape rasterization fallback (crop from thumbnails) for unsupported shapes. |
| T-246 | AI-QC loop (Gemini multimodal convergence). |
| T-248 | Loss-flag reporter UI surface in `apps/stageflip-slide` ships (status-bar badge + modal); see `skills/stageflip/concepts/loss-flags/SKILL.md` §"Reporter UI (T-248)". Wiring `parsePptx` → `importLossFlagsAtom` is a follow-up task. |
| T-249 | Theme learning — fold master/layout inheritance into the schema's `theme`. |
| T-250 | This skill plus the other `import-*` skills get substantive content. |

## Loss flags

Cross-cutting taxonomy (every code by source) lives in
`skills/stageflip/concepts/loss-flags/SKILL.md` §"Taxonomy — codes by
source". The PPTX importer's per-code defaults are pinned in
`packages/import-pptx/src/loss-flags.ts` `CODE_DEFAULTS`; the deterministic
id formula (sha256-12 of source/code/location/originalSnippet, joined by
U+0001) is owned by `@stageflip/loss-flags` and shared with every other
importer + exporter.

| Code | Severity | Category | Owner |
|---|---|---|---|
| `LF-PPTX-CUSTOM-GEOMETRY` | warn | shape | T-240 (no longer emitted post-T-242b/d) |
| `LF-PPTX-PRESET-GEOMETRY` | info | shape | T-240 (no longer emitted post-T-242a–d) |
| `LF-PPTX-PRESET-ADJUSTMENT-IGNORED` | info | shape | T-242a |
| `LF-PPTX-UNRESOLVED-ASSET` | info | media | T-240 (cleared by T-243) |
| `LF-PPTX-UNRESOLVED-VIDEO` | info | media | T-243b (cleared by T-243b) |
| `LF-PPTX-UNRESOLVED-FONT` | info | font | T-243c (cleared by T-243c) |
| `LF-PPTX-MISSING-ASSET-BYTES` | error | media | T-243 / T-243b / T-243c |
| `LF-PPTX-UNSUPPORTED-ELEMENT` | warn | other | T-240 |
| `LF-PPTX-UNSUPPORTED-FILL` | info | theme | T-240 |
| `LF-PPTX-NOTES-DROPPED` | info | other | T-240 |

## References

The `references/` tier convention
(`skills/stageflip/concepts/references-tier/SKILL.md`) gives this skill a
sibling `references/` directory once it earns its place — observed
failure modes, constraint catalogues, pattern recipes. Earlier sketches:

- T-243a/b/c gotchas (asset/video/font extraction edge cases).
- `<a:custGeom>` arc-walker corner cases discovered in T-242d.

When the next Implementer hits a recurring pitfall not preempted by this
SKILL.md, add a `references/<topic>-pitfalls.md` and link it here.

## Public-spec references (no vendored code)

- https://learn.microsoft.com/en-us/openspecs/office_standards/ms-pptx/
- https://ecma-international.org/publications-and-standards/standards/ecma-376/
- OOXML drawing primitives: `<a:off>`, `<a:ext>`, `<a:xfrm>`, `<a:prstGeom>`, `<a:custGeom>`.

## Determinism

The parser is pure: no `Date`, no `Math.random`, no I/O after the buffer is
read. Loss-flag ids are sha256(source + code + location + originalSnippet)
content-derived, so re-imports produce stable identifiers per the
`loss-flags` concept.

## Related

- `skills/stageflip/concepts/loss-flags/SKILL.md` — flag contract.
- `docs/tasks/T-240.md` — task spec + type-layer clarification.
- `packages/import-pptx/src/index.ts` — public API.
