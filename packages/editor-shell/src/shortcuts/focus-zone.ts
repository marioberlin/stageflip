// packages/editor-shell/src/shortcuts/focus-zone.ts
// Focus-zone detection for context-aware shortcut routing.

/**
 * Shortcut routing
 * ----------------
 * Shortcuts like Cmd+D, Cmd+ArrowUp, and Cmd+Shift+ArrowDown carry
 * different meanings depending on where focus lives:
 *
 *   filmstrip — slide thumbnail rail: Cmd+D duplicates the slide;
 *                Cmd+ArrowUp reorders slides.
 *   canvas    — slide editing surface: Cmd+D duplicates the element;
 *                Cmd+ArrowUp brings the selection forward in z-order.
 *   other     — property panels, AI copilot, etc. Focus-routed shortcuts
 *                decline.
 *
 * Containers opt into a zone by setting `data-focus-zone="filmstrip"` or
 * `data-focus-zone="canvas"` on an ancestor of the focusable element
 * (add `tabIndex={0}` if the container isn't already focusable). Any
 * other attribute value is treated as `other`.
 *
 * This module is the single source of truth; do not read the attribute
 * directly at call sites — routing logic must stay consistent.
 */

export type FocusZone = 'filmstrip' | 'canvas' | 'other';

const ZONE_SELECTOR = '[data-focus-zone]';
const ZONE_ATTRIBUTE = 'data-focus-zone';
const VALID_ZONES = new Set<FocusZone>(['filmstrip', 'canvas']);

function isFocusZoneValue(
  value: string | null,
): value is Extract<FocusZone, 'filmstrip' | 'canvas'> {
  return value !== null && VALID_ZONES.has(value as FocusZone);
}

export function currentFocusZone(): FocusZone {
  if (typeof document === 'undefined') return 'other';
  const active = document.activeElement;
  if (!(active instanceof Element)) return 'other';
  const container = active.closest(ZONE_SELECTOR);
  if (!container) return 'other';
  const raw = container.getAttribute(ZONE_ATTRIBUTE);
  return isFocusZoneValue(raw) ? raw : 'other';
}

export function focusIsInZone(zone: FocusZone): boolean {
  return currentFocusZone() === zone;
}
