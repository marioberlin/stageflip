---
"@stageflip/renderer-cdp": patch
---

F-18 — bump default Puppeteer `protocolTimeout` from 180s (puppeteer-core default) to 600s.

Observed 4× during the 2026-05-07 cluster-G session: `Page.captureScreenshot timed out` flake on slow CI runners under font-heavy + shimmer-gradient render workloads (PR #410 T-373; PR #418 T-372 ffmpeg-install hang + screenshot timeout; PR #422 T-371 — three consecutive timeouts before a fresh runner cleared). Local render of identical fixtures completes in <90s. The 180s default is exceeded purely by CI-environment slowness; bumping to 600s gives ample slack on the slowest GitHub-Actions runners while still failing fast on a genuinely wedged session.

Implemented as `DEFAULT_CDP_PROTOCOL_TIMEOUT_MS = 600_000` exported from `@stageflip/renderer-cdp`. Caller of `createPuppeteerBrowserFactory` may override via `protocolTimeout` opt; passing `protocolTimeout: undefined` explicitly opts out entirely (revert to puppeteer-core's default).
