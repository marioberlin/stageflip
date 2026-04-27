// packages/auth-middleware/src/errors.ts
// Structured auth/authorization errors. Codes are stable; consumers
// (HTTP handlers, RPC layers) map them to wire-level statuses.

export type AuthErrorCode =
  | 'missing-token'
  | 'invalid-token'
  | 'expired-token'
  | 'missing-org-header'
  | 'unknown-api-key'
  | 'revoked-api-key';

export interface AuthErrorBody {
  readonly code: AuthErrorCode;
  readonly message: string;
}

/** Thrown by `resolvePrincipal` and consumed by `requireAuth` → 401. */
export class AuthError extends Error {
  readonly code: AuthErrorCode;
  constructor(body: AuthErrorBody) {
    super(body.message);
    this.name = 'AuthError';
    this.code = body.code;
  }
  toJSON(): AuthErrorBody {
    return { code: this.code, message: this.message };
  }
}

export interface ForbiddenErrorBody {
  readonly code: 'insufficient-role';
  readonly have: string;
  readonly need: string;
}

/** Thrown by `requireRole` and consumed by `requireRole` → 403. */
export class ForbiddenError extends Error {
  readonly code = 'insufficient-role' as const;
  readonly have: string;
  readonly need: string;
  constructor(body: { have: string; need: string }) {
    super(`role ${body.have} insufficient; need ${body.need}`);
    this.name = 'ForbiddenError';
    this.have = body.have;
    this.need = body.need;
  }
  toJSON(): ForbiddenErrorBody {
    return { code: this.code, have: this.have, need: this.need };
  }
}
