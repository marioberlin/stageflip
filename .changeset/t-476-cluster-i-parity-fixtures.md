---
'@stageflip/parity-cli': patch
---

T-476 — Cluster I parity fixtures + audience-clip generator CLI.

Ships eleven parity-fixture directories under `parity-fixtures/audience/`
(one per `AudienceClipKind`) carrying the `manifest.json` + `snapshot.json`
+ `thresholds.json` triple, plus `scripts/generate-audience-clip-parity-fixture.ts`
— a CLI parallel to `generate-preset-parity-fixture.ts` that drives the
audience runtime's static-fallback path with the fixture's snapshot as
input and writes `golden-frame-<n>.png` to the fixture directory.

Carries the **§13 end-to-end render verification** obligation that T-451
(ADR-010) deferred — per the T-451 §13 statement, this PR + the PO
ratification sign-off post-merge constitute the means-of-verification
(option 2 — reference fixture sign-off via standard parity-fixture flow).
Goldens land UNSIGNED in this PR; PO inspection kicks off on merge.
