---
"@stageflip/renderer-cdp": minor
---

Asset preflight (T-084a).

Walks an RIRDocument for every URL-bearing content reference
(image, video, audio, embed), passes each through a pluggable
`AssetResolver` to fetch/cache it, and produces a rewritten
document whose URLs point at local `file://` paths. Refs the
resolver refuses (YouTube embeds, arbitrary iframes, offline
URLs) come back as **loss-flags**: surfaced in the export result,
left unrewritten in the document, never silently dropped.

New modules (packages/renderer-cdp/src/):

- `asset-refs.ts` — pure traversal.
  - `collectAssetRefs(document) → readonly AssetRef[]` — dedup by
    URL, annotated with `firstSeenElementId` + `referencedBy`.
  - `rewriteDocumentAssets(document, map) → RIRDocument` —
    immutable substitution of URLs via the resolution map.
- `asset-resolver.ts` — asynchronous resolution.
  - `AssetResolver` interface + `InMemoryAssetResolver` (fixture
    map + call recorder for tests).
  - `AssetResolution = { status: 'ok', localUrl } | { status:
    'loss-flag', reason }` — fail-visible by design.
  - `resolveAssets(document, resolver)` orchestrator — dedup fetch
    calls across duplicate URLs, build resolution map, apply
    rewriter. Resolver errors propagate (fail-loud).

`preflight.ts` now populates `PreflightReport.assetRefs` by calling
`collectAssetRefs` (no longer a stub). Resolution / rewrite is a
separate async phase — `preflight` stays pure and sync.

`exportDocument` extended:
- New option: `assetResolver?: AssetResolver`. If provided, asset
  preflight runs after sync preflight and before `adapter.mount`;
  the session sees the rewritten document.
- New result field: `lossFlags: readonly LossFlag[]`. Empty when
  no resolver was supplied.
- Sink ownership contract unchanged — `sink.close` still fires
  exactly once on every exit path.

Real HTTP fetch + content-hash disk cache + Puppeteer-screenshot
rasterization for embeds will land alongside the T-085/T-090
concrete CDP session. This task ships the contract and the
orchestrator; tests inject `InMemoryAssetResolver`.

Test surface: 78 cases across 9 files (+21 from T-084).
- 10 asset-refs (collect + dedup + recurse + rewrite + non-mutation)
- 8 asset-resolver (InMemoryAssetResolver + orchestrator dedup +
  loss-flag propagation + resolver-error propagation + identity
  passthrough)
- 3 new export-dispatcher integration cases (rewrite before mount,
  loss-flag surfaced, no-resolver passthrough)
