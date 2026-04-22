// packages/editor-shell/src/shortcuts/types.ts
// Shortcut registry types — bindings, categories, and handler contract.

/**
 * Category for the searchable cheat sheet. Categories group shortcuts by
 * the user-facing activity they belong to, not by implementation layer.
 */
export type ShortcutCategory =
  | 'essential'
  | 'slide'
  | 'object'
  | 'selection'
  | 'text'
  | 'navigation'
  | 'presentation'
  | 'help';

/**
 * A named binding of a platform-agnostic combo string to a keydown handler.
 *
 * `combo` grammar is documented in `./match-key-combo.ts`. `Mod` resolves to
 * Cmd on macOS, Ctrl elsewhere, so a single combo string works cross-platform.
 *
 * `when` gates the handler on runtime predicates (focus zone, selection
 * shape, etc.); a `false` return skips the binding and the registry tries
 * the next matching shortcut.
 *
 * Sync handlers can return `false` to decline the event after the fact —
 * iteration continues, browser defaults survive. Async handlers are always
 * treated as claiming the event because `preventDefault()` must run
 * synchronously for browsers to honor it.
 */
export interface Shortcut {
  id: string;
  combo: string;
  description: string;
  category: ShortcutCategory;
  when?: () => boolean;
  handler: ShortcutHandler;
}

/**
 * Handler return contract.
 *
 * No return / `undefined`  → handled; registry claims the event.
 * `false`                  → declined; registry tries the next match.
 * `Promise<…>`             → handled; registry claims immediately
 *                            (preventDefault must run synchronously, so
 *                            post-hoc decline cannot survive).
 *
 * `void` (not `undefined`) is deliberate: `useCallback(() => { … })` in
 * consumer components is inferred as `() => void`, and narrowing the
 * union to `undefined` would reject those handlers under strict mode.
 */
export type ShortcutHandler = (
  event: KeyboardEvent,
) => boolean | undefined | Promise<boolean | undefined>;
