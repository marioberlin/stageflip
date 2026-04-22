---
"@stageflip/app-slide": minor
---

T-123c: InlineTextEditor + TextSelectionToolbar.

Third of four rows split from T-123 (CanvasWorkspace port).

- **`<InlineTextEditor>`** — contenteditable span that replaces a text
  element's static render while being edited. Commits the live
  `textContent` to `element.text` via `useDocument().updateDocument`
  on Enter (without Shift) or blur; Escape abandons. Writes nothing
  to the document when the text hasn't changed. Mounts focused with
  the whole text pre-selected so the first keystroke replaces.
- **`<TextSelectionToolbar>`** — floating toolbar above the active
  editor with four buttons: bold / italic / underline / link. Each
  button toggles whole-element formatting on the element's `runs[0]`
  (weight 700, italic, underline); link is a UI stub (no schema
  write) until a later iteration adds link support. Runs are
  dropped back to `undefined` when all flags return to their
  defaults so docs don't bloat.
- **`<ElementView>`** accepts `onDoubleClick` + a `children` override
  so the canvas can render the editor in place of the static text.
- **`<SelectionOverlay>`** forwards double-click on the move-body up
  to the canvas (`onElementDoubleClick`). Without this the overlay
  swallows the second click of a double-click gesture on a selected
  element.
- **`<SlideCanvas>`** tracks an `editingId` local state; on
  double-click of a text element, mounts the editor + toolbar and
  hides the selection overlay while editing. Empty-plane click
  exits edit mode.
- Walking-skeleton e2e: new test — double-click the seeded title →
  assert the editor + toolbar mount.

12 new vitest cases (6 editor, 6 toolbar) + 1 new e2e. 41 app tests
total. All 11 CI gates green locally.
