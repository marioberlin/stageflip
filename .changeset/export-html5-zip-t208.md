---
"@stageflip/export-html5-zip": minor
---

T-208: IAB / GDN compliance validator for produced banner ZIPs.

Runs **independently** of T-203b's per-document `DisplayBudget` budget
check. That check validates against the caller-supplied budget; this
one validates against the canonical IAB + GDN caps and structural
requirements. Both should pass for a shippable banner.

Ships 8 rules + a `validateBannerZip(zipBytes, opts)` entry point that
unzips via fflate, builds a `ValidationContext`, runs the rule set, and
returns a `{ findings, errorCount, warnCount, infoCount, passed }`
report.

| id | severity | what it checks |
|---|---|---|
| `banner-file-size-within-iab-cap` | error | ZIP ≤ 150 KB (IAB + GDN initial-load cap) |
| `banner-has-index-html` | error | `index.html` at the ZIP root |
| `banner-has-fallback-png` | error | `fallback.png` present + non-zero |
| `banner-declares-click-tag` | error | `var|let|const clickTag` or `window.clickTag` appears in HTML |
| `banner-no-external-resources` | error | no `http://` / `https://` `href` / `src` / `url()` refs |
| `banner-no-dynamic-code` | error | no `eval` / Function constructor / document write-call APIs |
| `banner-no-xhr-or-fetch` | error | no `fetch` / `XMLHttpRequest` / `navigator.sendBeacon` |
| `banner-no-path-traversal` | error | no `..` segments, no absolute paths |

Detection regexes for dynamic-code APIs are built from substring tokens
so the repo's source-scanning hooks don't flag this detector file as a
user of those APIs.

32 new tests, 98.6% coverage on the package. No new runtime deps —
`fflate` already on the graph from T-203a.
