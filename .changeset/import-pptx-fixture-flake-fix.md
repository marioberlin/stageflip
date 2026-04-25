---
"@stageflip/import-pptx": patch
---

Drop the flaky `fixtures.test.ts > "all five fixture builders are stable across two builds"` assertion. `fflate.zipSync` embeds 2-second-resolution mtimes, so two consecutive `build()` calls only produce byte-identical output when they land in the same 2-second window. The functional determinism contract (parser output + loss-flag ids stable across re-imports) is pinned by `parsePptx.test.ts` and is what actually matters for downstream consumers.
