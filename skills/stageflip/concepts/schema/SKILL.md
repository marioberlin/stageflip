---
title: Canonical Schema
id: skills/stageflip/concepts/schema
tier: concept
status: substantive
last_updated: 2026-04-20
owner_task: T-020
related:
  - skills/stageflip/concepts/rir/SKILL.md
  - skills/stageflip/reference/schema/SKILL.md
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
- `content`: mode-discriminated (`slide` | `video` | `display`); shape differs
  per mode

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
import { Document } from '@stageflip/schema';

const doc: Document = {
  meta: { id: 'doc_01H...', version: 1, updatedAt: '2026-04-20T00:00:00Z' },
  theme: { tokens: { 'color.bg': '#fff', 'color.fg': '#0a0a0a' } },
  variables: {},
  components: {},
  content: {
    mode: 'slide',
    slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', text: 'Hi' }] }],
  },
};
```

## Related

- RIR compiler: `concepts/rir/SKILL.md`
- Auto-generated schema reference: `reference/schema/SKILL.md`
- Migration framework: T-023
