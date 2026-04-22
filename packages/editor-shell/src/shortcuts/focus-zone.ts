// packages/editor-shell/src/shortcuts/focus-zone.ts
// Focus-zone detection for context-aware shortcut routing.

/**
 * Shortcuts like Cmd+D, Cmd+ArrowUp, and Cmd+Shift+ArrowDown carry
 * different meanings depending on where focus lives:
 *
 *   `filmstrip` — slide thumbnail rail: Cmd+D duplicates the slide,
 *                  Cmd+ArrowUp reorders earlier.
 *   `canvas`    — slide editing surface: Cmd+D duplicates the element,
 *                  Cmd+ArrowUp brings forward in z-order.
 *   `other`     — property panels, AI copilot, etc. — these shortcuts
 *                  decline.
 *
 * Containers opt in by setting `data-focus-zone="filmstrip" | "canvas"`.
 * Add `tabIndex={0}` if the container isn't already focusable. This
 * helper is the single source of truth for routing; don't read the
 * attribute directly at call sites.
 */

export type FocusZone = 'filmstrip' | 'canvas' | 'other';

export function currentFocusZone(): FocusZone {
  if (typeof document === 'undefined') return 'other';
  const active = document.activeElement;
  if (!active) return 'other';
  const zone = (active as HTMLElement).closest('[data-focus-zone]');
  if (!zone) return 'other';
  const value = zone.getAttribute('data-focus-zone');
  if (value === 'filmstrip' || value === 'canvas') return value;
  return 'other';
}

export function focusIsInZone(zone: FocusZone): boolean {
  return currentFocusZone() === zone;
}
