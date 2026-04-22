// packages/editor-shell/src/shortcuts/match-key-combo.test.ts
// Matcher + formatter tests across macOS and non-Mac platforms.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __setIsMacForTest, formatCombo, matchesKeyCombo } from './match-key-combo';

type EventInit = {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
};

function makeEvent(opts: EventInit): KeyboardEvent {
  return {
    key: opts.key,
    metaKey: opts.meta ?? false,
    ctrlKey: opts.ctrl ?? false,
    shiftKey: opts.shift ?? false,
    altKey: opts.alt ?? false,
  } as KeyboardEvent;
}

afterEach(() => {
  __setIsMacForTest(null);
});

describe('matchesKeyCombo on macOS', () => {
  beforeEach(() => {
    __setIsMacForTest(true);
  });

  it('matches Mod+K when Cmd+K is pressed', () => {
    expect(matchesKeyCombo(makeEvent({ key: 'k', meta: true }), 'Mod+K')).toBe(true);
  });

  it('matches the key letter case-insensitively', () => {
    expect(matchesKeyCombo(makeEvent({ key: 'K', meta: true }), 'Mod+K')).toBe(true);
  });

  it('does NOT match Mod+K on bare Ctrl+K (Ctrl != Mod on macOS)', () => {
    expect(matchesKeyCombo(makeEvent({ key: 'k', ctrl: true }), 'Mod+K')).toBe(false);
  });

  it('matches Mod+Shift+Z (redo)', () => {
    expect(matchesKeyCombo(makeEvent({ key: 'z', meta: true, shift: true }), 'Mod+Shift+Z')).toBe(
      true,
    );
  });

  it('rejects Mod+Z when Shift is also held (strict matching)', () => {
    expect(matchesKeyCombo(makeEvent({ key: 'z', meta: true, shift: true }), 'Mod+Z')).toBe(false);
  });

  it('matches named keys like Escape', () => {
    expect(matchesKeyCombo(makeEvent({ key: 'Escape' }), 'Escape')).toBe(true);
  });

  it('matches ArrowUp with Mod modifier', () => {
    expect(matchesKeyCombo(makeEvent({ key: 'ArrowUp', meta: true }), 'Mod+ArrowUp')).toBe(true);
  });

  it('rejects bare ArrowUp when the event carried Mod', () => {
    expect(matchesKeyCombo(makeEvent({ key: 'ArrowUp', meta: true }), 'ArrowUp')).toBe(false);
  });

  it('matches Mod+Alt+Shift+G', () => {
    expect(
      matchesKeyCombo(
        makeEvent({ key: 'g', meta: true, alt: true, shift: true }),
        'Mod+Alt+Shift+G',
      ),
    ).toBe(true);
  });

  it('distinguishes literal Ctrl from Mod on macOS', () => {
    expect(matchesKeyCombo(makeEvent({ key: 'k', ctrl: true }), 'Ctrl+K')).toBe(true);
    expect(matchesKeyCombo(makeEvent({ key: 'k', ctrl: true }), 'Mod+K')).toBe(false);
  });

  it('matches Space via the Space token', () => {
    expect(matchesKeyCombo(makeEvent({ key: ' ' }), 'Space')).toBe(true);
  });

  it('matches the bare ? combo', () => {
    expect(matchesKeyCombo(makeEvent({ key: '?', shift: true }), 'Shift+?')).toBe(true);
  });
});

describe('matchesKeyCombo on non-Mac (Ctrl == Mod)', () => {
  beforeEach(() => {
    __setIsMacForTest(false);
  });

  it('matches Mod+K on Ctrl+K', () => {
    expect(matchesKeyCombo(makeEvent({ key: 'k', ctrl: true }), 'Mod+K')).toBe(true);
  });

  it('does NOT match Mod+K on Meta (Windows key) press', () => {
    expect(matchesKeyCombo(makeEvent({ key: 'k', meta: true }), 'Mod+K')).toBe(false);
  });

  it('Mod+Ctrl combo is unmatchable on non-Mac (only one physical Ctrl)', () => {
    expect(matchesKeyCombo(makeEvent({ key: 'k', ctrl: true }), 'Mod+Ctrl+K')).toBe(false);
  });
});

describe('formatCombo', () => {
  it('emits macOS glyphs on Mac', () => {
    __setIsMacForTest(true);
    expect(formatCombo('Mod+Shift+Z')).toBe('⇧⌘Z');
    expect(formatCombo('Escape')).toBe('Esc');
    expect(formatCombo('Mod+ArrowUp')).toBe('⌘↑');
    expect(formatCombo('Mod+Alt+Shift+G')).toBe('⌥⇧⌘G');
  });

  it('emits Ctrl+ style on non-Mac', () => {
    __setIsMacForTest(false);
    expect(formatCombo('Mod+Shift+Z')).toBe('Shift+Ctrl+Z');
    expect(formatCombo('Mod+ArrowUp')).toBe('Ctrl+↑');
    expect(formatCombo('Escape')).toBe('Esc');
  });

  it('returns the raw single char uppercased for display', () => {
    __setIsMacForTest(false);
    expect(formatCombo('Mod+K')).toBe('Ctrl+K');
  });
});
