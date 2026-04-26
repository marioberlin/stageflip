---
title: Reference — @stageflip/export-pptx
id: skills/stageflip/reference/export-pptx
tier: reference
status: substantive
last_updated: 2026-04-26
owner_task: T-253
related:
  - skills/stageflip/workflows/export-pptx
  - skills/stageflip/concepts/loss-flags
---

# Reference — `@stageflip/export-pptx`

Foundational PPTX writer. Inverse of `@stageflip/import-pptx`'s `parsePptx`.

## Public surface

```ts
import { exportPptx } from '@stageflip/export-pptx';
import type {
  AssetReader,
  ExportPptxOptions,
  ExportPptxResult,
  ExportPptxLossFlagCode,
} from '@stageflip/export-pptx';

const result: ExportPptxResult = await exportPptx(doc, opts);
// result.bytes: Uint8Array — the .pptx file
// result.lossFlags: LossFlag[] — empty on a perfect round-trip
```

## `ExportPptxOptions`

| Field | Default | Purpose |
|---|---|---|
| `assets?: AssetReader` | none | Resolves `asset:<id>` to bytes + content type. Required when the document has any image element. |
| `creator?: string` | `'StageFlip'` | Embedded creator name in `docProps/core.xml`. |
| `modifiedAt?: Date` | `new Date('2024-01-01T00:00:00Z')` (FROZEN_EPOCH) | Stamp on every ZIP entry's mtime + the docProps timestamps. Pin for byte-determinism. |

## `AssetReader`

```ts
interface AssetReader {
  get(id: string): Promise<{ bytes: Uint8Array; contentType: string } | undefined>;
}
```

Narrower than the importer's read-write `AssetStorage`. Production callers
typically wrap their `@stageflip/storage-firebase` adapter. Unit tests can
pass a `Map`-backed shim:

```ts
const assets: AssetReader = {
  get: async (id) => byId.get(id),
};
```

## `ExportPptxLossFlagCode`

```ts
type ExportPptxLossFlagCode =
  | 'LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT'
  | 'LF-PPTX-EXPORT-ASSET-MISSING'
  | 'LF-PPTX-EXPORT-CUSTOM-GEOMETRY-DEGRADED'
  | 'LF-PPTX-EXPORT-ANIMATIONS-DROPPED'
  | 'LF-PPTX-EXPORT-NOTES-DROPPED'
  | 'LF-PPTX-EXPORT-THEME-FLATTENED'
  | 'LF-PPTX-EXPORT-IMAGE-BACKGROUND-FALLBACK'
  // T-253-rider — placeholder-inheritance write-back:
  | 'LF-PPTX-EXPORT-LAYOUT-NOT-FOUND'
  | 'LF-PPTX-EXPORT-PLACEHOLDER-NOT-FOUND'
  | 'LF-PPTX-EXPORT-PLACEHOLDER-MISMATCH';
```

T-253-rider adds three codes around the layout / master / per-element
placeholder-reference path:

| Code | Severity | Category | When |
|---|---|---|---|
| `LF-PPTX-EXPORT-LAYOUT-NOT-FOUND` | warn | shape | An element's `inheritsFrom.templateId` doesn't match any `Document.layouts` or `Document.masters` entry. Writer falls back to materialized geometry. |
| `LF-PPTX-EXPORT-PLACEHOLDER-NOT-FOUND` | warn | shape | The `templateId` resolved but `placeholderIdx` doesn't exist on the layout (or transitively on its master). Same fallback. |
| `LF-PPTX-EXPORT-PLACEHOLDER-MISMATCH` | info | shape | Reserved for structural divergence between slide-side fields and the placeholder's. Today's element schemas keep top-level shape consistent so this is rare. |

The canonical `LossFlag.code` field is `string` (open); this writer-local
enum narrows the per-export surface for type-safe consumers. See
`skills/stageflip/concepts/loss-flags/SKILL.md` for the wider taxonomy.

## Determinism

Same input + same `modifiedAt` ⇒ byte-identical output. Three sources of
non-determinism are pinned:

- **ZIP entry order** — sorted alphabetically by archive path before pack.
- **ZIP timestamps** — every entry's `mtime` is `opts.modifiedAt` (or
  `FROZEN_EPOCH`). fflate is pinned at `level: 6`.
- **XML attribute order** — fixed by the per-element emit functions; the
  custom emitter in `xml/emit.ts` preserves insertion order.

## Round-trip predicate

`packages/export-pptx/src/test-helpers/round-trip.ts` exports
`diffRoundTrip(before, after, { riderActive })`. Exclusions documented in
`docs/tasks/T-253-base.md` §"Round-trip equality predicate":

- Loss flags excluded from structural compare; tracked separately.
- `Slide.notes`, `ElementBase.animations`, `Slide.transition`,
  `Document.theme` zeroed on both sides.
- `inheritsFrom` dropped on both sides for `riderActive: false`.
- Float comparisons exact (no epsilon) — EMU-derived px integer-divides.
- Element ordering preserved (z-order).
- `Document.layouts` / `Document.masters` empty on output for the base
  writer regardless of input.

## Out of scope (deferred)

| Item | Owner |
|---|---|
| `<p:sldLayout>` / `<p:sldMaster>` parts; per-element `<p:ph>` refs | **T-253-rider — landed** |
| `<a:tbl>` write-back | future T-253-tables rider |
| `<p:videoFile>` write-back | future T-253-videos rider |
| `<p:embeddedFontLst>` write-back | future T-253-fonts rider |
| `<a:custGeom>` real path write-back | future task |
| Animations / transitions / notesSlide | future tasks |
| Theme write-back from `Document.theme` | future T-253-theme rider |

## References

When the topic comes up mid-task, read the relevant doc:

- [references/pptx-constraints.md](references/pptx-constraints.md) — searchable Q&A on what the writer can / can't emit, with file_path:line citations and links to the relevant loss flags. Read before extending the writer or filing a Reviewer comment about a degraded path.

The `references/` tier convention is documented at [skills/stageflip/concepts/references-tier/SKILL.md](../../concepts/references-tier/SKILL.md).
