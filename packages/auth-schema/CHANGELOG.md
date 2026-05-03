# @stageflip/auth-schema

## 0.1.0

### Minor Changes

- d2021e9: T-262 — initial release. Zod types for `User`, `Org`, `Membership`,
  `ApiKey`, and the `Role` hierarchy primitive
  (`viewer < editor < admin < owner`) plus `checkRoleAtLeast(have,
need)`. Source of truth:
  `skills/stageflip/concepts/auth/SKILL.md`.
- de13cf8: T-271 — `Org.region` becomes a `'us' | 'eu'` enum with `.default('us')`
  back-compat for records persisted before T-271. Adds
  `validateRegionTransition(prev, next)` — the application-side
  immutability guard for `org.region`. Cloud Functions and admin scripts
  MUST run candidate mutations through it; Zod cannot natively express
  cross-update field immutability. See
  `skills/stageflip/concepts/auth/SKILL.md` §"Tenant data residency".
