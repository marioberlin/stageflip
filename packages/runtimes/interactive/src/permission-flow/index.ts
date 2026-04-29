// packages/runtimes/interactive/src/permission-flow/index.ts
// Public surface of the permission-flow UX layer (T-385). Re-exported from
// the package root via `./src/index.ts` and exposed as a subpath export
// (`@stageflip/runtimes-interactive/permission-flow`) for consumers who
// want narrow imports.

export { PermissionDenialBanner, type PermissionDenialBannerProps } from './denial-banner.js';
export {
  PermissionPrePromptModal,
  type PermissionPrePromptModalProps,
} from './pre-prompt-modal.js';
export {
  INITIAL_PERMISSION_FLOW_STATE,
  type PermissionFlowAction,
  permissionFlowReducer,
} from './state.js';
export type {
  PermissionDenialMessages,
  PermissionFlowState,
  PermissionPrePromptMessages,
} from './types.js';
export {
  usePermissionFlow,
  type UsePermissionFlowOptions,
  type UsePermissionFlowReturn,
} from './use-permission-flow.js';
