---
'@stageflip/editor-shell': minor
'@stageflip/app-slide': minor
---

T-140 — Phase 6 closeout sweep. Bundles the seven hygiene follow-ups
the T-139a + T-139c reviewers flagged as non-blocking.

`@stageflip/editor-shell`:

- `<ContextMenuProvider>` drops the defensive window-level Escape
  listener. The menu root auto-focuses on open via `useLayoutEffect`
  and owns Escape dispatch through its element-level `onKeyDown`.
  Keeps the shortcut registry as the singleton keydown owner
  (CLAUDE.md §10 spirit).
- Catalog: `toolbar.persistent.ariaLabel` added;
  `findReplace.contextMenu.replaceOne` + `.skip` removed (seeded but
  unused by T-139c).
- Context-menu SKILL.md documents the "contextual toolbar is
  read-only for non-text elements; editing lives in PropertiesPanel"
  invariant.

`@stageflip/app-slide`:

- `<PersistentToolbar>` migrates its bare `aria-label` literal to
  `t('toolbar.persistent.ariaLabel')`.
- `editor-app-client` replaces `Math.random()`-minted slide ids with
  a monotonic counter seeded from the maximum pre-existing
  `slide-N` suffix; collision-free across session reloads.
- `<PresentationMode>` + `<ModalShell>` migrate their raw
  `window.addEventListener('keydown', ...)` listeners to
  `useRegisterShortcuts`; the registry now owns every keyboard
  shortcut in the app.
- Tests updated to exercise the new dispatch paths (keydown
  dispatched on the menu root for the context-menu Escape
  regression).

No behaviour change beyond the reviewer-flagged items; all 314
`@stageflip/app-slide` tests + 263 `@stageflip/editor-shell` tests
still pass.
