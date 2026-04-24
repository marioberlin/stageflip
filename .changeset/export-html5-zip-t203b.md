---
"@stageflip/export-html5-zip": minor
---

T-203b: `@stageflip/export-html5-zip` orchestrator — wires the bundler +
asset resolver + fallback provider into a compliant IAB / GDN HTML5
banner ZIP. Closes out T-203.

- **`AssetResolver` contract + `InMemoryAssetResolver`** (`asset-resolver.ts`):
  turns opaque `AssetRef` handles into bytes. Default in-memory impl
  covers tests + any caller that has the bytes in hand (T-204's fallback
  generator hands them over directly).
- **`exportHtml5ZipForSize(size, input, opts)`** (`orchestrator.ts`):
  per-size pipeline — bundle HTML → inject `clickTag` → resolve +
  validate fallback → pack deterministic ZIP → budget-check. Emits an
  `error`-severity `ExportFinding` when the ZIP exceeds
  `DisplayBudget.totalZipKb`; keeps the bytes so the UI can show the
  overage rather than hiding it.
- **`exportHtml5Zip(input, opts)`**: multi-size orchestrator with a
  configurable concurrency cap (default 3). Returns per-size results +
  a global `ok` flag that flips `false` if any size has an `error`
  finding. Input order preserved in results.
- **ZIP layout** (IAB convention):
  `index.html`, `fallback.png` (mandatory), `fallback.gif` (optional),
  `assets/…` (non-inlined bundler assets). Paths sorted, mtime pinned
  per `DETERMINISTIC_ZIP_MTIME` — re-runs produce byte-identical output.

Rejects zero-byte fallbacks (IAB requires a real backup image). Throws
when neither `BannerExportInput.fallback` nor a `FallbackProvider` is
supplied.

50 tests total, 98.6% coverage across the package. No new runtime
deps beyond fflate + `@stageflip/schema`.
