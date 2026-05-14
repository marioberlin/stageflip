---
'@stageflip/runtimes-interactive': minor
---

Add `BrowserLivePreview` host for the interactive tier — React component + lifecycle wrapper around `InteractiveMountHarness`, gated by `tenantPolicy.featuresInteractive` per ADR-005 §D3/§D5. Preview-mode eligible; GA still gated on T-405 human security sign-off (T-398).
