// firebase/functions/src/auth/types.ts
// Shared types + DI shapes for the auth callables (T-262).
//
// Each handler is a pure-async function over an injected `AuthDeps`
// bundle. The Firebase wrappers in `index.ts` adapt these handlers to
// `onCall` callables; the handlers themselves are unit-testable
// without `firebase-functions-test`.

import type { Role } from '@stageflip/auth-schema';

export interface AuthDeps {
  readonly firestore: FirestoreLike;
  readonly auth: AdminAuthLike;
  readonly clock: () => number;
  readonly randomBytes: (n: number) => Uint8Array;
  readonly env: 'dev' | 'prod' | 'staging';
  /** Hashes a plaintext api-key. Injected to keep tests fast. */
  readonly hashApiKey: (plaintext: string) => Promise<string>;
}

/** Subset of `firebase-admin/auth` we use. */
export interface AdminAuthLike {
  setCustomUserClaims(uid: string, claims: { org?: string; role?: Role }): Promise<void>;
}

/** Subset of `firebase-admin/firestore` we use. */
export interface FirestoreLike {
  doc(path: string): DocRefLike;
  collection(path: string): CollectionRefLike;
}

export interface DocRefLike {
  get(): Promise<DocSnapLike>;
  set(data: Record<string, unknown>): Promise<unknown>;
  update(data: Record<string, unknown>): Promise<unknown>;
  delete(): Promise<unknown>;
  readonly id: string;
  readonly path: string;
}

export interface DocSnapLike {
  readonly exists: boolean;
  readonly id: string;
  data(): Record<string, unknown> | undefined;
}

export interface CollectionRefLike {
  doc(id?: string): DocRefLike;
  add(data: Record<string, unknown>): Promise<DocRefLike>;
}

/** The caller context the wrapper extracts from `onCall`'s `request.auth`. */
export interface CallerContext {
  readonly uid: string;
  /** Active org from custom claims; may be undefined for users with no active org. */
  readonly orgId: string | undefined;
  readonly role: Role | undefined;
}

export class CallableError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.name = 'CallableError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
