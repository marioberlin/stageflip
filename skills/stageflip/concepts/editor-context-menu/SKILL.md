---
title: Editor Context-Menu Registry
id: skills/stageflip/concepts/editor-context-menu
tier: concept
status: substantive
last_updated: 2026-04-23
owner_task: T-139a
related:
  - skills/stageflip/modes/stageflip-slide/SKILL.md
  - skills/stageflip/concepts/skills-tree/SKILL.md
---

# Editor Context-Menu Registry

`@stageflip/editor-shell`'s right-click dispatcher. Framework-level
primitive: every editor app (slide, video, display) mounts one
`<ContextMenuProvider>` and components register per-target menus
declaratively — same shape as `useRegisterShortcuts` (see the shortcut
registry concept).

## Pieces

| Export | Purpose |
|---|---|
| `<ContextMenuProvider>` | Owns the single `contextmenu` listener + registry. Folded into `<EditorShell>` alongside the shortcut provider. |
| `<ContextMenu />` | Renders the currently-open menu at cursor coordinates. Mounts once, high in the tree. |
| `useRegisterContextMenu(descriptor)` | Subscribe a `ContextMenuDescriptor` for the lifetime of the caller. Re-registration with a stable `id` replaces the prior entry. |
| `useContextMenu()` | Read `openState` + imperative `open` / `close` controls. |
| `useAllContextMenus()` | Reactive snapshot of every registered descriptor (tests + debug). |

## Descriptor shape

```ts
interface ContextMenuDescriptor {
  id: string;
  match: (target: HTMLElement | null) => boolean;
  items: ReadonlyArray<ContextMenuItemSpec>;
  disabled?: boolean;
}

type ContextMenuItemSpec =
  | { type: 'item'; labelKey: string; onSelect: () => void; keybind?: string; disabled?: boolean; destructive?: boolean }
  | { type: 'separator' }
  | { type: 'submenu'; labelKey: string; items: ContextMenuItemSpec[]; disabled?: boolean };
```

Rules:

- `labelKey` is an i18n catalog key; the renderer pipes it through `t()`.
  Bare string literals are drift (CLAUDE.md §10).
- `keybind` is the same combo grammar as `useRegisterShortcuts` — rendered
  by `formatCombo()` so one combo string works cross-platform and stays
  in sync with the shortcut registry.
- `match` runs against the right-click event target. Scoped menus pass
  a `closest('.my-zone')` predicate; app-wide fallbacks pass `() => true`
  and register last.

## Dispatch model

One `contextmenu` listener on `window`. The provider walks registered
descriptors in registration order (disabled ones skipped) and opens the
first matching menu at `event.clientX / Y`. Non-matches let the
browser's native menu fire — scrollbars, the URL bar, and other
out-of-app surfaces keep working.

Global listeners close the open menu on:

- `Escape` keydown
- `mousedown` outside any `[data-stageflip-context-menu]` node

The menu traps keyboard focus while open:

- `ArrowDown` / `ArrowUp` — cycle across activatable items (skips
  separators + disabled rows).
- `Enter` / `Space` — activate the focused item.
- `ArrowRight` — open a focused submenu.
- `ArrowLeft` — close the active submenu.
- `Escape` — close the whole menu.

## Consumer pattern

```tsx
useRegisterContextMenu(
  useMemo(
    () => ({
      id: 'slide-canvas.element',
      match: (el) => !!el?.closest('[data-element-id]'),
      items: [
        {
          type: 'item',
          labelKey: 'common.duplicate',
          keybind: 'Mod+D',
          onSelect: duplicateSelected,
        },
        { type: 'separator' },
        {
          type: 'item',
          labelKey: 'common.delete',
          keybind: 'Backspace',
          destructive: true,
          onSelect: deleteSelected,
        },
      ],
    }),
    [duplicateSelected, deleteSelected],
  ),
);
```

Memoize the descriptor (or its `items` array) so the provider doesn't
treat every render as a fresh registration.

## Provider order inside `<EditorShell>`

```
ShortcutRegistryProvider
  ContextMenuProvider       ← T-139a
    DocumentProvider
      AuthProvider
```

Outside `DocumentProvider` so descriptors stay registered across a
document swap, and outside the shortcut provider only because the
shortcut listener also lives on `window` — the ordering is convenience,
not semantic.

## Invariant — contextual toolbar is read-only for non-text elements

`<ContextualToolbar>` (T-139a) surfaces the selection type + current
values for shape / image / video / table / chart / clip elements as
read-only badges. Editing those properties lives in T-125a's
`<PropertiesPanel>` router (via `ClipElementProperties` / `ChartEditor`
/ `TableEditor` / `AnimationPicker`). One edit surface per element
type — duplicating fill / stroke / crop / filter into the floating
toolbar would fork the mutation path. Text elements are the single
exception: inline typographic controls (bold / italic / alignment)
live directly on the contextual toolbar because they map 1-1 to
contenteditable commands rather than atom mutations.

## Where consumers live

- `apps/stageflip-slide/src/components/**` registers slide-editor menus
  (asset browser right-click, filmstrip right-click, find-replace match
  navigation). T-139b + T-139c are the first consumers; T-139a is the
  framework ships.
- `packages/editor-shell/**` only owns the framework; no in-package
  menus ship today.

## Related

- Shortcut registry (parallel pattern): `shortcuts/shortcut-registry.tsx`
- Slide-mode UI surfaces that consume the menu:
  `skills/stageflip/modes/stageflip-slide/SKILL.md` § UI surfaces
- i18n catalog pattern: `packages/editor-shell/src/i18n/catalog.ts`
