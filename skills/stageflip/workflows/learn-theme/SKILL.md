---
title: Workflow — Learn Theme (8-step design-system pipeline)
id: skills/stageflip/workflows/learn-theme
tier: workflow
status: substantive
last_updated: 2026-04-27
owner_task: T-249
related:
  - skills/stageflip/concepts/design-system-learning
  - skills/stageflip/reference/design-system
  - skills/stageflip/concepts/loss-flags
  - skills/stageflip/concepts/schema
---

# Workflow — Learn Theme

`@stageflip/design-system`'s `learnTheme(opts)` walks a parsed `Document`
through 8 deterministic steps, extracts a `LearnedTheme` (palette,
typography, spacing, components, fonts), and writes back canonical
`theme:foo.bar` refs in place of hex literals.

The function is the closing piece for theme-aware import. Each importer
(PPTX, Google Slides, Hyperframes) emits a `Document` with literal hex
colors + per-element font-family strings; `learnTheme` walks that document
post-`applyInheritance` + post-`resolveAssets` and produces the
theme-tokenized version the editor + RIR consume.

## Pipeline

```
Document (literals)
   │
   ▼ step 1: color extraction + Lab-space k-means (seed=42)
   │   → PaletteCluster[]
   ▼ step 2: typography extraction (family+size+weight+italic clusters)
   │   → TypographyCluster[]
   ▼ step 3: spacing extraction (sibling-edge gap clustering)
   │   → spacingTokens
   ▼ step 4: shape language (read-only histogram)
   │   → ShapeKind histogram + slide-coverage metric
   ▼ step 5: component extraction (structural-hash on subgroups)
   │   → ComponentLibrary (id → ComponentDefinition)
   ▼ step 6: font asset fetching (Google Fonts via FontFetcher)
   │   → fontAssets[family] = AssetRef
   ▼ step 7: token naming (largest cluster → primary; L>0.85 → background)
   │   → paletteNames + typographyNames
   ▼ step 8: writeback (replaces hex literals matching ΔE<5 with theme refs)
   │   → MUTATED Document + LearnedTheme
   ▼
LearnThemeResult { theme, document, componentLibrary, lossFlags, stepDiagnostics }
```

`stopAfterStep: N` (1-8, default 8) stops the pipeline early. Steps are
sequenced cheapest-first so a "color-only" caller pays only step 1's cost.

## Mutation contract

**The pipeline MUTATES `opts.doc`.** Callers needing to preserve the
original must `structuredClone(doc)` before invoking. Concurrent reads of
`opts.doc` while `learnTheme` is running are unsafe — serialize at the
caller.

## Determinism

`learnTheme(doc, opts)` is byte-deterministic given:

- Identical input `Document`.
- Identical `kMeansSeed` (default 42).
- Identical `kMeansTargetClusters` (default 8).
- Identical `modifiedAt` (default frozen epoch `1970-01-01T00:00:00.000Z`).

Step 6 (font fetch) is non-deterministic by nature (network + storage);
production tests inject a `StubFontFetcher` returning canned bytes. AC #30
pins source-level discipline (no `Date.now` / `Math.random` /
`setTimeout` / etc. in `src/**` excluding tests).

## Loss flags

| Code | Severity | Category | When |
|---|---|---|---|
| `LF-DESIGN-SYSTEM-FONT-FETCH-FAILED` | error | font | Step 6 couldn't fetch a font. The family stays in typography but `fontAssets[family]` is `undefined`. |
| `LF-DESIGN-SYSTEM-AMBIGUOUS-CLUSTER` | warn | theme | Step 7 found two clusters tied for the same semantic name. The pipeline picks one deterministically and emits the flag for human review. |
| `LF-DESIGN-SYSTEM-COMPONENT-MERGE-FAILED` | info | shape | Step 5 detected a recurring grouping but couldn't unify into a `ComponentDefinition`. The grouping is dropped from the library. |

## Idempotence

Re-running `learnTheme` on a document that's already been tokenized
produces an idempotent result: matching `theme:foo.bar` refs pass through
unchanged in step 1 (only hex literals contribute to clustering), and step
8 leaves them alone in writeback. The pipeline can be safely re-applied
without producing drift.

## Step-level invariants

- **Step 1**: color clustering uses Lab space (ΔE < 5 = perceptually
  similar). Output ordering is weight-DESC; ties broken by Lab L ASC.
- **Step 4**: read-only — must NOT mutate the document or emit tokens.
- **Step 5**: 3-slide threshold for "recurring." Below that, no component
  emitted. Slot identification requires consistent element types across
  instances at each position; otherwise emit
  `LF-DESIGN-SYSTEM-COMPONENT-MERGE-FAILED`.
- **Step 6**: skipped entirely when `fontFetcher` is `undefined`. Theme
  still emitted with `fontAssets: {}`.
- **Step 8**: writeback uses ΔE < 5 in Lab as the match threshold. Hex
  literals further from any cluster centroid stay as literals.

## Public surface

See `reference/design-system/SKILL.md` for full type signatures.

## Related

- Concept: `concepts/design-system-learning/SKILL.md`
- Reference: `reference/design-system/SKILL.md`
- Schema: `concepts/schema/SKILL.md`
- Task: T-249
