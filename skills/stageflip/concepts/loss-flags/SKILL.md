---
title: Loss Flags
id: skills/stageflip/concepts/loss-flags
tier: concept
status: substantive
last_updated: 2026-04-20
owner_task: T-248
related:
  - skills/stageflip/workflows/import-pptx/SKILL.md
  - skills/stageflip/workflows/import-google-slides/SKILL.md
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

## Current state (Phase 1 exit)

Not yet implemented. Phase 11 (T-248 reporter; T-240..T-247 importers) wires
the LossFlag type and the editor/export UX. Phase 1's schema does not yet
carry flags on `Document` — they are produced at import time.

## Related

- Reporter: T-248
- Per-source imports: `workflows/import-*/SKILL.md`
- Export manifest: `@stageflip/export-loss-flags`
