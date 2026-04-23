---
'@stageflip/app-slide': minor
'@stageflip/editor-shell': minor
---

T-139b — asset browser + import dialogs + export dialog ported from
the SlideMotion reference, plus a `clampToViewport` helper landed on
T-139a's context menu to satisfy the reviewer's mandatory ship-blocker
for near-edge right-clicks.

Editor-shell framework additions:

- `assetsAtom` / `addAssetAtom` / `removeAssetAtom` / `replaceAssetsAtom`
  / `selectedAssetIdAtom` / `selectedAssetAtom` — Jotai registry for
  the editor's in-memory asset list with append-only semantics and a
  derived selected-asset lookup.
- `clampToViewport` pure helper + a `useLayoutEffect` wire-up inside
  `<ContextMenu>` to flip near-edge anchors instead of rendering
  partially off-screen (closes T-139a reviewer ship-blocker).

App-slide UI additions:

- `<AssetBrowser>` grid panel with drag-to-canvas + right-click
  context menu consuming T-139a's registry.
- `<GoogleSlidesImport>` dialog (feature-flagged — caller injects
  `onFetchDeck`; OAuth backend is separate infra).
- `<PptxImport>` dialog (stub with visible feature-flag banner;
  real OOXML parser pending license review — tracked as T-139b.1).
- `<ImageUpload>` dialog with size-guard + MIME filter, appending
  to `assetsAtom`.
- `<ExportDialog>` with resolution / format / range controls,
  dispatching to the existing `@stageflip/renderer-cdp` pipeline.

New i18n keys under `assets.*`, `import.google.*`, `import.pptx.*`,
`import.image.*`, and `export.*`.
