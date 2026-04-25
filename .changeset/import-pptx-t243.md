---
"@stageflip/import-pptx": patch
---

T-243: image asset extraction.

`resolveAssets(tree, entries, storage): Promise<CanonicalSlideTree>` walks the
parser-side tree, hashes each `ParsedAssetRef.unresolved` payload via sha256,
uploads through an abstract `AssetStorage` interface, and rewrites refs to the
schema-typed `asset:<id>` form. Dedup is by content-hash; identical bytes
across multiple slides upload once. Broken rels (path absent from the ZIP)
emit a new `LF-PPTX-MISSING-ASSET-BYTES` flag (`error` severity) and leave
the ref unresolved. Idempotent via `tree.assetsResolved`.

Public surface adds `resolveAssets`, `AssetStorage`, `AssetResolutionError`,
`inferContentType`, and promotes the previously internal `unpackPptx` /
`ZipEntries`. `LossFlagCode` gains `LF-PPTX-MISSING-ASSET-BYTES`.

Scope is images only; videos and fonts are explicit follow-ups (T-243b,
T-243c) since T-240 doesn't yet surface them. The concrete Firebase Storage
adapter is a separate small follow-up (`T-243-storage-adapter`) that wraps
the abstract interface around T-230's primitives.
