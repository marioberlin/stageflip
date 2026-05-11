---
'@stageflip/app-api': patch
'@stageflip/cli': patch
---

T-411b — TenantSettings API + CLI surface (2nd of T-411 multi-PR sequence).

Adds three procedures on `apps/api` consuming the `TenantSettingsStore`
contract that T-411a shipped:

- `GET  /v1/tenant-settings/:tenantId`               — read; synthesises the
  default-deny `{ features: { interactive: 'disabled' } }` payload on
  absent rows per parent §D-T411-5 (does NOT persist on read).
- `POST /v1/tenant-settings/:tenantId/interactive`   — set posture; gated by
  the new `canSetInteractive` predicate per parent §D-T411-6.
- `GET  /v1/tenant-settings`                         — list all rows;
  superadmin only.

Authorization predicate (`apps/api/src/auth/can-set-interactive.ts`) is
pure and covers the two-role model: `superadmin` may transition any
tenant to any value (incl. `'ga'`); `admin` / `owner` may transition
their own tenant between `'disabled'` and `'preview'`; `viewer` /
`editor` and unrecognised roles are denied. Cross-tenant calls by
non-superadmin actors are denied with a structured reason.

Adds CLI command `stageflip tenant set-interactive --tenant <id>
--value <disabled|preview|ga> [--dry-run]`, which POSTs to the
`setInteractive` procedure using `STAGEFLIP_API_TOKEN` as the bearer
JWT. Authorization is enforced server-side; the CLI surfaces the
server's response.

Default storage is `InMemoryTenantSettingsStore` (consistent with the
existing TODO-stub `resolvePrincipal` default in `bin.ts`); production
deployments inject the Postgres / Firebase store factory at boot.

Out of scope (deferred to siblings): permission-shim wiring (T-411c),
docs/skill cross-link (T-411d), admin UI (T-411e), `'superadmin'` added
to the `McpSessionRole` union (future PR).

Implementation note: the parent T-411 spec wrote "tRPC router"; the
codebase has no tRPC root, so this PR ships Hono routes following the
existing `routes/mcp-session.ts` convention. Procedure semantics are
unchanged.
