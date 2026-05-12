---
'@stageflip/scripts': minor
---

T-485 — Vendor adapter regression suite. Ships `check-audience-vendor-parity`
CI gate that walks the 6 audience-backend adapters (audience-native + 5
vendors) and asserts each descriptor's `supportedClipKinds` +
`supportsMotionNative` match the ADR-009 §D8 vendor parity matrix. Drift
between the descriptor and the ADR fails the gate. Full method-level
regression (cacheKey + output SHA) for vendor adapters is deferred to the
production-wire-up tasks (T-479a..T-483a).
