// packages/editor-shell/src/shortcuts/match-key-combo.ts
// Pure matcher + formatter for combo strings against KeyboardEvents.

/**
 * Combo grammar
 * -------------
 * A combo is a `+`-joined token list. The last token is the key; any
 * preceding tokens are modifiers. Modifier tokens are case-insensitive;
 * the key token is parsed verbatim first, then case-folded only if it's
 * a single character.
 *
 *   Modifiers:
 *     Mod    → platform primary — Cmd on macOS, Ctrl elsewhere
 *     Shift
 *     Alt
 *     Ctrl   → literal Ctrl; distinct from Mod on macOS only
 *
 *   Keys:
 *     Named    — ArrowUp/ArrowDown/ArrowLeft/ArrowRight, Escape, Tab,
 *                Enter, Backspace, Delete, Space, F1–F12, `?`, `/`, etc.
 *     Char     — case-insensitive. "a" and "A" both match.
 *
 *   Examples:
 *     Mod+K                → Cmd+K on macOS, Ctrl+K on non-Mac
 *     Mod+Shift+Z          → redo
 *     Escape               → bare Esc
 *     Mod+Alt+Shift+G      → ungroup on macOS
 *
 * Strictness
 * ----------
 * Modifier sets must match exactly. Holding Shift while pressing `Mod+A`
 * is NOT a `Mod+A` match — the chord `A` does not match `Cmd+A` either.
 * This is deliberate: predictable behavior under fat-finger chords.
 *
 * Platform
 * --------
 * On macOS: Mod ≡ metaKey; Ctrl is independent. On non-Mac: Mod ≡ ctrlKey
 * and metaKey is ignored (Windows key carries no combo semantics). A combo
 * that names both Mod AND Ctrl can only ever fire on macOS because non-Mac
 * would need two physical Ctrl keys.
 */

// Platform detection is module-scoped + lazily memoized. Tests flip it
// via `__setIsMacForTest`. SSR callers return `false` without caching so
// the client-side probe runs on first real use.
let platformIsMac: boolean | null = null;

function detectMac(): boolean {
  if (platformIsMac !== null) return platformIsMac;
  if (typeof navigator === 'undefined') return false;
  platformIsMac = /Mac|iPhone|iPad/.test(navigator.platform);
  return platformIsMac;
}

export function __setIsMacForTest(value: boolean | null): void {
  platformIsMac = value;
}

// Modifier token bits — four flags packed into a nibble. Parsing a combo
// produces one of these bitmasks plus a key; matching compares the event's
// modifier bits against the parsed bits directly.
const MOD_BIT = 0b0001;
const SHIFT_BIT = 0b0010;
const ALT_BIT = 0b0100;
const CTRL_BIT = 0b1000;

const MODIFIER_BIT_BY_TOKEN: Record<string, number> = {
  mod: MOD_BIT,
  shift: SHIFT_BIT,
  alt: ALT_BIT,
  ctrl: CTRL_BIT,
};

interface ComboParts {
  modifiers: number;
  key: string;
}

function canonicalKey(token: string): string {
  if (token === 'Space') return ' ';
  return token.length === 1 ? token.toLowerCase() : token;
}

function parseCombo(combo: string): ComboParts {
  const tokens = combo.split('+');
  if (tokens.length === 0) return { modifiers: 0, key: '' };
  // Mutate a local: walk modifier tokens first, then consume the last.
  const keyToken = tokens[tokens.length - 1] ?? '';
  let modifiers = 0;
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const token = tokens[i]?.trim().toLowerCase();
    if (!token) continue;
    const bit = MODIFIER_BIT_BY_TOKEN[token];
    if (bit !== undefined) modifiers |= bit;
  }
  return { modifiers, key: canonicalKey(keyToken.trim()) };
}

function eventModifiers(event: KeyboardEvent, mac: boolean): number {
  let bits = 0;
  // On macOS, Mod is Cmd (metaKey) and Ctrl is a separate physical key.
  // On non-Mac, the two conflate: Ctrl IS Mod, and metaKey is ignored.
  if (mac) {
    if (event.metaKey) bits |= MOD_BIT;
    if (event.ctrlKey) bits |= CTRL_BIT;
  } else {
    if (event.ctrlKey) bits |= MOD_BIT;
  }
  if (event.shiftKey) bits |= SHIFT_BIT;
  if (event.altKey) bits |= ALT_BIT;
  return bits;
}

/**
 * Test whether a KeyboardEvent matches a combo string under the platform's
 * primary-modifier mapping.
 */
export function matchesKeyCombo(event: KeyboardEvent, combo: string): boolean {
  const parsed = parseCombo(combo);
  const mac = detectMac();
  if (eventModifiers(event, mac) !== parsed.modifiers) return false;
  const rawKey = event.key;
  const eventKey = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey;
  return eventKey === parsed.key;
}

// Display formatting ---------------------------------------------------------

// Glyph order on macOS follows Apple HIG: Ctrl, Alt (Option), Shift, Cmd.
// Non-Mac falls back to the same order with plus separators and word names.
// Keyed by bit, iterated in display order.
const MODIFIER_DISPLAY_ORDER: ReadonlyArray<{ bit: number; mac: string; other: string }> = [
  { bit: CTRL_BIT, mac: '⌃', other: 'Ctrl' },
  { bit: ALT_BIT, mac: '⌥', other: 'Alt' },
  { bit: SHIFT_BIT, mac: '⇧', other: 'Shift' },
  { bit: MOD_BIT, mac: '⌘', other: 'Ctrl' },
];

const NAMED_KEY_GLYPHS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Escape: 'Esc',
  Enter: '↵',
  Tab: '⇥',
  Backspace: '⌫',
  Delete: 'Del',
  ' ': 'Space',
};

function keyDisplay(key: string): string {
  const glyph = NAMED_KEY_GLYPHS[key];
  if (glyph !== undefined) return glyph;
  return key.length === 1 ? key.toUpperCase() : key;
}

/**
 * Render a combo for display. macOS emits concatenated glyphs (`⌘⇧Z`);
 * non-Mac emits plus-separated names (`Ctrl+Shift+Z`).
 */
export function formatCombo(combo: string): string {
  const parsed = parseCombo(combo);
  const mac = detectMac();
  const separator = mac ? '' : '+';
  const pieces: string[] = [];
  for (const entry of MODIFIER_DISPLAY_ORDER) {
    if ((parsed.modifiers & entry.bit) === 0) continue;
    pieces.push(mac ? entry.mac : entry.other);
  }
  pieces.push(keyDisplay(parsed.key));
  return pieces.join(separator);
}
