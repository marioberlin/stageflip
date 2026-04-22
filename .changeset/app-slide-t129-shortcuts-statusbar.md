---
'@stageflip/app-slide': minor
---

T-129 first tranche — `<ShortcutCheatSheet>` + `<StatusBar>` land as
native Slide-mode components.

- `<ShortcutCheatSheet>` (searchable modal) reads the live shortcut
  set via `useAllShortcuts()`, groups by `ShortcutCategory`, filters
  on description / combo text, Escape + close button both dismiss.
  Opens via the new `?` shortcut (gated by `isNotEditingText()` so
  typing `?` in the inline text editor doesn't trigger it).
- `<StatusBar>` shows total slide + element counts across the whole
  document.

Deferred tranches (asset browser, context menu, export / import
dialogs, find/replace, onboarding, cloud-save panel, presentation
mode, collaboration UI) are tracked as post-Phase-6 follow-ups on the
implementation-plan row — scope would balloon the L-sized task well
past its window.

Tests: app-slide 168 → 179 (+11 — 8 cheat-sheet, 3 status-bar). All
11 CI gates green.
