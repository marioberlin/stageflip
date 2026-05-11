---
title: Data-flow security — per-adapter SecurityManifest + CI gate + audit cadence
id: skills/stageflip/concepts/data-flow-security
tier: concept
status: substantive
last_updated: 2026-05-11
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

## Related

- T-444 — adapter sandbox + audit emitter
  ([SKILL](../adapter-sandbox/SKILL.md))
- T-445 — usage telemetry
  ([SKILL](../usage-telemetry/SKILL.md))
- T-447 — GA readiness (consumer of T-446's gate)
- ADR-007 §D3 — tenant license policy (orthogonal filter)
- ADR-008 §D13 — per-modality license whitelist (orthogonal gate at
  `pnpm check-asset-licenses`)
