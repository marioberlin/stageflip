---
title: Canonical Schema
id: skills/stageflip/concepts/schema
tier: concept
status: substantive
last_updated: 2026-04-27
owner_task: T-250
related:
  - skills/stageflip/concepts/rir
  - skills/stageflip/reference/schema
---

# Canonical Schema

The canonical schema is **the single source of truth** for every document
StageFlip touches. Invariant I-1: every input, every edit, every export
round-trips through it.

## Shape

A **Document** has:

- `meta`: id, version, created/updated, authorship, i18n locale
- `theme`: design tokens (colors, fonts, spacing, radii, shadows)
- `variables`: named inputs bound into elements (`{{company_name}}`)
- `components`: reusable element compositions
- `masters`: deck-level `SlideMaster[]` — top-tier templates owning placeholder
  elements (T-251). Defaults to `[]`.
- `layouts`: deck-level `SlideLayout[]` — second-tier templates that extend a
  master and own placeholder elements (T-251). Defaults to `[]`.
- `content`: mode-discriminated (`slide` | `video` | `display`); shape differs
  per mode

Slides carry an optional `layoutId` pointing at one of `Document.layouts`. Per-element `inheritsFrom: { templateId, placeholderIdx }` opts an element into placeholder inheritance — at compile/read time the matching placeholder fills any unset top-level field on the slide element. Slide values always win on fields that are explicitly set; `transform` and `animations` are never overridden. The schema-level pure helper `applyInheritance(doc): Document` materializes the inheritance and is the single source of truth — the RIR `apply-inheritance` pass and the editor's `materializedDocumentAtom` both call it. PPTX (T-244 / T-243d) and Google Slides (T-244) importers populate `masters` / `layouts` / `inheritsFrom`; the matching exporter is T-253.

Every element is one of **11 discriminated types**:

| Type | Purpose |
|---|---|
| `text` | Styled text runs with overrides |
| `image` | Raster + vector refs; fit modes |
| `video` | Source ref + trimming + audio toggle |
| `audio` | Audio track + mixing metadata |
| `shape` | SVG primitives + custom paths |
| `group` | Transform-accumulating container |
| `chart` | Data-driven; data-source binding |
| `table` | Cells, CM1 annotations |
| `clip` | Runtime-dispatched animation |
| `embed` | Iframe with `isolation: isolate` |
| `code` | Syntax-highlighted code block |

## Rules

- Every element is **Zod-validated**. No `any`. No untyped passthrough.
- The discriminator field is `type`. Switch on it exhaustively; TS will prove
  completeness.
- `zIndex` is assigned by array index × 10 at RIR-compile time (see RIR skill).
  Clip and runtime code may not write `zIndex` directly.
- Animations attach via `animations: Animation[]` on the element, not at the
  document level. Timing primitives are `B1–B5` (see T-022).

## Native grouping

The schema preserves source-format grouping rather than flattening at import.
Three structural elements participate:

### `GroupElement` (recursive container)

`group` carries a `children: ElementBase[]` array; descendants render in
array order. Group transforms compose into descendants via the importer's
own composition pass — there is no flattening at the schema layer:

- **PPTX side**: `accumulateGroupTransforms` (a post-walk pass in
  `@stageflip/import-pptx`) folds each group's `<a:xfrm>` (`chOff` / `chExt`
  scaling, group rotation around the group's center, summed rotation) into
  its descendants so leaves carry world-space coordinates. The result tree
  carries `transformsAccumulated: true`; a second call is a no-op
  (idempotent). The group node retains its own transform so callers that
  want to render group bounds still can.
- **Google Slides side**: `composeAffines` (package-local to
  `@stageflip/import-google-slides`) is the standard 3×3 augmented-matrix
  product. Each Slides API `pageElement.elementGroup.children` recurses
  into a `ParsedGroupElement`; transforms compose top-down into descendants.
  No cross-package extraction — PPTX's `accumulateGroupTransforms` operates
  on the domain-specific `GroupFrame` (chOff/chExt + rotation-around-center)
  and is intentionally untouched.

Exporter parity: `@stageflip/export-pptx` re-emits `<p:grpSp>` with children
recursing through the same dispatcher; the writer pre-flattens group
transforms onto descendants so `chOff`/`chExt` ship as identity. T-252's
Slides exporter emits child creates first, then a single
`GroupObjectsRequest` binds them.

