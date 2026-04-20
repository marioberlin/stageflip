---
title: Auth & Tenancy
id: skills/stageflip/concepts/auth
tier: concept
status: substantive
last_updated: 2026-04-20
owner_task: T-262
related:
  - skills/stageflip/concepts/mcp-integration/SKILL.md
  - skills/stageflip/concepts/rate-limits/SKILL.md
---

# Auth & Tenancy

Three entry paths, one identity model.

## Principals

| Principal | How established |
|---|---|
| `user` | Firebase Auth (email/password, Google SSO, GitHub SSO) |
| `org` | A user belongs to 0+ orgs; one org is the "active tenant" |
| `api-key` | Org-scoped; named; can be rotated; carries role |
| `mcp-session` | OAuth → short-lived JWT; scoped to a user + org |

Every request resolves to exactly one principal. Unauthenticated calls are
limited to the public read surface (shared-link previews only).

## Role model

```
roles = ['viewer', 'editor', 'admin', 'owner']
```

- `viewer` — read documents, download exports, view comments
- `editor` — all of viewer + mutate documents + run agent
- `admin` — all of editor + manage org users + manage API keys
- `owner` — all of admin + billing + delete org

Document-level ACL overrides are possible (share link, per-document collab).

## MCP auth flow (T-223)

1. User installs the Claude plugin; the plugin kicks off an OAuth round-trip.
2. Auth server exchanges the authcode for a short-lived JWT (1h).
3. Plugin stores the JWT in the OS keychain; refreshes via refresh token.
4. Every MCP tool call carries the JWT; the server resolves `user + org`.
5. If JWT is expired, the tool call returns a `auth-refresh-required`
   structured error the plugin handles transparently.

## Firestore security

Security rules (T-038) enforce the role model at the storage layer, not just
the API layer. This prevents a leaked client-side SDK from bypassing
server-side checks.

## Tenant data residency

EU-residency orgs are assigned to a dedicated Firestore region (T-271). Cross-
region access is blocked at the rules level; exports run in-region.

## Related

- Rate limits: `concepts/rate-limits/SKILL.md`
- MCP: `concepts/mcp-integration/SKILL.md`
- Tasks: T-262 (auth+tenancy), T-263 (rate limits), T-271 (EU region)
