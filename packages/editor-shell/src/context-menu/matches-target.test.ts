// packages/editor-shell/src/context-menu/matches-target.test.ts
// Unit tests for the pure descriptor-picker.

import { describe, expect, it } from 'vitest';
import { pickContextMenu } from './matches-target';
import type { ContextMenuDescriptor } from './types';

function makeDescriptor(
  id: string,
  match: (el: HTMLElement | null) => boolean,
  disabled?: boolean,
): ContextMenuDescriptor {
  return {
    id,
    match,
    items: [],
    ...(disabled !== undefined ? { disabled } : {}),
  };
}

describe('pickContextMenu', () => {
  it('returns null when no descriptor matches', () => {
    const result = pickContextMenu([makeDescriptor('a', () => false)], null);
    expect(result).toBeNull();
  });

  it('returns the first matching descriptor in registration order', () => {
    const first = makeDescriptor('first', () => true);
    const second = makeDescriptor('second', () => true);
    expect(pickContextMenu([first, second], null)?.id).toBe('first');
  });

  it('skips disabled descriptors even when their match predicate passes', () => {
    const disabledMatch = makeDescriptor('disabled', () => true, true);
    const enabledMatch = makeDescriptor('enabled', () => true);
    expect(pickContextMenu([disabledMatch, enabledMatch], null)?.id).toBe('enabled');
  });

  it('forwards the target element to the match predicate', () => {
    const el = { tagName: 'DIV' } as HTMLElement;
    let received: HTMLElement | null | undefined;
    const descriptor = makeDescriptor('probe', (t) => {
      received = t;
      return true;
    });
    pickContextMenu([descriptor], el);
    expect(received).toBe(el);
  });
});
