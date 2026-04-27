// packages/auth-middleware/src/require-role.ts
// Connect-style middleware that runs `requireAuth` then enforces a
// minimum role via `checkRoleAtLeast` (T-262 AC #11).

import { type Role, checkRoleAtLeast } from '@stageflip/auth-schema';
import { ForbiddenError } from './errors.js';
import {
  type AuthRequest,
  type AuthResponse,
  type NextFn,
  type RequireAuthOptions,
  requireAuth,
} from './require-auth.js';

export interface RequireRoleOptions extends RequireAuthOptions {}

/**
 * Build a `(req, res, next)` middleware that asserts
 * `checkRoleAtLeast(req.principal.role, need)`. On rejection: 403 with
 * `{ code: 'insufficient-role', have, need }`.
 */
export function requireRole(need: Role, opts: RequireRoleOptions) {
  const auth = requireAuth(opts);
  return async function requireRoleMiddleware(
    req: AuthRequest,
    res: AuthResponse,
    next: NextFn,
  ): Promise<void> {
    let ranThrough = false;
    await auth(req, res, (err?: unknown) => {
      ranThrough = true;
      if (err) {
        next(err);
        return;
      }
      const principal = req.principal;
      if (!principal) {
        // requireAuth swallowed the error and wrote a response itself.
        return;
      }
      if (!checkRoleAtLeast(principal.role, need)) {
        const body = new ForbiddenError({ have: principal.role, need }).toJSON();
        res.status(403).json(body);
        return;
      }
      next();
    });
    // requireAuth's failure path (write response, do NOT call next) is
    // structurally observable: ranThrough stays false, principal is
    // unset. No further work to do here.
    void ranThrough;
  };
}
