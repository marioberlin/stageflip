---
"@stageflip/app-slide": minor
---

T-123b: `<SelectionOverlay>` with 8 resize handles + rotation + move drag.

Second of four rows split from T-123 (CanvasWorkspace port).

- **`<CanvasScaleProvider>`** — React context carrying the live
  scale-to-fit factor from `<SlideCanvas>`. Consumers (overlay and any
  future transform UI) divide client-pixel deltas by this to re-enter
  canvas-space coordinates.
- **`<SelectionOverlay>`** — renders one overlay per id in
  `selectedElementIdsAtom`. Each overlay has:
  - Bounding-box body that drives a **move** gesture on drag.
  - 8 **resize handles** (4 corners + 4 edges) with correct origin-
    anchoring (top-left shrinks from origin, bottom-right grows away
    from it, edges touch only one dimension).
  - Rotation handle above the top-center that writes normalized
    (0–360) rotation to the transform.
  - Enforces 1px minimum width/height so over-shrinks can't invert
    the box.
- Commits go through `useDocument().updateDocument(...)` — mutates the
  canonical source document deeply so nested group children also
  update. History capture (undo per gesture) lands with T-133.
- `<SlideCanvas>` now wires pointer-down on elements → select, and on
  the bare plane → clear selection.
- `<ElementView>` accepts an optional `onPointerDown` handler; absence
  keeps elements inert (unchanged for tests that render it standalone).
- Walking-skeleton e2e extended: click the seeded title → assert the
  overlay + corner handles + rotation handle mount.

10 new vitest cases (move/resize/edge/rotation/min-size) + 1 new e2e.
All 11 CI gates green locally.
