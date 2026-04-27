---
'@stageflip/auth-schema': minor
---

T-271 — `Org.region` becomes a `'us' | 'eu'` enum with `.default('us')`
back-compat for records persisted before T-271. Adds
`validateRegionTransition(prev, next)` — the application-side
immutability guard for `org.region`. Cloud Functions and admin scripts
MUST run candidate mutations through it; Zod cannot natively express
cross-update field immutability. See
`skills/stageflip/concepts/auth/SKILL.md` §"Tenant data residency".
