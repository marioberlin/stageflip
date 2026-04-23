// packages/editor-shell/src/context-menu/types.ts
// Context-menu registry types — item shapes and targeting predicates.

/**
 * The context-menu framework mirrors the shortcut registry (T-121a):
 * components call `useRegisterContextMenu(descriptor)` and the single
 * provider dispatches right-click events to the most-specific match.
 *
 * Each descriptor carries a `match` predicate evaluated against the
 * DOM target of the `contextmenu` event. Registration order matters
 * only as a tiebreaker — the first registered descriptor wins when
 * two match the same event, consistent with the shortcut-registry
 * convention.
 *
 * `items` is a stable array of item specs. The renderer walks it
 * top-down and produces either a clickable row, a separator, or a
 * nested submenu container.
 */

/**
 * A predicate over a right-click's original target. The element argument
 * is the event's `target` narrowed to HTMLElement (null when the target
 * isn't an element, e.g. a text node). Return true to claim the event.
 */
export type ContextMenuMatch = (target: HTMLElement | null) => boolean;

/**
 * Activatable row. `label` is a catalog key resolved via `t(key)` at
 * render-time — consumers never pre-format the label themselves so the
 * pseudo-locale QA mode (`setLocale('pseudo')`) flags untranslated
 * entries automatically.
 */
export interface ContextMenuItem {
  type: 'item';
  /** i18n key. Rendered via `t(labelKey)`. */
  labelKey: string;
  /** Invoked on click or Enter. */
  onSelect: () => void;
  /** Raw combo string formatted by the renderer via `formatCombo`. */
  keybind?: string;
  disabled?: boolean;
  /** Red tinting for destructive actions (delete, clear, etc.). */
  destructive?: boolean;
}

/** Visual divider. No interaction. */
export interface ContextMenuSeparator {
  type: 'separator';
}

/**
 * Nested branch. `items` is evaluated the same way as the top-level
 * `items`; nesting depth is not bounded but two levels is the practical
 * maximum in the Phase 6 UI.
 */
export interface ContextMenuSubmenu {
  type: 'submenu';
  labelKey: string;
  items: ReadonlyArray<ContextMenuItemSpec>;
  disabled?: boolean;
}

export type ContextMenuItemSpec = ContextMenuItem | ContextMenuSeparator | ContextMenuSubmenu;

/**
 * A registered menu. `id` is stable; the registry stores descriptors in
 * a Map keyed on id so re-registration (stable id with new item list)
 * replaces the existing entry rather than appending a duplicate.
 */
export interface ContextMenuDescriptor {
  id: string;
  match: ContextMenuMatch;
  items: ReadonlyArray<ContextMenuItemSpec>;
  /** Disable the whole menu (Radix-parity with the reference). */
  disabled?: boolean;
}

/**
 * Open-menu state. Null means closed. Position is viewport-space coords
 * from the `contextmenu` event.
 */
export interface OpenContextMenuState {
  descriptor: ContextMenuDescriptor;
  x: number;
  y: number;
}
