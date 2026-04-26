---
title: Workflow — Import PPTX
id: skills/stageflip/workflows/import-pptx
tier: workflow
status: substantive
last_updated: 2026-05-01
owner_task: T-250
related:
  - skills/stageflip/concepts/loss-flags
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
attribute. T-242a + T-242b first-wave + T-242c batch 1 ship infra +
**25 presets**:

- **Arrows**: rightArrow, leftArrow, upArrow, downArrow, leftRightArrow,
  upDownArrow, bentArrow, curvedRightArrow.
- **Callouts**: wedgeRectCallout, wedgeRoundRectCallout,
  wedgeEllipseCallout, cloudCallout, borderCallout1, borderCallout2.
- **Banners**: ribbon.
- **Basics**: parallelogram, trapezoid, chevron.
- **Brackets / Braces**: leftBracket, rightBracket, leftBrace, rightBrace.
- **Misc**: cloud, sun, heart.

T-242c batch 2 adds 8 more (banners + misc) to reach 33; T-242d ships the
trailing 3 arc-bearing presets (`chord`, `pie`, `donut`) to close out the
spec's 50-preset commitment (50 = 14 structural + 33 custom-path + 3 arc).

`roundRect` honors its `adj1` adjustment: parsed as a 100000ths integer per
ECMA-376; the resulting corner radius lands on the schema's existing
`ShapeElement.cornerRadius` field. Other `<a:avLst>` adjustments are
currently ignored — the parser emits `LF-PPTX-PRESET-ADJUSTMENT-IGNORED`
(info severity) per ignored adjustment so the editor can surface "this
preset has tuning we didn't apply".

`<a:custGeom>` with the supported commands (`<a:moveTo>`, `<a:lnTo>`,
`<a:cubicBezTo>`, `<a:quadBezTo>`, `<a:close>`, multi-`<a:path>`) translates
to SVG `d` via `custGeomToSvgPath`. `<a:arcTo>` is the remaining unsupported
command — its SVG translation requires the current pen position, which the
walk-by-kind traversal can't reliably provide; lifting that limitation
needs a workspace-wide switch to `preserveOrder: true` in the shared XML
parser. Payloads using `<a:arcTo>` fall back to `unsupported-shape` (T-245
rasterization picks them up).

```ts
import { geometryFor, custGeomToSvgPath, COVERED_PRESETS } from '@stageflip/import-pptx';

const path = geometryFor('rightArrow', { w: 200, h: 100 });
// → 'M 0 25 L 100 25 L 100 0 L 200 50 L 100 100 L 100 75 L 0 75 Z'
```

Adjustable handles (`<a:avLst>`) honored: `roundRect.adj1` (corner radius)
in T-242b. Other adjustments emit `LF-PPTX-PRESET-ADJUSTMENT-IGNORED` (info).

## Image asset extraction (T-243)

`resolveAssets(tree, entries, storage)` is the second post-walk pass. It
visits every `ParsedAssetRef.unresolved` carried by image elements, hashes
each payload via sha256, uploads through an abstract `AssetStorage`
interface (concrete adapter wraps `@stageflip/storage-firebase`), and
rewrites refs to the schema-typed `asset:<id>` form. Dedup is by
content-hash, so identical bytes referenced from multiple slides upload
once. Broken rels (path absent from the ZIP) emit `LF-PPTX-MISSING-ASSET-BYTES`
(error severity) and leave the ref unresolved. Idempotent via
`tree.assetsResolved`.

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

Videos (`<p:videoFile>`) and embedded fonts (`<p:embeddedFont>`) are not yet
parsed by T-240; T-243b and T-243c follow-ups will surface them and add the
matching `LF-PPTX-UNRESOLVED-VIDEO` / `LF-PPTX-UNRESOLVED-FONT` codes.

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
unsupported branch. The PPTX-specific `code` enum lives in
`@stageflip/import-pptx`:

- `LF-PPTX-CUSTOM-GEOMETRY` — `<a:custGeom>` containing `<a:arcTo>` / `<a:quadBezTo>` (the unsupported commands). Cleared once T-242b extends `cust-geom/parse.ts` or T-245 rasterizes.
- `LF-PPTX-PRESET-GEOMETRY` — preset shape outside the T-242 coverage set. Cleared as T-242b adds presets.
- `LF-PPTX-PRESET-ADJUSTMENT-IGNORED` — `<a:avLst>` adjustment was present but not honored (T-242a uses defaults).
- `LF-PPTX-UNRESOLVED-ASSET` — picture bytes pending resolution by `resolveAssets` (T-243). Cleared once `resolveAssets` runs.
- `LF-PPTX-MISSING-ASSET-BYTES` — `error` severity. Picture rel pointed at a path not present in the ZIP. Stays after `resolveAssets`; surfaces an actual import problem.
- `LF-PPTX-UNSUPPORTED-ELEMENT` — connection / OLE / chart placeholders. Resolved by T-247 / T-248.
- `LF-PPTX-UNSUPPORTED-FILL` — gradients, patterns. Resolved by T-249 (theme learning).
- `LF-PPTX-NOTES-DROPPED` — speaker notes. Resolved by T-249 / T-250.

## What still needs work

| Task | Gap |
|---|---|
| T-242 | 50+ preset geometries + custom SVG paths → schema `ShapeElement`. |
| T-243b | Video asset extraction — `<p:videoFile>` not yet parsed by T-240. |
| T-243c | Font asset extraction — `<p:embeddedFont>` not yet parsed. |
| T-245 | Shape rasterization fallback (crop from thumbnails) for unsupported shapes. |
| T-246 | AI-QC loop (Gemini multimodal convergence). |
| T-248 | Loss-flag reporter UI surface (editor panel + manifest). |
| T-249 | Theme learning — fold master/layout inheritance into the schema's `theme`. |
| T-250 | This skill plus the other `import-*` skills get substantive content. |

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
