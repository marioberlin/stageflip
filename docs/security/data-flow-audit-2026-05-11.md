# Data-flow security audit — 2026-05-11

**Audit lead**: implementer for T-446.
**Scope**: every reference adapter shipped by T-426..T-434 (the 9
Phase 14 β reference adapters that constitute the
[Provider Seam](../../skills/stageflip/concepts/provider-seam/SKILL.md)
inaugural surface).
**Source of truth**: each adapter's sidecar
`packages/<pkg>/security.json` (machine-readable) +
`AdapterDescriptor` in `packages/<pkg>/src/descriptor.ts`. The
`pnpm check-data-flow-security` CI gate (T-446) enforces both.

This is the **inaugural** audit. Future audit cycles append a new
dated report at `docs/security/data-flow-audit-YYYY-MM-DD.md` and
update each manifest's `lastReviewedAt`. Prior reports are retained
as a historical record.

---

## Method

Per adapter, the audit reviews five dimensions:

1. **Perimeter** — `in-process` (host process), `sidecar-local`
   (local subprocess; PII stays on host) or `remote-network`
   (third-party HTTPS endpoint).
2. **Data leaving the perimeter** — prompt? input bytes? tenant id?
   cache key?
3. **PII surface** — voice-clone reference samples? user-uploaded
   media?
4. **Provider retention** — does the third party retain the
   request/response? for how long? per ToS-stated default or
   tenant-controlled?
5. **Audit signal coverage** — which T-444 `AdapterAuditEvent`
   kinds + T-445 `AdapterUsageEvent` fields suffice to reconstruct
   the call for forensics.

Notes:

