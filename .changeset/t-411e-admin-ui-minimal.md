---
'@stageflip/app-slide': patch
---

T-411e — TenantSettings admin UI minimal slice (5th and final T-411
multi-PR sequence; closes parent §D-T411-7 with the explicit
minimal-slice posture).

Adds `apps/stageflip-slide/src/app/admin/tenant-settings/page.tsx` —
a Next 15 React Server Component that reads the current
`features.interactive` posture for a tenant (default-deny synthesis
mirrors the API's T-411b route handler) and renders an HTML form whose
action calls a server action (`updateTenantInteractiveAction`). The
server action reuses `canSetInteractive` from `@stageflip/app-api` so
the authorization predicate is single-sourced.

Authorization gating per parent §D-T411-6:

- `superadmin`        → update form for any tenant (incl. `'ga'`)
- `admin` / `owner`   → update form for own tenant only; `'ga'` denied
- other / viewer      → read-only view; no form
- unauthenticated     → 401-shaped message

Posture per spec §D-T411e-5: native HTML, ~10 lines of inline CSS, no
design system, no animations, no mobile responsiveness, no i18n. The
sub-task spec (`docs/tasks/T-411e.md`) defines the contract for the
downstream UX-polish task.

Adds workspace deps `@stageflip/app-api` + `@stageflip/storage` to
`@stageflip/app-slide`. Process-local `InMemoryTenantSettingsStore` by
default; production deployments swap the module-level store + replace
the env-var actor stub at `apps/stageflip-slide/src/lib/admin-auth.ts`.

NOT a structural extension per CLAUDE.md §13 — adds a UI route
consuming existing surfaces; render verification N/A.
