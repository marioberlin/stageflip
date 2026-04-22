// packages/editor-shell/src/shortcuts/match-key-combo.ts
// Pure matcher + formatter for combo strings against KeyboardEvents.

/**
 * Combo grammar — tokens joined by `+`, last token is the key, preceding
 * tokens are modifiers.
 *
 *   Modifiers:
 *     Mod    — Cmd on macOS, Ctrl elsewhere
 *     Shift
 *     Alt
 *     Ctrl   — literal Ctrl (distinct from Mod on macOS only)
 *
 *   Keys:
 *     Named: `ArrowUp`, `Escape`, `Tab`, `Enter`, `Backspace`, `Delete`,
 *            `Space`, `?`, `/`, `F1`…
 *     Single char: case-insensitive. `a` and `A` both match.
 *
 *   Examples:
 *     "Mod+K"           Cmd+K on macOS, Ctrl+K elsewhere
 *     "Mod+Shift+Z"     redo
 *     "Escape"          bare Esc
 *     "Mod+Alt+Shift+G" ungroup on macOS
 *
 * Strict matching: extra modifiers held beyond what the combo specifies
 * cause a miss. `"A"` does NOT match Cmd+A. Predictable fat-finger behavior.
 */

let isMacCached: boolean | null = null;

function isMac(): boolean {
  if (isMacCached !== null) return isMacCached;
  if (typeof navigator === 'undefined') return false;
  isMacCached = /Mac|iPhone|iPad/.test(navigator.platform);
  return isMacCached;
}

/** Test-only override. `null` clears the cache so the next call re-probes. */
export function __setIsMacForTest(value: boolean | null): void {
  isMacCached = value;
}

interface ParsedCombo {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  key: string;
}

function normalizeKey(raw: string): string {
  if (raw === 'Space') return ' ';
  if (raw.length === 1) return raw.toLowerCase();
  return raw;
}

function parseCombo(combo: string): ParsedCombo {
  const tokens = combo.split('+').map((t) => t.trim());
  const keyToken = tokens[tokens.length - 1] ?? '';
  const mods = new Set(tokens.slice(0, -1).map((t) => t.toLowerCase()));
  return {
    mod: mods.has('mod'),
    shift: mods.has('shift'),
    alt: mods.has('alt'),
    ctrl: mods.has('ctrl'),
    key: normalizeKey(keyToken),
  };
}

/**
 * Test whether a KeyboardEvent matches the given combo string under the
 * platform's primary-modifier mapping.
 *
 * On macOS: Mod === Cmd (metaKey); Ctrl is independent.
 * On non-Mac: Mod === Ctrl; metaKey (Windows key) is ignored. A combo that
 * demands both Mod and Ctrl on non-Mac can never fire because they'd map
 * to the same physical key.
 */
export function matchesKeyCombo(event: KeyboardEvent, combo: string): boolean {
  const p = parseCombo(combo);
  const mac = isMac();
  const primaryModHeld = mac ? event.metaKey : event.ctrlKey;
  const literalCtrlHeld = mac ? event.ctrlKey : false;

  if (p.mod !== primaryModHeld) return false;
  if (p.ctrl !== literalCtrlHeld) return false;
  if (p.shift !== event.shiftKey) return false;
  if (p.alt !== event.altKey) return false;

  const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return eventKey === p.key;
}

/**
 * Render a combo for display. macOS gets glyphs (`⌘⇧Z`); other platforms
 * get plus-separated names (`Ctrl+Shift+Z`).
 */
export function formatCombo(combo: string): string {
  const p = parseCombo(combo);
  const mac = isMac();
  const parts: string[] = [];
  if (p.ctrl) parts.push(mac ? '⌃' : 'Ctrl');
  if (p.alt) parts.push(mac ? '⌥' : 'Alt');
  if (p.shift) parts.push(mac ? '⇧' : 'Shift');
  if (p.mod) parts.push(mac ? '⌘' : 'Ctrl');
  parts.push(formatKeyDisplay(p.key));
  return parts.join(mac ? '' : '+');
}

const KEY_DISPLAY: Record<string, string> = {
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

function formatKeyDisplay(key: string): string {
  const mapped = KEY_DISPLAY[key];
  if (mapped !== undefined) return mapped;
  if (key.length === 1) return key.toUpperCase();
  return key;
}
