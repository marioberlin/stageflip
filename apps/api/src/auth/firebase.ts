// apps/api/src/auth/firebase.ts
// T-229 Firebase Admin wrapper. Keeps the firebase-admin import in
// one place so the rest of the app can depend on a narrow
// `verifyFirebaseIdToken` function — easier to mock, smaller
// surface to keep up-to-date.

import type { FirebaseIdClaims } from './verify.js';

export interface FirebaseAdminOptions {
  /**
   * Firebase app name for multi-tenant setups. Defaults to Firebase
   * Admin's default app.
   */
  readonly appName?: string;
}

/**
 * Lazily-constructed Firebase verifier. Factored as a factory so the
 * heavy Firebase Admin SDK import only runs in production — tests
 * inject their own `verifyFirebaseIdToken`.
 */
export function createFirebaseVerifier(
  options: FirebaseAdminOptions = {},
): (token: string) => Promise<FirebaseIdClaims> {
  return async (token) => {
    const { getAuth } = await import('firebase-admin/auth');
    const { getApp } = await import('firebase-admin/app');
    const app = options.appName !== undefined ? getApp(options.appName) : getApp();
    const decoded = await getAuth(app).verifyIdToken(token);
    return decoded.email !== undefined
      ? { uid: decoded.uid, email: decoded.email }
      : { uid: decoded.uid };
  };
}
