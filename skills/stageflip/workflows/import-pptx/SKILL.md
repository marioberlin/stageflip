---
title: Workflow — Import PPTX
id: skills/stageflip/workflows/import-pptx
tier: workflow
status: substantive
last_updated: 2026-04-26
owner_task: T-250
related:
  - skills/stageflip/concepts/loss-flags
  - skills/stageflip/concepts/design-system-learning
---

# Workflow — Import PPTX

T-240 ships the structural parser (`@stageflip/import-pptx`). Subsequent
tasks fill the rest of the import surface; sections below mark which task
owns each gap.

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

- `LF-PPTX-CUSTOM-GEOMETRY` — `<a:custGeom>` → `unsupported-shape`. Resolved by T-242 / T-245.
- `LF-PPTX-PRESET-GEOMETRY` — preset shape outside the schema-mapped subset. Resolved by T-242.
- `LF-PPTX-UNRESOLVED-ASSET` — picture bytes deferred. Resolved by T-243.
- `LF-PPTX-UNSUPPORTED-ELEMENT` — connection / OLE / chart placeholders. Resolved by T-247 / T-248.
- `LF-PPTX-UNSUPPORTED-FILL` — gradients, patterns. Resolved by T-249 (theme learning).
- `LF-PPTX-NOTES-DROPPED` — speaker notes. Resolved by T-249 / T-250.

## What still needs work

| Task | Gap |
|---|---|
| T-242 | 50+ preset geometries + custom SVG paths → schema `ShapeElement`. |
| T-243 | Asset extraction (images, videos, fonts) → Firebase Storage; resolve `ParsedAssetRef.unresolved` → schema's `AssetRef` (`asset:<id>`). |
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
