---
'@stageflip/pack-loader': minor
---

T-495 — `@stageflip/pack-loader` ships `loadPack` + `discoverPacks` over
`~/.stageflip/packs/` per ADR-012 §D8. Runs the five install-time gates
per ADR-012 §D6 (manifest parse, platform compatibility, archive +
signature read, Ed25519 verify, entitlement check) and surfaces failures
via the five `LF-PACK-*` / `LF-LICENSE-*` loss flag codes from
`@stageflip/pack-format`. Forward-declares the `TenantEntitlementsLike`
+ `PublisherKeyRegistryLike` interfaces the concrete stores (T-496 +
T-499) will satisfy. Includes a minimal semver-range matcher (caret /
tilde / `>=` / `<` / hyphen / wildcard / exact) for the §D7
`platformCompatibility` check; avoids the external `semver` dep.
