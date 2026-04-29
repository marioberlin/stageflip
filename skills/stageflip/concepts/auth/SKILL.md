---
title: Auth & Tenancy
id: skills/stageflip/concepts/auth
tier: concept
status: substantive
last_updated: 2026-04-28
owner_task: T-271
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
   the plaintext key. The local cache invalidation hook exists at
   `invalidateApiKeyCache(plaintext)` for callers that hold the
   plaintext; the current `revokeApiKey` Cloud Function does NOT
   call it (the handler doesn't have the plaintext — cache is
   keyed by plaintext, not by `keyId`). All callers therefore rely
   on the 60 s TTL alone for cross-instance staleness — the
   documented eventual-consistency window.

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

EU-residency orgs are assigned to a dedicated Firestore region (T-271,
shipped). Cross-region access is blocked at the rules level; exports run
in-region.

**Routing contract** (T-271):

- `Org.region: 'us' | 'eu'` carries the residency assignment. `'us'` is the
  default for back-compat with persisted records pre-T-271 (Zod
  `.default('us')`).
- Two Firestore databases live in one Firebase project: `(default)` (US,
  `nam5`) and `eu-west` (`europe-west3`, Frankfurt). Both carry IDENTICAL
  rule text — divergence between databases is a security regression and
  pinned by `firebase/tests/eu-region-rules.test.ts`.
- `@stageflip/storage-firebase`'s `createRegionRouter` is the single
  routing surface. Consumers call `router.getFirestoreForOrg(org)` and
  `router.getAssetStorageForOrg(org)`; per-region adapters are cached.
- Cross-region read is impossible by construction: each Firestore database
  has its own access path, so a US org's documents simply do not exist in
  the eu-west database. The router is what binds an EU org's client to
  eu-west; an EU principal asking for a guessed US doc-id hits eu-west and
  gets nothing.

**`org.region` is immutable post-creation in v1.**

- `validateRegionTransition(prev, next)` in `@stageflip/auth-schema` is
  the application-side guard. Cloud Functions and admin scripts MUST run
  candidate mutations through it before persisting. Zod cannot natively
  express "this field is immutable across updates"; the helper is the
  security primitive.
- Migration between regions is a manual operational procedure documented
  in `docs/ops/data-residency.md`. The legal triggers are rare; the
  customer-facing impact is significant (read-only window). Do NOT
  productize the migration without explicit reauthorization.

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

T-263 (rate limits, shipped) and T-271 (EU region, shipped) build on
this foundation:

- T-263 keys rate-limit buckets on the resolved `Principal` —
  api-keys get tighter buckets than user JWTs by default.
- T-271 adds a `region` field to `orgs/{orgId}` and routes Firestore +
  asset-bucket reads to the matching region. See above and
  `docs/ops/data-residency.md`.

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

## Permission flow UX (T-385)

The interactive runtime tier (T-306) ships `PermissionShim` — the
mount-time gate that consults `tenantPolicy.canMount(family)` then
walks `clip.liveMount.permissions`, prompting the user for `mic` /
`camera` (network is a no-op) and caching grants per-(session, family).
T-385 layers a user-facing UX over that primitive without changing the
shim's contract.

The package now exports a `permission-flow` subpath
(`@stageflip/runtimes-interactive/permission-flow`) carrying:

- `usePermissionFlow(clip, { shim, prePrompt?, emitTelemetry? })` —
  React hook driving an exhaustive state machine
  (`idle | pre-prompt | requesting | granted | denied`). The hook
  calls `shim.mount()` on entering `requesting`, emits the D-T385-5
  telemetry envelope (`permission.pre-prompt.shown` / `.confirmed` /
  `.cancelled`, `permission.dialog.shown`, `permission.retry.clicked`
  / `.granted` / `.denied`), and clears the failed permission's cache
  entry via `shim.clearCacheEntry(family, permission)` on retry.
  Tenant-denied retries are intentionally no-ops — tenant policy is
  not user-overridable.
- `<PermissionDenialBanner>` + `<PermissionPrePromptModal>` — default
  visual surfaces. **All user-facing text comes through required
  `messages` props; no English-string defaults live in the package**
  (CLAUDE.md §10). Apps inject localised copy.
- `PermissionShim.clearCacheEntry(family, permission)` — production-
  callable per-key cache invalidation; the broader `clearCache()`
  test-seam is preserved unchanged.

Pre-prompt UX is opt-in per mount via
`InteractiveMountHarness.mount(clip, root, signal, { permissionPrePrompt: true })`.
The harness yields a pre-prompt render cycle (via the host-supplied
`permissionPrePromptHandler` constructor option) BEFORE the browser
permission dialog. On cancel, the mount routes to `staticFallback`
with reason `'pre-prompt-cancelled'`. Default behaviour (flag absent)
matches the T-306 baseline byte-for-byte.

Pre-prompt is OFF by default. Per-permission research consistently
shows that browser permission dialogs alone yield higher denial rates
than dialogs preceded by an in-app explanation; clip families that
declare non-empty permissions (`VoiceClip`, `AiChatClip`,
`LiveDataClip`, `WebEmbedClip`, `AiGenerativeClip`) may *recommend*
`prePrompt: true` in their skills but the host application owns the
choice.

`runtimes-interactive` is browser-only — no Node imports allowed in
new files (browser-bundle hazard per `feedback_t304_lessons`).

## Related

- Rate limits: `concepts/rate-limits/SKILL.md`
- MCP: `concepts/mcp-integration/SKILL.md`
- Runtimes (interactive tier): `concepts/runtimes/SKILL.md` §"Interactive runtime tier"
- Tasks: T-262 (auth+tenancy, shipped), T-263 (rate limits),
  T-271 (EU region), T-306 (PermissionShim primitive),
  T-385 (permission-flow UX).
