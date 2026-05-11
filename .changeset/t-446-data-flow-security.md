---
'@stageflip/adapters-core': minor
---

T-446 — per-provider data-flow security audit (Phase 14 δ second
task; Lock-in).

`@stageflip/adapters-core` now exports a strict `SecurityManifest`
Zod schema. Every reference adapter (T-426..T-434) ships a sidecar
`packages/<pkg>/security.json` matching this shape, declaring:

- **Perimeter** — `in-process` (host process), `sidecar-local`
  (local subprocess), or `remote-network` (third-party HTTPS).
- **What leaves the perimeter** — prompt? input bytes? tenant id?
  cache key?
- **PII surface** — voice-clone reference samples? user content?
- **Network endpoint** — for remote-network perimeter only; bare
  DNS hostname + protocol + auth method.
- **Provider retention** — does the provider retain input/output?
  for how long? per ToS or tenant-controlled?
- **Audit signal coverage** — which T-444 `AdapterAuditEvent` kinds
  + T-445 `AdapterUsageEvent` fields suffice for forensic
  reconstruction.
- **`lastReviewedAt`** — ISO date of the most recent audit cycle.

A new CI gate `pnpm check-data-flow-security` (script:
`scripts/check-data-flow-security.ts`) discovers every adapter
package, parses its sidecar manifest, validates against the Zod
schema, and asserts manifest-vs-descriptor consistency:

- `descriptor.sandbox.kind === 'in-process'` →
  `manifest.perimeter === 'in-process'` AND no
  `dataLeavingPerimeter` flags AND no `networkEndpoint`.
- `descriptor.sandbox.kind === 'sidecar'` →
  `manifest.perimeter === 'sidecar-local'` AND no `networkEndpoint`.
- `descriptor.sandbox.kind === 'remote-service'` →
  `manifest.perimeter === 'remote-network'` AND `networkEndpoint`
  present.

Inaugural state: 9 reference adapters + 9 manifests + 9 PASS.

Plus the inaugural human-readable audit report at
`docs/security/data-flow-audit-2026-05-11.md` covering all 5
Phase 14 β modalities (tts / three-d / video-gen / music-gen / sfx)
across all 9 reference adapters. Five adapters keep all input and
output inside the StageFlip trust boundary (kokoro / ace-step / yue
/ stable-audio-open / fish-speech); four exit to the network
(tripo / meshy / seedance / runway); one handles voice-clone PII
(fish-speech, sidecar-local).

§13 statement: NOT a structural extension. The manifest is a
sidecar JSON file — no new field on `AdapterDescriptor`,
`RIRElement`, `RIRDocument`, `ClipKindBinding`, or any document-tree
node. No new degree of freedom in the renderer pipeline. Render
verification N/A.
