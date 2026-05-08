# @stageflip/storage-firebase

## 0.1.0

### Minor Changes

- d334a12: T-243-storage-adapter: Firebase-backed `AssetStorage` adapter.

  `createFirebaseAssetStorage({ bucket, pathPrefix?, idLength? })` returns a
  concrete `AssetStorage` (the abstract interface from `@stageflip/import-pptx`)
  that uploads PPTX media bytes to a Firebase Admin Storage bucket. Storage is
  content-addressed: identical bytes (same `contentHash` from the importer)
  write to the same path. Defaults to `pptx-imports/{contentHash[:21]}` with
  the full hash preserved in object metadata.

  The adapter speaks to a structural `BucketLike` interface, so unit tests can
  swap in a tiny in-memory shim instead of mocking the firebase-admin SDK.

  Wires the importer pipeline end-to-end: `apps/api` (or any caller with a
  Firebase bucket) can now run `parsePptx → resolveAssets → ...` and have
  image bytes land in Firebase Storage.

- de13cf8: T-271 — region-aware Firestore + asset-bucket router. `createRegionRouter({
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

### Patch Changes

- Updated dependencies [d2021e9]
- Updated dependencies [de13cf8]
- Updated dependencies [eeee940]
- Updated dependencies [acbc394]
- Updated dependencies [ea7e66a]
- Updated dependencies [e2f5e55]
- Updated dependencies [cefce71]
- Updated dependencies [fc78eac]
- Updated dependencies [5a02994]
- Updated dependencies [ca51076]
- Updated dependencies [226d85b]
- Updated dependencies [29701d5]
- Updated dependencies [84c917a]
- Updated dependencies [d4d690d]
- Updated dependencies [46a4a3a]
- Updated dependencies [3280984]
  - @stageflip/auth-schema@0.1.0
  - @stageflip/import-pptx@0.1.0
