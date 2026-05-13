---
'@stageflip/engine': minor
---

T-496 — `@stageflip/engine` ships `LicenseRuntime`, the clip-mount license
gate per ADR-012 §D6 point 2. Pairs with the install-time gate in
`@stageflip/pack-loader` (T-495): the loader admits a pack when its
entitlement is active at install; the runtime re-checks at clip-mount so
a pack whose entitlement lapsed / was revoked mid-session is refused and
the engine emits `LF-LICENSE-CLIP-REVOKED`. Open-licensed packs skip the
entitlement check; core / built-in clips that never go through pack
registration are implicitly licensed. Entitlement lookups are cached per
sku with a configurable TTL (default 60s) plus a `clearCache()` test hook.
Engine integration into the renderer-core clip dispatcher is out of scope
here and lands in a downstream task.
