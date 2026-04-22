// packages/editor-shell/src/shortcuts/focus-zone.test.ts
// Verifies focus-zone routing via the `data-focus-zone` attribute.

import { afterEach, describe, expect, it } from 'vitest';
import { currentFocusZone, focusIsInZone } from './focus-zone';

afterEach(() => {
  while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
});

function mountZone(zoneValue: string | null): HTMLInputElement {
  const host = document.createElement('div');
  if (zoneValue !== null) host.setAttribute('data-focus-zone', zoneValue);
  const input = document.createElement('input');
  host.appendChild(input);
  document.body.appendChild(host);
  input.focus();
  return input;
}

describe('currentFocusZone', () => {
  it('returns "filmstrip" when focus is inside a filmstrip zone', () => {
    mountZone('filmstrip');
    expect(currentFocusZone()).toBe('filmstrip');
  });

  it('returns "canvas" when focus is inside a canvas zone', () => {
    mountZone('canvas');
    expect(currentFocusZone()).toBe('canvas');
  });

  it('returns "other" when focus has no data-focus-zone ancestor', () => {
    mountZone(null);
    expect(currentFocusZone()).toBe('other');
  });

  it('returns "other" when the zone attribute is unknown', () => {
    mountZone('sidebar-not-a-known-zone');
    expect(currentFocusZone()).toBe('other');
  });
});

describe('focusIsInZone', () => {
  it('true when focus matches', () => {
    mountZone('filmstrip');
    expect(focusIsInZone('filmstrip')).toBe(true);
  });

  it('false when focus is elsewhere', () => {
    mountZone('canvas');
    expect(focusIsInZone('filmstrip')).toBe(false);
  });
});
