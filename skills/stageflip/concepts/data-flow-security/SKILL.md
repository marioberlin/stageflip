---
title: Data-flow security — per-adapter SecurityManifest + CI gate + audit cadence
id: skills/stageflip/concepts/data-flow-security
tier: concept
status: substantive
last_updated: 2026-05-15
owner_task: T-446
related:
  - skills/stageflip/concepts/adapter-sandbox/SKILL.md
  - skills/stageflip/concepts/usage-telemetry/SKILL.md
  - skills/stageflip/concepts/provider-seam/SKILL.md
---

# Data-flow security

Every reference adapter declares its data-flow posture in a sidecar
`SecurityManifest` (`packages/<pkg>/security.json`). The
`pnpm check-data-flow-security` CI gate (T-446) enforces:

1. Every adapter package ships a manifest.
2. Every manifest matches the strict `SecurityManifest` Zod schema.
3. Every manifest is consistent with the adapter's
   `AdapterDescriptor.sandbox.kind`.

T-446 is **Phase 14 δ second task; Lock-in**. It is gated by T-444
(sandbox + audit emitter) + T-445 (usage telemetry) — the manifest's
`auditSignal` field references both event classes. T-446 is itself
one of T-447's GA-readiness criteria ("data-flow audited and
codified for all 9 reference adapters").

## Why a sidecar manifest, not a descriptor field

The manifest is intentionally OUT-OF-BAND from `AdapterDescriptor`:

- Loaded only by the CI gate + the audit-report generator. Runtime
  paths never see it.
- Keeps `AdapterDescriptor` lean. Security metadata adds zero cost
  to adapter registration / dispatch.
- Audit cycles update `lastReviewedAt` on the manifest without
  touching the descriptor. ADR-007 §D1 stays stable.

## Manifest shape

```ts
interface SecurityManifest {
  adapterId: string;           // kebab-case; matches descriptor.id
  perimeter: 'in-process' | 'sidecar-local' | 'remote-network';
  dataLeavingPerimeter: {
    prompt: boolean;
    inputBytes: boolean;
    tenantId: boolean;
    cacheKey: boolean;
  };
  pii: {
    voiceClone: boolean;
    userContent: boolean;
  };
  networkEndpoint?: {           // present iff perimeter === 'remote-network'
    hostname: string;
    protocol: 'https';
    authMethod: 'bearer-token' | 'api-key-header';
  };
  dataRetention: {
    providerRetainsInput: boolean;
    providerRetainsOutput: boolean;
    retentionDurationDays?: number;
    retentionPolicy: 'tenant-controlled' | 'provider-default' | 'unknown';
  };
  auditSignal: {
    relevantAuditEvents: ReadonlyArray<       // subset of T-444 AdapterAuditEvent kinds
      'start' | 'complete' | 'failed' | 'killed-for-resource-limit'
    >;
    relevantUsageFields: ReadonlyArray<       // subset of T-445 AdapterUsageEvent fields
      'tenantId' | 'adapterId' | 'modality' | 'latencyMs' | 'costAmount' | 'outcome' | 'timestamp'
    >;
  };
  lastReviewedAt: string;       // ISO date YYYY-MM-DD
}
```

Strict Zod at every level. Cross-field invariant:
`networkEndpoint` is PRESENT iff
`perimeter === 'remote-network'`.

## Perimeter kinds — meaning + invariants

| Perimeter | When | Invariants (gate-enforced) |
|---|---|---|
| `in-process` | descriptor.sandbox.kind = `'in-process'` OR `'wasm-sandbox'` | `dataLeavingPerimeter.*` all `false`; `networkEndpoint` absent |
| `sidecar-local` | descriptor.sandbox.kind = `'sidecar'` | `networkEndpoint` absent (local subprocess; no network exit) |
| `remote-network` | descriptor.sandbox.kind = `'remote-service'` | `networkEndpoint` present |

The CI gate enforces these invariants in
`checkManifestDescriptorConsistency`. A manifest that says
`'in-process'` while the descriptor says `'remote-service'` is
INCONSISTENT and blocks merge.

## CI gate semantics

`pnpm check-data-flow-security` (script:
`scripts/check-data-flow-security.ts`) walks `packages/` for adapter-
conforming `package.json` entries (same prefix discovery as
`check-asset-licenses`), then per package:

1. **MISSING** — package exports a descriptor but no
   `security.json`. FAIL.
2. **PARSE-ERROR** — file present but not valid JSON. FAIL.
3. **INVALID** — JSON parses but rejected by Zod (missing field,
   wrong type, unknown key). FAIL.
4. **INCONSISTENT** — manifest disagrees with descriptor
   (`adapterId` mismatch; perimeter ≠ sandbox-kind expectation;
   `networkEndpoint` presence wrong). FAIL.
5. **ORPHAN** — `security.json` present but package exports no
   descriptor. FAIL.