- All four `remote-service` adapters use HTTPS. None publish a
  machine-readable retention policy at the API level; per-tenant ToS
  acceptance is the gate. The audit's `retentionPolicy:
  'provider-default'` reflects this absence.
- Tenants who require stricter handling than the provider default
  should refuse `remote-network` adapters at the per-tenant license
  policy layer (ADR-007 §D3).
- All adapters emit the full T-444 audit-event sequence
  (`start` + terminal). Sidecar (Fish Speech) ALSO emits
  `killed-for-resource-limit` when T-444's resource-limit enforcer
  trips. `in-process` and `remote-service` adapters cannot trigger
  that signal.

---

## Modality 1 — Text-to-speech (TTS)

### kokoro (`@stageflip/tts-kokoro`)

- **Perimeter**: `in-process`. Kokoro v1 (~82M params) runs inline
  in the host. Nothing exits the StageFlip trust boundary.
- **Data leaving**: none.
- **PII**: none. Voice catalog is library-fixed (10 voices); no
  cloning support (`supportsVoiceClone: false`).
- **Retention**: not applicable (no third party).
- **Audit signal**: `start` / `complete` / `failed`. Usage event
  carries `tenantId`, `adapterId`, `modality`, `latencyMs`, `outcome`,
  `timestamp`. Cost is always `0` (free at the model level — host
  pays its own compute).

### fish-speech (`@stageflip/tts-fish-speech`)

- **Perimeter**: `sidecar-local`. Runs as a local Python subprocess
  managed by T-444's `SidecarSandboxRunner`. PII handed to the
  sidecar stays on the host.
- **Data leaving**: none (no network exit).
- **PII**: **voice-clone reference samples** + user-supplied prompt
  text. The adapter accepts a raw human voice sample as a clone
  reference; this is the most sensitive PII surface across the 9
  reference adapters. Held local; never transmitted to a third
  party.
- **Retention**: not applicable (no third party). Host-side storage
  of clone references is gated by the tenant's storage backend
  (ADR-001 + ADR-006 tenancy isolation).
- **Audit signal**: full `AdapterAuditEvent` set including
  `killed-for-resource-limit`. The sidecar enforces T-444's
  `maxMemoryMb` / `maxCpuMs` ceilings.

**Notable**: Fish Speech is the only `sidecar-local` adapter in the
inaugural 9. Its voice-clone PII surface is the primary security
consideration in the v1 P14 β cohort — tenants enabling Fish Speech
implicitly accept that raw voice samples will be processed in the
host's sidecar boundary.

---

## Modality 2 — 3D mesh generation (`three-d`)

### tripo (`@stageflip/3d-tripo`)

- **Perimeter**: `remote-network`. Calls `api.tripo3d.ai` over
  HTTPS. The `TRIPO_API_BASE_URL` env-var anchors the endpoint at
  the descriptor level; T-444's `RemoteServiceSandboxRunner` resolves
  it at call time.
- **Data leaving**: user prompt + (where applicable) reference image
  bytes. `tenantId` and `cacheKey` are NOT transmitted — both stay
  on host. Auth header (`Authorization: Bearer <apiKey>`) is the
  tenant's scoped credential per T-444.
- **PII**: user-uploaded image content (reference images for
  image-to-3D). No voice-clone surface.
- **Retention**: provider default. Tripo's public ToS does not
  publish a machine-readable retention duration as of 2026-05-11;
  `providerRetainsInput: true` + `providerRetainsOutput: true` is
  the conservative posture. Tenants who require stricter handling
  should refuse via tenant license policy.
- **Audit signal**: `start` / `complete` / `failed`. Usage event
  carries the full 7-field set including `costAmount` (`$0.50` per
  call at descriptor level).

### meshy (`@stageflip/3d-meshy`)

- **Perimeter**: `remote-network`. Calls `api.meshy.ai` over HTTPS.
- **Data leaving**: user prompt + reference image bytes. Auth via
  bearer token.
- **PII**: user-uploaded image content. No voice-clone.
- **Retention**: provider default (same posture as Tripo).
- **Audit signal**: same shape as Tripo. Cost `$0.20` per call.

**Differentiator note (three-d cohort)**: Tripo + Meshy share the
same data-flow posture. The cost/quality differentiation (Tripo
quad-clean topology vs Meshy auto-rigging) does not affect the
security posture. Tenant license posture filters both equivalently.

---

## Modality 3 — Video generation (`video-gen`)

### seedance (`@stageflip/video-seedance`)

- **Perimeter**: `remote-network`. Calls `fal.run` over HTTPS
  (the descriptor anchors `FAL_API_BASE_URL` — Seedance ships via
  the fal.ai inference platform).
- **Data leaving**: user prompt + (where applicable) reference
  image bytes (image-to-video mode). Auth via `api-key-header`
  (fal.ai's convention; differs from Runway/Tripo/Meshy which use
  `Authorization: Bearer <token>`).
- **PII**: user-uploaded image content.
- **Retention**: provider default. fal.ai's public terms reserve
  the right to retain inputs for the duration of the inference job
  + auditing.
- **Audit signal**: full 7-field usage event. Cost `$1.50` per call
  (descriptor level).

### runway (`@stageflip/video-runway`)

- **Perimeter**: `remote-network`. Calls `api.runwayml.com` over
  HTTPS.
- **Data leaving**: user prompt + reference image bytes. Auth via
  bearer token.
- **PII**: user-uploaded image content. No voice-clone (Runway
  Gen-4 emits silent video; audio pairing is an orchestrator
  concern).
- **Retention**: provider default. Runway's ToS does not publish a
  machine-readable retention duration; `providerRetainsInput: true`
  + `providerRetainsOutput: true` reflects the conservative
  posture.
- **Audit signal**: same shape. Cost `$2.00` per call
  (production-tier).

**Differentiator note (video-gen cohort)**: Seedance + Runway share
the same data-flow posture. Auth method differs (`api-key-header`
for Seedance via fal.run; `bearer-token` for Runway direct). The
manifest's `authMethod` field captures this divergence; the CI gate
does not pin a single value across the cohort.

---

## Modality 4 — Music generation (`music-gen`)

### ace-step (`@stageflip/music-acestep`)

- **Perimeter**: `in-process`.
- **Data leaving**: none.
- **PII**: none (no user-uploaded media; prompt is text only).
- **Retention**: not applicable.
- **Audit signal**: `start` / `complete` / `failed`. No cost.

### yue (`@stageflip/music-yue`)

- **Perimeter**: `in-process`.
- **Data leaving**: none.
- **PII**: none.
- **Retention**: not applicable.
- **Audit signal**: same as AceStep.

**Differentiator note (music-gen cohort)**: AceStep (MIT) +
YuE (Apache-2.0) are both `in-process`. License differs; security
posture is identical. Free at the model level.

---

## Modality 5 — Sound effects (`sfx`)

### stable-audio-open (`@stageflip/sfx-stable-audio`)

- **Perimeter**: `in-process`.
- **Data leaving**: none.
- **PII**: none.
- **Retention**: not applicable.
- **Audit signal**: same as music-gen cohort.

---

## Aggregate findings

| Adapter | Perimeter | Prompt exits | Input bytes exit | PII (voice clone) | PII (user content) | Provider retains | Hostname |
|---|---|---|---|---|---|---|---|
| kokoro | in-process | no | no | no | no | n/a | — |
| fish-speech | sidecar-local | no | no | **yes** | yes | n/a | — |
| ace-step | in-process | no | no | no | no | n/a | — |
| yue | in-process | no | no | no | no | n/a | — |
| stable-audio-open | in-process | no | no | no | no | n/a | — |
| tripo | remote-network | **yes** | **yes** | no | yes | yes (default) | api.tripo3d.ai |
| meshy | remote-network | **yes** | **yes** | no | yes | yes (default) | api.meshy.ai |
| seedance | remote-network | **yes** | **yes** | no | yes | yes (default) | fal.run |
| runway | remote-network | **yes** | **yes** | no | yes | yes (default) | api.runwayml.com |

### Five-of-nine stay in the perimeter

Five adapters (`kokoro`, `ace-step`, `yue`, `stable-audio-open`,
`fish-speech`) keep all input and output INSIDE the StageFlip trust
boundary. Tenants whose policy forbids remote inference may compose
a fully-local asset-generation stack across TTS + music + SFX
modalities using only these five.

### Four-of-nine exit to the network

Four adapters (`tripo`, `meshy`, `seedance`, `runway`) require the
prompt and (where applicable) reference image bytes to leave the
perimeter. None publish a machine-readable retention policy at the
API level — the manifest's `retentionPolicy: 'provider-default'`
acknowledges this. Tenants who need stricter handling should refuse
these adapters at the per-tenant license policy layer (ADR-007
§D3).

### One-of-nine handles voice-clone PII

`fish-speech` is the only adapter that accepts voice-clone
reference samples (raw human voice). Its `sidecar-local` perimeter
posture intentionally recognizes that the PII stays on the host —
never transmitted to a third party. Host-side storage of clone
references is gated by the tenant's storage backend tenancy
isolation (ADR-006).

### Audit signal coverage uniform

Every adapter emits T-444's full `AdapterAuditEvent` sequence
(`start` + one terminal) and T-445's `AdapterUsageEvent` with the
relevant 6–7 field subset. Forensic reconstruction of any call can
join on `(tenantId, adapterId, timestamp)` across both event
streams.

---

## Open questions for future audit cycles

1. **Provider-side retention policies** — none of the four
   `remote-network` providers publish a machine-readable retention
   duration. Future audit cycles should re-check; if a provider
   adds tenant-configurable retention, update the manifest to
   `retentionPolicy: 'tenant-controlled'` and populate
   `retentionDurationDays` where known.
2. **WASM sandboxing** — no `wasm-sandbox` adapter in the inaugural
   9. The `SecurityManifest` Zod schema + the CI gate already
   handle `wasm-sandbox` (it requires `perimeter: 'in-process'`).
3. **Production wire-up vs stub mode** — the 9 reference adapters
   ship in **stub mode** (T-426..T-434 deliberately stub the
   provider calls to avoid network dependencies in unit tests).
   Production wire-up tasks (T-426a, T-431a, etc.) carry the same
   security posture as declared here; this audit applies to BOTH
   stub mode and production wire-up by construction.
4. **Tripo / Meshy / fal.ai / Runway ToS revisions** — provider
   terms change over time. The next audit cycle should re-verify
   each `dataRetention` posture against the then-current ToS.

---

## Audit cadence

- **Trigger**: every new adapter PR (T-435's `check-adapter-
  regression` and T-446's `check-data-flow-security` both gate
  merges).
- **Periodic**: at minimum every 90 days, OR on any ADR-007 §D4
  sandbox-model change.
- **Format**: append a new `docs/security/data-flow-audit-YYYY-MM-
  DD.md`; update each affected manifest's `lastReviewedAt` field.

---

## Related

- `skills/stageflip/concepts/data-flow-security/SKILL.md` (this
  audit's concept skill)
- `skills/stageflip/concepts/adapter-sandbox/SKILL.md` (T-444)
- `skills/stageflip/concepts/usage-telemetry/SKILL.md` (T-445)
- `docs/decisions/ADR-007-provider-seam-pattern.md` §D3 (license
  policy filter) + §D4 (sandbox model)
- `docs/decisions/ADR-008-asset-generation.md` §D13 (per-modality
  license whitelist; the orthogonal license gate T-422 enforces)
