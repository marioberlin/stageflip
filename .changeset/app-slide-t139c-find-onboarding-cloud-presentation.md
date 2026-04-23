---
'@stageflip/app-slide': minor
'@stageflip/editor-shell': minor
---

T-139c — find/replace + first-run onboarding + cloud-save panel +
presentation mode, ported from the SlideMotion reference as a fresh
implementation against the StageFlip primitives.

Editor-shell framework additions:

- `findMatches` / `replaceAll` pure text search + transaction-wrapped
  document rewrite, plus `findHighlightsAtom` so the canvas overlay
  can render match rectangles without the dialog owning render
  coordinates.
- `CloudSaveAdapter` contract + `createStubCloudSaveAdapter()`
  in-memory implementation with `__simulateConflict` / `__simulateError`
  test hooks. Phase 12's `@stageflip/collab` will swap in a real
  Firestore adapter against the same contract.

App-slide UI additions:

- `<FindReplace>` dialog — regex / case / whole-word toggles,
  next/previous navigation, replace-all funneled through one
  transaction. Mounted at the editor root; `Mod+F` opens.
- `<FindHighlightsOverlay>` — canvas layer above `<SelectionOverlay>`
  that paints match rectangles tied to `findHighlightsAtom`.
- `<Onboarding>` — step-indexed coachmark tour. Anchors use existing
  `data-testid` selectors; first-mount flag persists in
  `localStorage`. Mounted at the editor root; shows once per browser
  profile.
- `<CloudSavePanel>` — save / saving / saved / conflict / error
  state machine with a keep-local / keep-remote conflict UI. Toggled
  from the header's `nav.cloud` button.
- `<PresentationMode>` — full-screen slide player with keyboard nav
  (arrow keys / space / Enter / Backspace / Esc / s). `Mod+Enter`
  enters; the persistent-toolbar Present button also enters.

New i18n keys under `findReplace.*`, `onboarding.coachmark.*`,
`cloudSave.*`, and `presentation.*`.
