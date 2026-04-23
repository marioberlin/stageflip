// packages/editor-shell/src/context-menu/matches-target.ts
// Pure selection of the first registered descriptor whose `match`
// predicate claims the event target.

import type { ContextMenuDescriptor } from './types';

/**
 * Walk the registered descriptors in registration order and return the
 * first whose `match` returns true. Disabled descriptors are skipped so
 * a globally-registered fallback can still fire while a scoped menu is
 * temporarily disabled.
 *
 * Returns `null` when no descriptor claims the event — the provider
 * then falls through to the browser's native context menu.
 */
export function pickContextMenu(
  descriptors: ReadonlyArray<ContextMenuDescriptor>,
  target: HTMLElement | null,
): ContextMenuDescriptor | null {
  for (const descriptor of descriptors) {
    if (descriptor.disabled) continue;
    if (descriptor.match(target)) return descriptor;
  }
  return null;
}
