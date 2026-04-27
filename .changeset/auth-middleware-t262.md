---
'@stageflip/auth-middleware': minor
---

T-262 — initial release. Node-side auth middleware:
`resolvePrincipal` (Authorization header → discriminated
`Principal`), `requireAuth`, `requireRole`, scrypt-based
`hashApiKey` / `compareApiKey`, and an in-process api-key resolution
cache with 60 s TTL. Accepts Firebase ID tokens, MCP-session JWTs
(T-223), and `sf_<env>_*` api-keys. Source of truth:
`skills/stageflip/concepts/auth/SKILL.md`.