### `TableElement` (merged cells)

`table` cells carry `colspan` / `rowspan` (defaults to 1 each). Importers
preserve the source format's merged-cell representation:

- **PPTX**: `<a:tc rowSpan="N" gridSpan="M">` maps to `colspan: M`,
  `rowspan: N`. Cells covered by a span are not emitted (the master cell
  owns the rectangle).
- **Google Slides**: `pageElement.table.tableRows[].tableCells[].columnSpan
  / rowSpan` populates `colspan` / `rowspan`. Inconsistent spans (overlap,
  zero, overflow) trigger `LF-GSLIDES-TABLE-MERGE-LOST` and a fallback to
  per-slot independent cells.

### `inheritsFrom` (placeholder inheritance)

Per-element `inheritsFrom: { templateId, placeholderIdx }` opts an element
into placeholder inheritance against `Document.layouts[]` and
`Document.masters[]` (T-251). The transitive walk is layout → master.
`applyInheritance(doc): Document` (in `@stageflip/schema`) is the single
source of truth — both the RIR `apply-inheritance` pass and the editor's
`materializedDocumentAtom` call it.

Override semantics (mirrored on the export side via `compareToPlaceholder`):

- Slide values always win on fields that are explicitly set.
- `transform` is whole-or-nothing (1 EMU diff → full slide-side override).
- `animations: []` is **never** overridden by the placeholder.
- `id`, `type`, and `inheritsFrom` itself are never copied from the
  placeholder.

When a slide element matches the placeholder on every override key, the
T-253-rider exporter emits ONLY the `<p:nvSpPr>` placeholder ref — no
`<p:spPr>`, no `<p:txBody>` — so the runtime fully inherits.

Unresolvable references fall back to materialized geometry and surface
loss flags: `LF-RIR-LAYOUT-NOT-FOUND`, `LF-RIR-PLACEHOLDER-NOT-FOUND` at
RIR-compile, `LF-PPTX-EXPORT-LAYOUT-NOT-FOUND`, `-PLACEHOLDER-NOT-FOUND`,
`-PLACEHOLDER-MISMATCH` at PPTX export. See
`skills/stageflip/concepts/loss-flags/SKILL.md` for the full taxonomy.

## Mutation — only through typed semantic tools

Invariant I-3: agents never emit raw HTML into a document. Every mutation is a
semantic tool call with a Zod-validated input and output. See
`concepts/tool-bundles/SKILL.md`.

## Versioning

- `meta.version` is a monotonic integer.
- Breaking schema changes ship with a migration in
  `@stageflip/schema/migrations/` — one file per version bump — plus a
  round-trip test (T-023, T-024).
- Imports (PPTX, Google Slides, SlideMotion legacy, Hyperframes HTML) land as
  the current version; the importer owns the translation.

## Example — the minimum valid document

```ts
import { documentSchema, type Document } from '@stageflip/schema';

const doc: Document = documentSchema.parse({
  meta: {
    id: 'doc_01H',
    version: 1,
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
  },
  theme: { tokens: { 'color.bg': '#ffffff', 'color.fg': '#0a0a0a' } },
  variables: {},
  components: {},
  content: {
    mode: 'slide',
    slides: [
      {
        id: 's1',
        elements: [
          {
            id: 'e1',
            type: 'text',
            transform: { x: 0, y: 0, width: 100, height: 50 },
            text: 'Hi',
          },
        ],
      },
    ],
  },
});
```

## Implementation

- Package: `@stageflip/schema` (T-020–T-024, T-034 auto-gen reference)
- Element schemas: `packages/schema/src/elements/*.ts`
- Content modes: `packages/schema/src/content/{slide,video,display}.ts`
- Document wrapper: `packages/schema/src/document.ts`
- Animations + timing: `packages/schema/src/{animations,timing}.ts`
- Migrations: `packages/schema/src/migrations/` (framework; currently v0→v1 identity)
- Tests: 92 cases covering all 11 types, animations, content modes, migrations,
  plus property-based round-trip (T-024, via `fast-check`)

## Related

- RIR compiler: `concepts/rir/SKILL.md`
- Auto-generated schema reference: `reference/schema/SKILL.md`
- Migration framework + versioning: T-023
