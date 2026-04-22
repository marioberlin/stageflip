---
"@stageflip/editor-shell": minor
---

T-121a: initial public surface — shortcut registry framework.

- `Shortcut` + `ShortcutCategory` + `ShortcutHandler` types.
- `matchesKeyCombo(event, combo)` — platform-aware (Mod → Cmd/Ctrl),
  strict matching, Space + named-key support.
- `formatCombo(combo)` — macOS glyphs vs plus-separated display.
- `currentFocusZone()` / `focusIsInZone(zone)` — `data-focus-zone`
  attribute-based routing for context-aware shortcuts.
- `<ShortcutRegistryProvider>`, `useRegisterShortcuts(list)`,
  `useAllShortcuts()` — one global `keydown` listener, input-target
  suppression for bare-key combos, sync decline chaining, async =
  eager preventDefault, `useSyncExternalStore`-backed snapshot.

Zero UI; pure framework. Consumed by T-121c (shell composition) and
every T-123..T-129 component port that registers shortcuts.
