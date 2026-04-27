---
'@stageflip/auth-schema': minor
---

T-262 — initial release. Zod types for `User`, `Org`, `Membership`,
`ApiKey`, and the `Role` hierarchy primitive
(`viewer < editor < admin < owner`) plus `checkRoleAtLeast(have,
need)`. Source of truth:
`skills/stageflip/concepts/auth/SKILL.md`.
