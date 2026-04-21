---
title: Reference — Validation Rules
id: skills/stageflip/reference/validation-rules
tier: reference
status: substantive
last_updated: 2026-04-21
owner_task: T-107
related:
  - skills/stageflip/concepts/rir
  - skills/stageflip/workflows/parity-testing
---

# Reference — Validation Rules

The `@stageflip/validation` package ships the pre-render linter for
`RIRDocument`. Rules catch problems that Zod can't express (timing
windows vs composition duration, registry-dependent clip resolution)
and quality issues that'd silently produce ugly output (empty text,
off-canvas elements, missing font requirements).

**T-104 scope**: 33 rules across 7 files. **T-107** replaces this
document with an auto-generated version sourced from the rule
metadata directly; until then, this file is hand-maintained and MUST
stay in sync with `packages/validation/src/rules/**`.

## Quick start

```ts
import { lintDocument } from '@stageflip/validation';
import { findClip } from '@stageflip/runtimes-contract';

const report = lintDocument(document, { context: { findClip } });
if (!report.passed) {
  for (const f of report.findings.filter((f) => f.severity === 'error')) {
    console.error(`[${f.rule}] ${f.message}`);
  }
  process.exit(1);
}
```

`LintReport.passed` is `true` iff `errorCount === 0`. Warnings and
info findings are advisory and do NOT fail the report — operators
can gate CI on error-only via `report.errorCount` or `report.passed`.

## Rule catalogue

Severities:
- **error** — fails the report; likely renders broken output.
- **warn** — renders successfully but looks wrong or violates style.
- **info** — valid but unusual; advisory.

### Timing & identifiers

| Rule id | Severity | What |
|---|---|---|
| `element-timing-within-composition` | error | `startFrame >= 0` AND `endFrame <= document.durationFrames` (endFrame is exclusive so equality is legal) |
| `animation-timing-within-element` | error | animation window must fit inside its parent element's timing |
| `animation-ids-unique-within-element` | error | animations on one element must have distinct ids |
| `element-ids-unique` | error | every `element.id` in the document must be unique |
| `elements-array-non-empty` | warn | document should contain at least one element |

### Transform & layout

| Rule id | Severity | What |
|---|---|---|
| `element-overlaps-composition-bounds` | warn | visible element should overlap the composition viewport |
| `element-not-tiny-when-visible` | warn | visible element should have area > 4 px² |
| `element-opacity-non-zero-when-visible` | warn | `visible: true` + `opacity: 0` is a contradiction |
| `element-rotation-within-reasonable-range` | info | \|rotation\| > 720° is usually accidental |

### Content-specific

| Rule id | Severity | What |
|---|---|---|
| `text-non-empty` | warn | text element should have non-empty text |
| `text-font-size-reasonable` | warn | fontSize ∈ [1, 2000] |
| `text-color-is-valid-css` | error | text.color must be a parseable CSS color |
| `shape-has-fill-or-stroke` | warn | at least one of fill / strokeColor or nothing renders |
| `shape-custom-path-has-path` | error | `shape: 'custom-path'` requires a path string |
| `shape-fill-is-valid-css` | error | shape.fill must be a parseable CSS color |
| `video-playback-rate-reasonable` | warn | playbackRate ∈ [0.25, 4] |
| `video-trim-ordered-when-present` | error | `trimEndMs > trimStartMs` when both are set |
| `embed-src-uses-https` | warn | http:// embeds may be blocked by modern browsers |
| `chart-series-length-matches-labels` | error | every series.values.length === labels.length |
| `chart-series-non-empty` | warn | chart should have ≥ 1 series |
| `table-cells-within-bounds` | error | cell (row, col) must fall inside rows × columns |

### Composition

| Rule id | Severity | What |
|---|---|---|
| `composition-dimensions-even-for-video` | warn | video codecs require even width + height |
| `composition-fps-standard` | info | fps ∈ {24, 25, 30, 48, 50, 60} for codec compatibility |
| `composition-duration-reasonable` | warn | > 60s duration without explicit operator opt-in |
| `composition-fits-mode-aspect-hint` | info | display mode expects wide canvases (≥ 2:1) |
| `meta-digest-present` | error | meta.digest must be a non-empty stable hash |

### Fonts

| Rule id | Severity | What |
|---|---|---|
| `font-requirement-covers-text-families` | warn | every text fontFamily should appear in fontRequirements |
| `font-requirement-weights-cover-text-weights` | warn | per-family weight coverage |

### Stacking

| Rule id | Severity | What |
|---|---|---|
| `stacking-map-covers-all-elements` | error | every element.id must appear in stackingMap |
| `stacking-value-matches-element` | error | stackingMap[id] must equal element.stacking |
| `zindex-unique-across-root` | info | duplicate zIndex values produce ambiguous order |

### Clip resolution (context-dependent)

| Rule id | Severity | What |
|---|---|---|
| `clip-kind-resolvable` | error / info | every clip element must resolve to a registered runtime. When `LintContext.findClip` isn't wired, emits a **single document-level `info`** finding (not one per clip element) so operators see the under-validation signal without silent-passing — wire `findClip` to upgrade to per-element errors |
| `clip-runtime-matches-registered` | error | declared runtime must match the one that actually owns the kind |

## Customising the rule set

Consumers can run a subset via `opts.include` / `opts.exclude` (rule
id allowlist / denylist) or substitute a custom `opts.rules` array:

```ts
// Run only errors and ignore the informational rules.
lintDocument(doc, {
  rules: ALL_RULES.filter((r) => r.severity === 'error'),
});
```

Rule groups are exported separately (`TIMING_RULES`,
`CONTENT_RULES`, etc.) so callers can compose without depending on
the full catalogue.

## Lifecycle

1. **Pre-render** — run `lintDocument` on every compiled RIR
   document before it enters the export pipeline. Hard-fail on
   error findings. Surface warnings and info to the operator.
2. **Pre-parity** — the parity harness (T-100+) is more forgiving of
   warnings; it only cares that the document renders at all. Run
   the linter as a filter before investing in scoring.
3. **Post-compiler** — the RIR compiler (T-030) emits valid
   documents by construction, but regression risk remains. Treat
   the linter as defense-in-depth on top of Zod.

## Auto-generation (future, T-107)

T-107 replaces this document with a generator that reads every
rule's `id`, `severity`, and `description` at build time and emits
the catalogue table automatically. Until then, when you add or
change a rule in `packages/validation/src/rules/**`, update the
table above and bump `last_updated`.
