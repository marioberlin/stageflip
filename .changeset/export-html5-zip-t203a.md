---
"@stageflip/export-html5-zip": minor
---

T-203a: `@stageflip/export-html5-zip` — contracts + deterministic ZIP +
clickTag injector.

First of the T-203 tranches (T-203b will wire the orchestrator that
drives `HtmlBundler`, embeds fallback assets, and enforces
`DisplayBudget` caps).

- **Contracts** (`types.ts`): `BannerSize`, `HtmlBundle`, `HtmlBundler`,
  `FallbackProvider`, `BannerExportInput`, `BannerExportResult`,
  `MultiSizeExportResult`, `ExportFinding`. Re-uses `BannerFallback` +
  `DisplayBudget` from `@stageflip/schema`; this package owns no
  rendering logic — it only wires pluggable bundlers and a fallback
  provider into a compliant ZIP.
- **Deterministic ZIP** (`zip.ts`): `packDeterministicZip(files)` via
  fflate (MIT, already on the license whitelist). Sorted paths, fixed
  mtime at 2000-01-01 UTC, duplicate + path-injection checks. Two calls
  with identical inputs produce byte-identical output — needed so parity
  harnesses (T-188-equivalent display fixtures, future) and content-hash
  caches diff ZIPs at the byte level.
- **clickTag injector** (`click-tag.ts`): `injectClickTagScript(html,
  clickTag)` declares `var clickTag = ...` at window scope inside
  `<head>`. Idempotent via a `stageflip-click-tag` marker comment so
  re-running on already-injected HTML replaces the script in place.
  `escapeClickTagForScript` rejects `</script` sequences and escapes
  backslashes / quotes / line terminators. `DEFAULT_CLICK_TAG_PLACEHOLDER`
  exposes the IAB `%%CLICK_URL_UNESC%%%%DEST_URL%%` macro.

31 tests, 100% coverage on `zip.ts`, 95% on `click-tag.ts` (single
defensive-throw branch unreachable given the preceding regex success).
No new runtime deps beyond `fflate` + `@stageflip/schema`.
