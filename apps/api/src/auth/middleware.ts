// apps/api/src/auth/middleware.ts
// T-229 Hono middleware. Attaches the verified principal to
// c.var.principal; returns 401 with a structured body on failure.

import { createMiddleware } from 'hono/factory';

import { type Principal, type PrincipalVerifier, UnauthorizedError } from './verify.js';

export type AuthVariables = {
  principal: Principal;
};

export interface AuthMiddlewareOptions {
  readonly verify: PrincipalVerifier;
  /**
   * Optional principal-level guard. Return false to 403 the request.
   * Runs after verification; receives the resolved principal.
   */
  allow?(principal: Principal): boolean;
}

export function authMiddleware(options: AuthMiddlewareOptions) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const header = c.req.header('authorization');
    let principal: Principal;
    try {
      principal = await options.verify(header);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return c.json({ error: 'unauthorized', reason: err.reason, message: err.message }, 401);
      }
      throw err;
    }
    if (options.allow && !options.allow(principal)) {
      return c.json({ error: 'forbidden', message: 'principal not permitted for this route' }, 403);
    }
    c.set('principal', principal);
    await next();
  });
}
