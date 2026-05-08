# @stageflip/auth-middleware

## 0.1.0

### Minor Changes

- d2021e9: T-262 — initial release. Node-side auth middleware:
  `resolvePrincipal` (Authorization header → discriminated
  `Principal`), `requireAuth`, `requireRole`, scrypt-based
  `hashApiKey` / `compareApiKey`, and an in-process api-key resolution
  cache with 60 s TTL. Accepts Firebase ID tokens, MCP-session JWTs
  (T-223), and `sf_<env>_*` api-keys. Source of truth:
  `skills/stageflip/concepts/auth/SKILL.md`.

### Patch Changes

- Updated dependencies [d2021e9]
- Updated dependencies [de13cf8]
  - @stageflip/auth-schema@0.1.0
