// packages/auth-middleware/src/principal.ts
// Resolved-principal discriminated union. Every authenticated request
// resolves to exactly one of these (per skills/stageflip/concepts/auth).
// MCP sessions (T-223) are surfaced as `mcp-session` so consumers can
// distinguish them from normal Firebase user logins (e.g. for rate
// limits in T-263).

import type { Role } from '@stageflip/auth-schema';

export interface UserPrincipal {
  readonly kind: 'user';
  readonly userId: string;
  readonly orgId: string;
  readonly role: Role;
}

export interface ApiKeyPrincipal {
  readonly kind: 'apiKey';
  readonly orgId: string;
  readonly keyId: string;
  readonly role: Role;
}

export interface McpSessionPrincipal {
  readonly kind: 'mcp-session';
  readonly userId: string;
  readonly orgId: string;
  readonly role: Role;
  readonly allowedBundles: readonly string[];
}

export type Principal = UserPrincipal | ApiKeyPrincipal | McpSessionPrincipal;
