---
title: Loss Flags
id: skills/stageflip/concepts/loss-flags
tier: concept
status: substantive
last_updated: 2026-04-30
owner_task: T-248
related:
  - skills/stageflip/workflows/import-pptx/SKILL.md
  - skills/stageflip/workflows/import-google-slides/SKILL.md
  - skills/stageflip/reference/export-formats/SKILL.md
---

# Loss Flags

When StageFlip ingests content from an external format (PPTX, Google Slides,
Hyperframes HTML, legacy SlideMotion), some details will not survive the
translation. A loss flag is a **first-class record** of every such
compromise, surfaced in the editor and in export artifacts so nothing is lost
silently.

## The shape

```ts
interface LossFlag {
  id: string;                 // stable; survives re-import
  source: 'pptx' | 'google-slides' | 'hyperframes-html' | 'slidemotion-legacy';
  severity: 'info' | 'warn' | 'error';
  category: 'shape' | 'animation' | 'font' | 'media' | 'theme' | 'script' | 'other';
  location: { slideId?: string; elementId?: string };
  message: string;            // human-readable
  recovery?: string;          // optional suggested fix
  originalSnippet?: string;   // short debug snippet of what we couldn't handle
}
```

## Severity contract

- `info` — Lossy but a reasonable substitute was made (e.g. "approximated
  custom gradient with 2-stop linear").
- `warn` — Visual or semantic change likely; human should review (e.g.
  "animation timing reduced from 47 keyframes to 5 supported phases").
- `error` — Element could not be reproduced (e.g. "embedded OLE object not
  supported"); rendered as placeholder.

## Editor UX

The editor surfaces loss flags in three places:

1. A badge on the slide thumbnail (warn = yellow, error = red)
2. A sidebar panel filterable by severity + category
3. An inline marker at the element's position on canvas

A "one-click fix" hook calls the recovery suggestion's handler where one is
registered.

## Export UX

Exports emit a `loss-manifest.json` alongside the artifact (PDF / MP4 / ZIP).
The manifest has every flag that could still affect the output. For strict
modes (IAB validators), `error`-severity flags block export.

## Deterministic ids

Flag IDs are content-hash-derived (`sha256(source + category + location +
originalSnippet).slice(0, 12)`) so re-importing the same file produces the
same flag set.

## Where the canonical type lives

`@stageflip/loss-flags` (T-247-loss-flags) owns the canonical `LossFlag`
shape, the severity / category vocabulary, and the deterministic-id emitter
(`emitLossFlag`). Editor-shell, the T-248 reporter UI, and every importer
depend on this package directly — none of them reach through
`@stageflip/import-pptx` for the type. Each importer extends the shape with
its own `LF-<SRC>-*` `code` union (a string-narrowing type) and provides a
thin wrapper around `emitLossFlag` that auto-fills `source` and the per-code
default severity / category. Adding a new importer never touches
`@stageflip/loss-flags`.

## Current state (Phase 11 — T-240 in)

`@stageflip/import-pptx` (T-240) ships the first concrete `LossFlag`
implementation. It carries an extra `code: LossFlagCode` field on top of the
shape above so the editor and export manifest can filter by stable cause
without parsing `message`. Sibling importers (T-244 Google Slides, T-247
Hyperframes HTML) follow the same pattern with their own `LF-<SRC>-*` enums.

PPTX codes (defined in `@stageflip/import-pptx`):

- `LF-PPTX-CUSTOM-GEOMETRY` — historically emitted for `<a:custGeom>` payloads using commands the parser couldn't translate. T-242b added `<a:quadBezTo>` (PR #178) and T-242d added `<a:arcTo>` (Sub-PR 2). The parser now translates every documented command in the supported set; this code is no longer emitted from the parser. Still-emits-for: ∅ (any future unsupported command would re-introduce an emit; T-245's rasterization fallback owns shape coverage beyond `cust-geom` translation).
- `LF-PPTX-PRESET-GEOMETRY` — historically emitted for preset shapes outside the T-242 coverage set. T-242c batch 1 cleared the 9 arrow + callout presets; batch 2 cleared `ribbon2`, `verticalScroll`, `horizontalScroll`, `star10`, `star12`, `moon`, `lightningBolt`, `noSmoking`; T-242d cleared the trailing arc-bearing trio (`chord`, `pie`, `donut`). After T-242d every committed preset is covered (50/50). Still-emits-for: ∅ committed presets; the long-tail (~140 OOXML presets outside the commitment) is owned by T-245's rasterization fallback under its own loss code.
- `LF-PPTX-PRESET-ADJUSTMENT-IGNORED` — preset has an `<a:avLst>` adjustment T-242a doesn't honor (defaults used instead). Info severity.
- `LF-PPTX-UNRESOLVED-ASSET` — picture bytes pending resolution. Cleared by T-243's `resolveAssets` post-walk pass.
- `LF-PPTX-UNRESOLVED-VIDEO` — video bytes pending resolution. Cleared by T-243b's `resolveAssets` extension. Severity `info`, category `media`. Same in-ZIP semantics as `LF-PPTX-UNRESOLVED-ASSET`; emitted by `<p:videoFile>` extensions on shapes whose relationship resolves to in-package bytes (`r:embed` or `r:link` with `TargetMode="Internal"`). External-URL `r:link` videos fall through to `LF-PPTX-UNSUPPORTED-ELEMENT` (`originalSnippet: 'external video URL'`) until a future task introduces `LF-PPTX-LINKED-VIDEO`.
- `LF-PPTX-UNRESOLVED-FONT` — embedded font bytes pending resolution. Cleared by T-243c's `resolveAssets` extension once every populated face (`regular` / `bold` / `italic` / `boldItalic`) of the family uploads. Severity `info`, category `font`. Emitted at parse time, one per `<p:embeddedFont>` family with `originalSnippet` set to the family name. Faces whose relId is broken or carries `TargetMode="External"` drop at parse time and the family's flag stays through `resolveAssets`.
- `LF-PPTX-MISSING-ASSET-BYTES` — `error` severity. T-243 emits this when a picture rel points at a path not present in the PPTX ZIP. T-243b reuses the same code for missing video bytes; T-243c reuses it for missing font face bytes (the underlying handling is identical across asset kinds).
- `LF-PPTX-UNSUPPORTED-ELEMENT` — chart / OLE / connection placeholders → T-247 / T-248.
- `LF-PPTX-UNSUPPORTED-FILL` — gradients / patterns → T-249.
- `LF-PPTX-NOTES-DROPPED` — speaker notes → T-249 / T-250.

T-241a (group transform accumulation) merged with no remaining loss flag —
the structural parser folds group transforms into descendants as a
post-walk pass.

T-243 (image asset resolution) merged: `LF-PPTX-UNRESOLVED-ASSET` is cleared
once `resolveAssets` runs against an `AssetStorage` adapter; broken rels
surface as `LF-PPTX-MISSING-ASSET-BYTES` (`error`).

T-243b (video asset resolution) merged: extends the same `resolveAssets`
post-walk pass with a `'video'` branch. `LF-PPTX-UNRESOLVED-VIDEO` is
cleared once the video bytes upload through the storage adapter; broken
rels reuse the existing `LF-PPTX-MISSING-ASSET-BYTES` code.

T-243c (embedded font extraction) merged: extends the same
`resolveAssets` pass with a deck-level font branch. The parser walks
`ppt/presentation.xml`'s `<p:embeddedFontLst>` and attaches one
`ParsedEmbeddedFont` per `<p:embeddedFont>` to
`CanonicalSlideTree.embeddedFonts`. `LF-PPTX-UNRESOLVED-FONT` is
cleared once every face of a family uploads; broken rels reuse
`LF-PPTX-MISSING-ASSET-BYTES`.

T-248 picks up the editor/export reporter UX. The schema does not yet carry
flags on `Document` — they are produced at import time and surfaced
out-of-band by the reporter.

## Reporter UI (T-248)

`@stageflip/editor-shell` exposes the session-ephemeral atom triple that
backs the reporter:

- `importLossFlagsAtom: Atom<readonly LossFlag[]>` — raw flags from the
  last import. Default `[]`.
- `dismissedLossFlagIdsAtom: Atom<ReadonlySet<string>>` — per-session
  dismissed ids. Survives `importLossFlagsAtom` rewrites (re-imports
  respect prior dismissals).
- `visibleLossFlagsAtom` — derived: `importLossFlagsAtom \ dismissedLossFlagIdsAtom`,
  sorted severity-desc then source-asc then code-asc.

`apps/stageflip-slide` consumes the atom triple via two components:

- `<LossFlagBadge>` (in `apps/stageflip-slide/src/components/status-bar/`)
  — status-bar slot. Returns `null` when there are no visible flags;
  otherwise a button labelled with the count + worst-severity color.
- `<LossFlagReporter>` + `<LossFlagRow>` (in
  `apps/stageflip-slide/src/components/dialogs/loss-flag-reporter/`) —
  modal listing every visible flag, grouped by severity, with per-row
  dismiss + bulk dismiss + click-to-locate (writes `activeSlideIdAtom`
  and `selectedElementIdsAtom`). Reuses `<ModalShell>` for chrome.

**T-248 ships INERT**: the reporter is fully tested in isolation, but no
in-app code path populates `importLossFlagsAtom` until the import-pipeline
refactor lands. Future apps (`stageflip-video`, `stageflip-display`) wire
their own badge + modal that share the same atom triple.

## Related

- Reporter: T-248
- Per-source imports: `workflows/import-*/SKILL.md`
- Export manifest: `@stageflip/export-loss-flags`
