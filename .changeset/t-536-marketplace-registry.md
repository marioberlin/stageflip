---
'@stageflip/marketplace-registry': minor
---

T-536 — Marketplace registry server (P16 δ first task; opens the
marketplace + lock-in phase). Lands `@stageflip/marketplace-registry`
— a server-side library implementing the registry routes
(`POST /api/v1/packs`, `GET /api/v1/packs`,
`GET /api/v1/packs/:publisher/:pack/:version`,
`GET /api/v1/packs/:publisher/:pack/:version/archive`) per ADR-014.
Storage is abstracted behind a `StorageAdapter` interface with an
in-memory shim for tests; publisher keys use TOFU per ADR-014 §D2
(first publish binds; subsequent verify); bearer tokens are
SHA-256-keyed per ADR-014 §D5 with plaintext never persisted. The
`composeHandler(deps)` factory returns a single express-like
`RouteHandler` the production HTTP adapter (T-550) wires into a
Cloud-Run host. No deployment in T-536 — library + handler bundle
only. Rate limiting documented but deferred to T-550. Concept skill
`skills/stageflip/concepts/marketplace-registry/SKILL.md` describes
the surface + the deferred-deployment posture. No external npm deps
added (uses `node:crypto` for hashing + the workspace
`@stageflip/pack-format` / `@stageflip/pack-signing`).
