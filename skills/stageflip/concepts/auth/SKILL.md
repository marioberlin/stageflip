---
title: Auth & Tenancy
id: skills/stageflip/concepts/auth
tier: concept
status: substantive
last_updated: 2026-04-27
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

## Active-org switch (JWT claims)

A user's "active org" lives in the Firebase ID token's custom claims as
`{ org: string, role: 'viewer'|'editor'|'admin'|'owner' }`. The switch flow
(D-T262-1) is:

1. Client calls the `setActiveOrg(orgId)` callable.
2. Cloud Function verifies caller membership of `orgId`, then
   `admin.auth().setCustomUserClaims(uid, { org, role })`.
3. Client awaits `user.getIdTokenResult(true)` to force-refresh.
4. The next request carries the new claims; middleware reads them
   without a Firestore round-trip.

The `firestore.rules` `isAtLeast(level)` helper reads role from
`request.auth.token.role`. Storage rules mirror that idiom.

## API key verification (org-bounded)

API keys are formatted `sf_<env>_<base64url>` and stored as
`orgs/{orgId}/apiKeys/{keyId}` with a scrypt hash + the indexable
prefix `sf_<env>_<first-6-chars>`. Verification (D-T262-2):

1. Middleware sees `Authorization: Bearer sf_<env>_xxx`.
2. The request MUST also carry `X-Org-Id`. Without it, the middleware
   returns 400 `missing-org-header`. This bound is what makes the
   prefix lookup tractable — without it, the lookup would scan the
   `orgs/*/apiKeys` collection-group globally.
3. Middleware queries `orgs/{X-Org-Id}/apiKeys` indexed on `prefix`,
   filters out `revokedAt != null`, and scrypt-compares the plaintext
   against each candidate's `hashedKey`.
4. On match, the resolution is cached in-process for 60 s keyed by
   the plaintext key. `revokeApiKey` invalidates the local entry; in
   multi-instance deployments other processes see staleness up to the
   60 s TTL — this is the documented eventual-consistency window.

Hash choice: `node:crypto.scrypt` (built-in, no native addon, no
licensing risk). Bcrypt was the original spec suggestion; scrypt with
N=16384, r=8, p=1 hits the same "slow hash + fast cache" target while
avoiding the native dep.

## MCP auth flow (T-223)

1. User installs the Claude plugin; the plugin kicks off an OAuth round-trip.
2. Auth server exchanges the authcode for a short-lived JWT (1h).
3. Plugin stores the JWT in the OS keychain; refreshes via refresh token.
4. Every MCP tool call carries the JWT; the server resolves `user + org`.
5. If JWT is expired, the tool call returns a `auth-refresh-required`
   structured error the plugin handles transparently.

`@stageflip/auth-middleware`'s `resolvePrincipal` accepts the T-223 JWT
shape (`typ: "mcp-session"`, claims `sub` / `org` / `role` /
`allowedBundles`) and surfaces it as a `Principal` of kind
`mcp-session`.

## Firestore security

Security rules (T-038, extended in T-262) enforce the role model at the
storage layer, not just the API layer. This prevents a leaked client-side
SDK from bypassing server-side checks.

T-262 specifically:

- `apiKeys/{keyId}` — `write: if false`. Cloud Functions write via the
  service-account bypass; client-side writes are impossible.
- `invites/{token}` — same posture as `apiKeys`.
- `members/{userId}` — admin+ writes via client SDK are allowed (the
  members collection is the source of truth the `setActiveOrg`
  callable reads from).

## Tenant data residency

EU-residency orgs are assigned to a dedicated Firestore region (T-271). Cross-
region access is blocked at the rules level; exports run in-region.

## Current state (Phase 12)

T-262 (auth + tenancy) **shipped** as part of Phase 12. Implementation:

- `@stageflip/auth-schema` — Zod types for `User` / `Org` /
  `Membership` / `ApiKey` and the `Role` hierarchy primitive.
- `@stageflip/auth-middleware` — `resolvePrincipal` /
  `requireAuth` / `requireRole` / `hashApiKey` + scrypt-cache.
- `@stageflip/auth-client` — React hooks `useCurrentUser` /
  `useCurrentOrg` / `useRole` + `switchOrg` action.
- `firebase/functions/src/auth/*` — callables `setActiveOrg`,
  `createApiKey`, `revokeApiKey`, `inviteMember`, `acceptInvite`,
  `removeMember`, `changeMemberRole`.
- `firebase/firestore.rules` — extended with apiKeys / invites
  posture.

T-263 (rate limits) and T-271 (EU region) build on this foundation:

- T-263 keys rate-limit buckets on the resolved `Principal` —
  api-keys get tighter buckets than user JWTs by default.
- T-271 adds a `region` field to `orgs/{orgId}` and routes
  Firestore reads to the matching region.

Out-of-scope deferrals from T-262:

- Per-API-route adoption of `requireAuth` / `requireRole` (per-surface
  follow-ups).
- Email/SMS invite delivery (callable returns the token; ops decides
  delivery).
- 2FA / MFA enforcement (Firebase Auth supports it; we don't enforce
  yet).
- Per-document ACLs (share links, granular permissions).
- Auto-provisioning a personal org on signup (explicit creation
  preferred for billing-surface clarity, T-267).
- Audit log of role changes (memberships record `lastModifiedBy`,
  but no queryable audit surface ships in T-262).

## Related

- Rate limits: `concepts/rate-limits/SKILL.md`
- MCP: `concepts/mcp-integration/SKILL.md`
- Tasks: T-262 (auth+tenancy, shipped), T-263 (rate limits),
  T-271 (EU region).
