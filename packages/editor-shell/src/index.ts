// packages/editor-shell/src/index.ts
// Public barrel for @stageflip/editor-shell. Populated by T-121a/b/c.
// T-121a: shortcut registry framework.

export type { FocusZone } from './shortcuts/focus-zone';
export { currentFocusZone, focusIsInZone } from './shortcuts/focus-zone';
export { formatCombo, matchesKeyCombo } from './shortcuts/match-key-combo';
export {
  ShortcutRegistryProvider,
  useAllShortcuts,
  useRegisterShortcuts,
} from './shortcuts/shortcut-registry';
export type { Shortcut, ShortcutCategory } from './shortcuts/types';
