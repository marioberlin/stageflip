// packages/auth-client/src/index.ts
// @stageflip/auth-client — React hooks consumed by `apps/stageflip-*`.
// Source of truth: skills/stageflip/concepts/auth/SKILL.md.

export { notifyClaimsChanged, subscribeClaimsChanged } from './claims-events.js';
export { switchOrg } from './switch-org.js';
export type {
  ActiveOrg,
  AuthClient,
  AuthStateListener,
  AuthUser,
  CallableFn,
  IdTokenResult,
  SetActiveOrgCallable,
} from './types.js';
export { useCurrentOrg } from './use-current-org.js';
export { useCurrentUser } from './use-current-user.js';
export { useRole } from './use-role.js';
