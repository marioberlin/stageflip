---
'@stageflip/editor-shell': minor
'@stageflip/app-slide': minor
---

T-139a — context-menu framework + persistent + contextual toolbars.
Adds `<ContextMenuProvider>` + `useRegisterContextMenu` + `useContextMenu`
+ `<ContextMenu>` to `@stageflip/editor-shell`, mirroring the shortcut
registry's descriptor-based pattern. Single `contextmenu` listener on
`window`; the first descriptor whose `match(target)` predicate passes
opens the menu at the cursor; non-matches let the browser's native
menu fire. Keyboard navigable (arrows + Enter + ArrowRight into
submenus + Escape). Labels route through the i18n catalog (`t(key)`)
and keybinds through `formatCombo()` so menu hints stay in sync with
the shortcut registry on both platforms.

Adds `<PersistentToolbar>` (top-of-canvas global actions: new slide,
undo / redo with disabled-state gating, zoom stepper, present toggle,
slide counter) and `<ContextualToolbar>` (selection-routed floating
toolbar with text / shape / image variants, optional viewport-space
anchor prop) to `apps/stageflip-slide`. Unblocks T-139b's asset
browser right-click and T-139c's find-replace match navigation.
