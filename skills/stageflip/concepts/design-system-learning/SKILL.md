---
title: Design System Learning
id: skills/stageflip/concepts/design-system-learning
tier: concept
status: substantive
last_updated: 2026-04-27
owner_task: T-249
related:
  - skills/stageflip/workflows/import-pptx/SKILL.md
  - skills/stageflip/workflows/import-google-slides/SKILL.md
  - skills/stageflip/workflows/learn-theme/SKILL.md
  - skills/stageflip/reference/design-system/SKILL.md
  - skills/stageflip/concepts/schema/SKILL.md
  - skills/stageflip/concepts/loss-flags/SKILL.md
---

# Design System Learning

When a user imports an existing deck (PPTX, Google Slides, Hyperframes),
StageFlip does **not** just translate the bytes. It reads the design intent
— palette, type scale, spacing, component patterns — and emits a canonical
`LearnedTheme` plus a library of components. The result: new slides
authored in the editor look like they belong in the same deck.

## The 8-step pipeline (T-249)

T-249 ships an 8-step pipeline in `@stageflip/design-system`. Steps are
sequenced from cheapest (color clustering) to most expensive (font
fetching) so callers can `stopAfterStep: N` if they only need a prefix.

1. **Color extraction + clustering.** Walk every element's fills, strokes,
   text colors, and slide backgrounds. Run seeded k-means in CIE Lab color
   space. Emits `PaletteCluster[]` with stable centroids.
2. **Typography extraction.** Walk every text element + run; bucket by
   `(family, size, weight, italic)`; rank by element-coverage frequency.
3. **Spacing extraction.** Walk sibling element pairs per slide; compute
   non-overlapping edge gaps; cluster the 1D distribution within ±2 px
   tolerance; cap to 8 buckets.
4. **Shape language (read-only).** Histogram `ShapeKind` usage + slide
   coverage. Does NOT mutate the document or emit tokens.
5. **Component extraction.** Hash element subgroups by type + normalized
   position; identify hashes recurring on 3+ slides; emit
   `ComponentDefinition` records with typed `{slots, layout}` body.
6. **Font asset fetching.** For each typography family, fetch font bytes
   via the supplied `FontFetcher` (Google Fonts via the hand-rolled css2
   client) and upload through `AssetStorage`. Skipped when `fontFetcher`
   is undefined.
7. **Token naming.** Largest cluster → `primary`; lightest (>0.85 L) →
   `background`; darkest (<0.20 L) → `foreground`; rest by frequency. Ties
   on `primary` emit `LF-DESIGN-SYSTEM-AMBIGUOUS-CLUSTER`.
8. **Writeback.** Walk the document a second time; replace literal hex
   colors that match a cluster centroid (within ΔE < 5 in Lab) with
   `theme:color.<name>` refs. **Mutates the input document in-place.**

Each step is a pure function `(state) => state`; the pipeline composes
them. Steps 1-5, 7 are deterministic with no I/O. Step 4 is read-only.
Step 6 is non-deterministic by nature (network); production tests use a
stub fetcher returning canned bytes.

## Mutation strategy

`learnTheme(opts)` MUTATES `opts.doc`. Callers needing the original
preserved must `structuredClone(doc)` before invoking. The mutation
matches the schema's existing `theme:foo.bar` ref shape — a document with
hex literals and a document with theme refs are both valid; the
RIR theme-resolve pass handles either.

## Determinism

`learnTheme(doc, { kMeansSeed: 42, modifiedAt })` produces byte-identical
output across runs. The package's `determinism.test.ts` enforces a
source-level grep for banned non-deterministic primitives (`Date.now`,
`Math.random`, `setTimeout`, etc.) in `src/**` excluding tests.

## Output shape

```ts
interface LearnedTheme {
  tokens: ThemeTokens;
  palette: ThemePalette;
  typography: Record<string, TypographyToken>;
  spacing: Record<string, number>;
  fontAssets: Record<string, AssetRef>;
  source: { learnedAt: string; step: 1|2|3|4|5|6|7|8; documentId: string };
}
interface LearnThemeResult {
  theme: LearnedTheme;
  document: Document;          // = opts.doc, mutated in place
  componentLibrary: ComponentLibrary;
  lossFlags: LossFlag[];
  stepDiagnostics: StepDiagnostic[];
}
```

## Loss flags

Three codes, all `source: 'design-system'`:

| Code | Severity | Category | Emitted when |
|---|---|---|---|
| `LF-DESIGN-SYSTEM-FONT-FETCH-FAILED` | error | font | Step 6 couldn't fetch a font (network, missing on Google Fonts, license rejected). |
| `LF-DESIGN-SYSTEM-AMBIGUOUS-CLUSTER` | warn | theme | Step 7 found two clusters tied for the same semantic name. |
| `LF-DESIGN-SYSTEM-COMPONENT-MERGE-FAILED` | info | shape | Step 5 detected a recurring grouping but couldn't unify into a `ComponentDefinition`. |

## Out of scope (deferred)

- Editor UI for editing the learned theme (apps task).
- Custom non-Google-Fonts sources (T-249-fonts-extended rider).
- AI-assisted token naming (LLM-suggested names).
- Component parameterization beyond slot identification.
- Animation / transition extraction.
- Theme inheritance from external design-system files (Figma, w3c tokens).
- Font glyph subsetting.
- Radii / shadows / layout templates — earlier drafts of this concept
  enumerated these as steps; the actual T-249 v1 surface ships color +
  typography + spacing + shape-language + components + fonts only. Radii
  and shadows are reachable via a follow-on T-249-shape-tokens rider.

## Current state

Implemented. Phase 11 (T-249) delivers the 8-step pipeline as described.
T-246 adds the AI-QC convergence loop in the Google Slides importer (a
separate surface).

## Related

- Workflow skill: `workflows/learn-theme/SKILL.md`
- Reference skill: `reference/design-system/SKILL.md`
- Schema theme tokens: `concepts/schema/SKILL.md`
- Loss flags: `concepts/loss-flags/SKILL.md`
- Task: T-249
