// packages/mcp-server/src/auth/guard.ts
// T-223 — verify the bearer JWT on an MCP request and derive the
// session's allowedBundles scope. Callers (buildContext in
// createMcpServer deployments) run this once per request; on success
// the return value feeds allowedBundles through to the adapter gate.

import { verifyMcpSessionJwt } from './jwt.js';
import type { VerifiedMcpSession } from './jwt.js';

export type UnauthorizedReason =
  | 'missing'
  | 'malformed'
  | 'expired'
  | 'invalid-signature'
  | 'verification-failed';

export class UnauthorizedError extends Error {
  readonly reason: UnauthorizedReason;

  constructor(reason: UnauthorizedReason, message: string) {
    super(message);
    this.name = 'UnauthorizedError';
    this.reason = reason;
  }
}

export interface GuardMcpSessionArgs {
  readonly secret: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface McpSessionPrincipal {
  readonly sub: string;
  readonly org: string;
  readonly role: VerifiedMcpSession['role'];
}

export interface GuardMcpSessionResult {
  readonly principal: McpSessionPrincipal;
  readonly allowedBundles: readonly string[];
}

export async function guardMcpSession(args: GuardMcpSessionArgs): Promise<GuardMcpSessionResult> {
  const { secret, metadata } = args;

  const header = metadata.authorization;
  if (typeof header !== 'string' || header.length === 0) {
    throw new UnauthorizedError('missing', 'MCP session: authorization header not present');
  }
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match || !match[1]) {
    throw new UnauthorizedError(
      'malformed',
      'MCP session: authorization header missing Bearer prefix',
    );
  }
  const token = match[1];

  let verified: VerifiedMcpSession;
  try {
    verified = await verifyMcpSessionJwt({ secret, token });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const reason: UnauthorizedReason = /expired/i.test(message)
      ? 'expired'
      : /signature|verification/i.test(message)
        ? 'invalid-signature'
        : 'verification-failed';
    throw new UnauthorizedError(reason, `MCP session: ${message}`);
  }

  return {
    principal: { sub: verified.sub, org: verified.org, role: verified.role },
    allowedBundles: verified.allowedBundles,
  };
}
