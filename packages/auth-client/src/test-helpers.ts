// packages/auth-client/src/test-helpers.ts
// Tiny in-memory `AuthClient` + `AuthUser` fakes used by the hook
// tests. Production callers pass a real Firebase Auth instance —
// these fakes structurally satisfy the same interface.

import type { AuthClient, AuthStateListener, AuthUser, IdTokenResult } from './types.js';

export interface FakeAuthState {
  setUser(user: FakeAuthUser | null): void;
  client: AuthClient;
}

export class FakeAuthUser implements AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  claims: IdTokenResult['claims'];

  constructor(uid: string, claims: IdTokenResult['claims'] = {}) {
    this.uid = uid;
    this.email = `${uid}@example.com`;
    this.displayName = uid;
    this.photoURL = null;
    this.claims = claims;
  }

  setClaims(next: IdTokenResult['claims']): void {
    this.claims = next;
  }

  async getIdTokenResult(_forceRefresh?: boolean): Promise<IdTokenResult> {
    return { token: `tok-${this.uid}`, claims: this.claims };
  }
}

export function createFakeAuth(initial: FakeAuthUser | null = null): FakeAuthState {
  let current: FakeAuthUser | null = initial;
  const listeners = new Set<AuthStateListener>();
  const client: AuthClient = {
    get currentUser() {
      return current;
    },
    onAuthStateChanged(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    client,
    setUser(user) {
      current = user;
      for (const l of listeners) l(user);
    },
  };
}
