// packages/editor-shell/src/atoms/ui.ts
// View-level UI state that is NOT part of the persisted document model.

/**
 * Which slide is currently displayed in the canvas. `''` means no active
 * slide — the filmstrip picks the first slide on hydrate. Kept separate
 * from `selectedSlideIdsAtom`: the active slide is the one the canvas
 * renders; the selected slide set is what filmstrip multi-actions target.
 *
 * Future additions live in this module: zoom, editor mode (create / edit
 * / present), panel visibility, timeline scrubber frame. Splitting per
 * state keeps each subscription narrow.
 */

import { atom } from 'jotai';

export const activeSlideIdAtom = atom<string>('');
