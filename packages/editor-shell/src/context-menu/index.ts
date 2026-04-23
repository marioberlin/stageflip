// packages/editor-shell/src/context-menu/index.ts
// Barrel for the context-menu framework (T-139a).

export { ContextMenu } from './context-menu';
export {
  ContextMenuProvider,
  useAllContextMenus,
  useContextMenu,
  useRegisterContextMenu,
} from './context-menu-provider';
export { pickContextMenu } from './matches-target';
export type {
  ContextMenuDescriptor,
  ContextMenuItem,
  ContextMenuItemSpec,
  ContextMenuMatch,
  ContextMenuSeparator,
  ContextMenuSubmenu,
  OpenContextMenuState,
} from './types';