6. **PASS** — manifest present, valid, consistent.

Inaugural state (T-446 ship): 9 reference adapters, 9 manifests,
9 PASS, exit 0.

## Audit cadence

- **Per-PR trigger**: the CI gate enforces every PR.
- **Periodic re-review**: at minimum every 90 days, OR on any
  ADR-007 §D4 sandbox-model change.
- **Format**: append a new
  `docs/security/data-flow-audit-YYYY-MM-DD.md`; update each
  affected manifest's `lastReviewedAt`. Prior reports retained as a
  historical record.

The inaugural report lives at
`docs/security/data-flow-audit-2026-05-11.md`. It covers all 9
reference adapters across the 5 Phase 14 β modalities (tts,
three-d, video-gen, music-gen, sfx).

## How to add a new adapter

1. Author the adapter and its `AdapterDescriptor`.
2. Author `packages/<pkg>/security.json` matching
   `SecurityManifest`. Match the descriptor's `sandbox.kind`:
   - `in-process` → `perimeter: 'in-process'`, no
     `dataLeavingPerimeter` flags, no `networkEndpoint`.
   - `sidecar` → `perimeter: 'sidecar-local'`, no `networkEndpoint`.
   - `remote-service` → `perimeter: 'remote-network'` +
     `networkEndpoint` with the bare DNS hostname.
3. `pnpm check-data-flow-security` should PASS locally.
4. In the same PR, update the live
   `docs/security/data-flow-audit-YYYY-MM-DD.md` (or open one if
   the cadence calls for a fresh dated report) with per-adapter
   findings.

## Phase 13 frontier-clip provider seams (R-17)

Closed 2026-05-15 per PO direction (originally deferred to post-GA
hardening sprint; greenlit early). The 5 Phase 13 frontier-clip
provider seams now ship the same sidecar `security.json` convention
as Phase 14 adapters, even though they are not adapter packages.

**Covered families** (one manifest each, co-located with the clip
source):

| Family | Manifest path | Seam shape |
|---|---|---|
| `voice` | `packages/runtimes/interactive/src/clips/voice/security.json` | host-injected `TranscriptionProvider` (Web Speech API in v1; cloud TTS retroactive via Phase 14 ADR-006) |
| `ai-chat` | `packages/runtimes/interactive/src/clips/ai-chat/security.json` | host-injected `LLMChatProvider` via `@stageflip/llm-abstraction` |
| `live-data` | `packages/runtimes/interactive/src/clips/live-data/security.json` | host-injected `LiveDataProvider` (`globalThis.fetch` typically) |
| `web-embed` | `packages/runtimes/interactive/src/clips/web-embed/security.json` | iframe-embedded origin (no separate provider; the iframe IS the seam) |
| `ai-generative` | `packages/runtimes/interactive/src/clips/ai-generative/security.json` | host-injected `AiGenerativeProvider` |

Each manifest uses an `adapterId` of the form `frontier-clip-<family>`
(kebab-case, schema-compliant). All 5 declare
`perimeter: 'remote-network'` and a placeholder `networkEndpoint`
hostname of the form `host-injected.<seam>.local` because the actual
destination is host-injected at mount time and not known at clip-
authoring time.

**CI gate extension** —
`scripts/check-data-flow-security.ts` walks
`packages/runtimes/interactive/src/clips/<family>/` for each family in
`FRONTIER_CLIP_FAMILIES_REQUIRING_MANIFEST` and validates
`security.json` with the same Zod parse used for adapters. Failure
modes 1–3 (MISSING / PARSE-ERROR / INVALID) apply; failure modes 4–5
(INCONSISTENT / ORPHAN) do not, because frontier-clip seams have no
`AdapterDescriptor` to compare against. Source rows are tagged
`frontier-clip:<family>` to distinguish them from adapter rows tagged
`@stageflip/<adapter>`.

**Why retrofit, not redesign** — the retrofit is verbatim against the
Phase 14 manifest convention because audit semantics are identical:
the question "what data leaves the StageFlip perimeter via this seam?"
has the same shape regardless of whether the seam lives in an adapter
package or inside `@stageflip/runtimes-interactive`. Auditability now
scales to third-party provider plug-ins for any of the 5 families.

This closes T-403 R-17 from
`docs/security-review-track-a.md` (§5 R-17 row + §7.2 R-17 bullet).

## Related

- T-444 — adapter sandbox + audit emitter
  ([SKILL](../adapter-sandbox/SKILL.md))
- T-445 — usage telemetry
  ([SKILL](../usage-telemetry/SKILL.md))
- T-447 — GA readiness (consumer of T-446's gate)
- ADR-007 §D3 — tenant license policy (orthogonal filter)
- ADR-008 §D13 — per-modality license whitelist (orthogonal gate at
  `pnpm check-asset-licenses`)
