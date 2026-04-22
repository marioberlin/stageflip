---
"@stageflip/app-slide": minor
---

T-124: `<Filmstrip>` — vertical slide-thumbnail rail.

- **`<SlideThumbnail>`** — reuses `<ElementView>` at a fixed 160×90
  frame via a CSS scale. No separate `CssSlideRenderer` — same code
  path as the main canvas guarantees the thumb matches what the
  canvas shows.
- **`<Filmstrip>`** — vertical rail showing every slide. Active slide
  gets a blue border + `aria-current`. Click replaces selection +
  activates; **Shift / Cmd / Ctrl click** toggles membership in
  `selectedSlideIdsAtom` without changing the active slide.
- **Add slide** button at the bottom appends a blank slide via
  `updateDocument` (id generated via `crypto.randomUUID` with a
  `Math.random` fallback for older runtimes) and sets it active.

**Deferred** (out of scope per plan v1.9 T-124 row, tracked in the
audit §1 but not critical for the walking skeleton):
  - Drag-reorder
  - Right-click context menu

**App integration** — `editor-app-client.tsx` splits the workspace
into `<Filmstrip>` + canvas/preview; the walking-skeleton doc now
seeds a second slide so the rail has material to show.

**Walking-skeleton e2e** — new test asserting the filmstrip renders
two slides and clicking the second swaps `slide-canvas`'s
`data-active-slide-id`. Existing specs re-scoped to the canvas plane
so filmstrip thumbnails (which reuse element ids) don't collide with
strict-mode locator matching.

7 new vitest cases; 84 app tests + 8 e2e green. No new deps.
