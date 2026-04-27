// packages/auth-client/src/types.ts
// Structural Firebase Auth + Functions shapes the hooks consume.
// Declaring them locally keeps `@stageflip/auth-client` free of any
// hard dep on `firebase` — the consuming app passes a real `Auth`,
// `User`, and callable `Functions` instance, which structurally
// satisfies these shapes.

import type { Role } from '@stageflip/auth-schema';

/** Subset of Firebase Auth `User` we use in hooks. */
export interface AuthUser {
  readonly uid: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly photoURL: string | null;
  /** Force-refresh the ID token, returning the decoded result. */
  getIdTokenResult(forceRefresh?: boolean): Promise<IdTokenResult>;
}

/** Subset of Firebase Auth `IdTokenResult` we use. */
export interface IdTokenResult {
  readonly token: string;
  readonly claims: {
    readonly org?: string;
    readonly role?: string;
    readonly [k: string]: unknown;
  };
}

/** Listener function passed to `Auth.onAuthStateChanged`. */
export type AuthStateListener = (user: AuthUser | null) => void;

/** Subset of Firebase Auth `Auth` we use. */
export interface AuthClient {
  readonly currentUser: AuthUser | null;
  onAuthStateChanged(listener: AuthStateListener): () => void;
}

/** A bound callable function, mirroring `httpsCallable` results. */
export type CallableFn<TInput, TOutput> = (input: TInput) => Promise<{ data: TOutput }>;

/** Active-org claims surfaced by `useCurrentOrg`. */
export interface ActiveOrg {
  readonly orgId: string;
  readonly role: Role;
}

/** SetActiveOrg callable shape (Cloud Function on the server side). */
export type SetActiveOrgCallable = (input: { orgId: string }) => Promise<{
  data: { success: true };
}>;
