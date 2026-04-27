---
"@stageflip/storage-firebase": minor
---

T-271 — region-aware Firestore + asset-bucket router. `createRegionRouter({
defaultFirestore, euFirestore?, defaultBucket?, euBucket? })` returns a
factory that picks the right Firestore + `AssetStorage` adapter per
`org.region`. Per-region adapters are cached so consumers don't accumulate
adapters across requests. Existing direct callers of
`createFirebaseAssetStorage` are unaffected; the router is additive.

Cross-region read is impossible by construction: each Firestore database
has its own access path, so an EU-bound client never sees US documents.
See `docs/ops/data-residency.md` for the operational runbook and
`skills/stageflip/concepts/auth/SKILL.md` §"Tenant data residency" for
the routing contract.
