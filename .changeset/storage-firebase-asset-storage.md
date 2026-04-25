---
"@stageflip/storage-firebase": minor
---

T-243-storage-adapter: Firebase-backed `AssetStorage` adapter.

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
