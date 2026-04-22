---
"@stageflip/app-slide": minor
---

T-127: `<CommandPalette>` — searchable modal dispatching local commands.

Ports the SlideMotion command palette to the Remotion-free editor.
Phase 7 (agent/engine tool router) will feed additional entries into
the same declarative `PaletteCommand` registry without touching the
UI shape.

- **`commands.ts`** — plain-data `PaletteCommand[]` with `id`, `label`,
  `category` (`slide` / `selection` / `edit` / `view` / `help`),
  optional `shortcut` label, and a `run(ctx)` closure. Pure
  `filterCommands(cmds, query)` (case-insensitive substring across
  label + category + shortcut) drives the list.
- **Default commands** wired via `useDocument`:
  - `slide.new` — appends a blank slide, activates it.
  - `slide.duplicate` — clones the active slide, activates the copy.
  - `slide.delete` — removes the active slide (refuses when the deck
    would be orphaned); active-slide rolls to the adjacent id.
  - `selection.clear` — calls `clearSelection`.
  - `help.palette` — UI placeholder that simply closes the palette.
- **`<CommandPalette>`** — `<dialog>`-based modal with `role` semantics
  for the listbox items. Auto-focuses the input on open, `ArrowDown` /
  `ArrowUp` move the cursor, `Enter` runs, `Escape` or backdrop click
  dismisses. Commands can return `false` to leave the palette open
  (validation errors).
- **App wiring** — `<EditorFrame>` registers a `Mod+K` shortcut via
  `useRegisterShortcuts` to open the palette, plus a toolbar button
  next to the mode toggle. The palette mounts once per editor frame
  and reads document state through `useDocument`.

Tests: 13 new vitest cases (6 commands + 9 palette) + 1 e2e. 104 app
tests + 9 e2e, all green. All 11 CI gates clean. No new deps.

Follow-up (noted in code, not this PR): the editor-shell
`ShortcutHandler` return type is strict enough to reject block-body
arrows that return `void`. The app currently works around it with
`return undefined` in the Mod+K handler. A small editor-shell bump
to accept `void` returns via `biome-ignore` is worthwhile.
