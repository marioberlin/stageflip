---
'@stageflip/renderer-cdp': patch
---

T-119: `reference-render.e2e.test.ts` honors `STAGEFLIP_E2E_ARTIFACT_DIR`
to route the 3 rendered MP4s to a stable path and skip the tmpdir
cleanup. Lets the new `render-e2e` CI job upload the outputs as a
build artifact. Default behavior (no env var) unchanged.
