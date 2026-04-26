// packages/editor-shell/src/atoms/index.ts
// Barrel export for the editor-shell atom surface (T-121b).

export {
  __clearElementByIdCacheForTest,
  __clearSlideByIdCacheForTest,
  documentAtom,
  elementByIdAtom,
  slideByIdAtom,
} from './document';
export {
  dismissedLossFlagIdsAtom,
  importLossFlagsAtom,
  visibleLossFlagsAtom,
} from './import-loss-flags';
export { activeSlideIdAtom } from './ui';
export {
  EMPTY_SELECTION,
  selectedElementIdAtom,
  selectedElementIdsAtom,
  selectedSlideIdsAtom,
} from './selection';
export {
  MAX_MICRO_UNDO,
  type MicroUndo,
  canRedoAtom,
  canUndoAtom,
  redoStackAtom,
  undoStackAtom,
} from './undo';
