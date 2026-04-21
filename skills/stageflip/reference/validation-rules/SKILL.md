---
title: Reference — Validation Rules
id: skills/stageflip/reference/validation-rules
tier: reference
status: auto-generated
last_updated: 2026-04-21
owner_task: T-107
related:
  - skills/stageflip/concepts/rir
  - skills/stageflip/workflows/parity-testing
---

# Reference — Validation Rules

**Auto-generated from `@stageflip/validation` rule metadata.** Do NOT
edit by hand — run `pnpm skills-sync` after changing any rule's `id`,
`severity`, or `description` in `packages/validation/src/rules/**`, and
`pnpm skills-sync:check` will fail in CI if the committed file drifts.

Currently 33 rules across 7 categories.

The `@stageflip/validation` package ships the pre-render linter for
`RIRDocument`. Rules catch problems that Zod can't express (timing
windows vs composition duration, registry-dependent clip resolution)
and quality issues that'd silently produce ugly output (empty text,
off-canvas elements, missing font requirements).

## Severity legend

- **error** — fails the report; likely renders broken output.
- **warn** — renders successfully but looks wrong or violates style.
- **info** — valid but unusual; advisory.

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

### Timing & identifiers

| Rule id | Severity | What |
|---|---|---|
| `element-timing-within-composition` | error | every element.timing must satisfy startFrame >= 0 and endFrame <= document.durationFrames (endFrame is exclusive, so equality is legal) |
| `animation-timing-within-element` | error | every animation.timing window must fit inside its parent element.timing |
| `animation-ids-unique-within-element` | error | animations within a single element must have unique ids |
| `element-ids-unique` | error | every element.id in the document must be unique |
| `elements-array-non-empty` | warn | document should contain at least one element |

### Transform & layout

| Rule id | Severity | What |
|---|---|---|
| `element-overlaps-composition-bounds` | warn | element should at least partially overlap the composition viewport |
| `element-not-tiny-when-visible` | warn | visible element should have an area > 4px² (anything smaller is ~invisible) |
| `element-opacity-non-zero-when-visible` | warn | visible element should have non-zero opacity (contradiction: visible but transparent) |
| `element-rotation-within-reasonable-range` | info | element rotation outside ±720° is usually accidental — consider normalising |

### Content-specific

| Rule id | Severity | What |
|---|---|---|
| `text-non-empty` | warn | text elements should have non-empty text content |
| `text-font-size-reasonable` | warn | text fontSize should fall within [1, 2000] |
| `text-color-is-valid-css` | error | text.color must parse as a CSS color string (hex / rgb / hsl / keyword) |
| `shape-has-fill-or-stroke` | warn | shape elements should define at least one of fill / strokeColor, else nothing renders |
| `shape-custom-path-has-path` | error | shape with shape: 'custom-path' must carry a path string |
| `shape-fill-is-valid-css` | error | shape.fill must parse as a CSS color string when present |
| `video-playback-rate-reasonable` | warn | video playbackRate outside [0.25, 4] is unusual |
| `video-trim-ordered-when-present` | error | when both video.trimStartMs and trimEndMs are set, end must be > start |
| `embed-src-uses-https` | warn | embed.src should use https (http embeds may be blocked by modern browsers) |
| `chart-series-length-matches-labels` | error | every chart series.values.length must equal chart.data.labels.length |
| `chart-series-non-empty` | warn | chart should have at least one series |
| `table-cells-within-bounds` | error | every table cell (row, col) must fall inside the declared rows × columns grid |

### Composition

| Rule id | Severity | What |
|---|---|---|
| `composition-dimensions-even-for-video` | warn | video codecs (h264/h265) require even width + height — warn if odd |
| `composition-fps-standard` | info | composition fps should be one of 24, 25, 30, 48, 50, 60 for best codec/player compatibility |
| `composition-duration-reasonable` | warn | composition duration > 30s (at 30fps) may indicate a missing timing override |
| `composition-fits-mode-aspect-hint` | info | display mode suggests wider canvases (≥2:1); slide/video expect 16:9-ish |
| `meta-digest-present` | error | meta.digest must be a non-empty stable hash (required by the parity harness for reproducibility) |

### Fonts

| Rule id | Severity | What |
|---|---|---|
| `font-requirement-covers-text-families` | warn | every text element fontFamily should appear in document.fontRequirements |
| `font-requirement-weights-cover-text-weights` | warn | for each text family, fontRequirements should list the weight used |

### Stacking

| Rule id | Severity | What |
|---|---|---|
| `stacking-map-covers-all-elements` | error | every element.id must appear in stackingMap (the compiler contract) |
| `stacking-value-matches-element` | error | each stackingMap[id] must equal the element's own stacking value |
| `zindex-unique-across-root` | info | duplicate zIndex values produce ambiguous stacking order — prefer unique assignments |

### Clip resolution (context-dependent)

| Rule id | Severity | What |
|---|---|---|
| `clip-kind-resolvable` | error | every clip element must resolve to a registered runtime + clip kind |
| `clip-runtime-matches-registered` | error | a clip's declared runtime must match the runtime that actually owns its kind |

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
