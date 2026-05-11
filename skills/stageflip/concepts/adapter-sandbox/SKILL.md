---
title: Adapter sandbox model — per-kind SandboxRunner + credential scoping + audit emission
id: skills/stageflip/concepts/adapter-sandbox
tier: concept
status: substantive
last_updated: 2026-05-11
owner_task: T-444
related:
  - skills/stageflip/concepts/provider-seam/SKILL.md
  - skills/stageflip/concepts/cost-budget/SKILL.md
  - skills/stageflip/concepts/tenant-settings/SKILL.md
  - skills/stageflip/concepts/storage-contract/SKILL.md
---

# Adapter sandbox model

Third-party (and first-party) adapters run through a `SandboxRunner`
dispatched by their declared `AdapterDescriptor.sandbox.kind`. The host
forwards ONLY scoped credentials (one adapter per call) and tags every
invocation with an `AdapterAuditEvent` for the downstream T-446
security-audit pipeline.

T-444 ships the FINAL Phase 14 γ piece — the dependency-graph
blocker for T-446 (security audit) → T-447 (GA readiness).

## Three runners, one factory

```
                    ┌────────────────────┐
                    │ FallbackChain      │
                    │ Executor           │ (sandbox-aware mode)
                    └─────────┬──────────┘
                              │
                              v
                    ┌────────────────────┐
                    │  SandboxFactory    │  ── descriptor.sandbox.kind
                    └─────────┬──────────┘
          ┌───────────────────┼───────────────────┐
          v                   v                   v
┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
│ InProcess          │ │ Sidecar            │ │ RemoteService      │
│ SandboxRunner      │ │ SandboxRunner      │ │ SandboxRunner      │
│ (no-op wrapper)    │ │ (spawn + JSON-RPC  │ │ (HTTPS w/ scoped   │
│                    │ │  stdio + kill +    │ │  credentials)      │
│                    │ │  resource limits)  │ │                    │
└────────────────────┘ └────────────────────┘ └────────────────────┘
```

## Sandbox kinds

| Kind | v1 isolation | When |
|---|---|---|
| `in-process` | NONE (no-op wrapper) | Trust boundary: StageFlip-built Apache-2.0/MIT adapters (kokoro, fish-speech, ace-step, yue, stable-audio-open). |
| `sidecar` | Separate process; stdio JSON-RPC; resource limits | Future ONNX-via-Python adapters; any adapter that needs OS-level isolation. |
| `remote-service` | Network boundary | All BYO API adapters (tripo, meshy, seedance, runway). |
| `wasm-sandbox` | NOT IMPLEMENTED in v1 — factory throws | v2 work; only ships when a WASM-runtime adapter does. |

### Trust boundary documentation (v1)

`InProcessSandboxRunner` is a no-op wrapper — the adapter call runs in
the host Node process. This is intentional: every adapter shipped
today is StageFlip-built on Apache-2.0 / MIT models we audit. If a
third-party `in-process` adapter ever lands in-tree, this runner is
the place to add `vm.Context` isolation.

## Credential scoping

`TenantAdapterCredentialsStore.getCredentials(tenantId, adapterId)`
returns the credential for a SINGLE `(tenantId, adapterId)` pair — or
`null`. The host forwards ONLY this object to the adapter; the
adapter never sees credentials for OTHER adapters even within the
same tenant.

Credential shape:

```ts
type AdapterCredential = {
  apiKey?: string;   // forwarded as `Authorization: Bearer <apiKey>`
  baseUrl?: string;  // overrides descriptor.sandbox.baseUrlEnvVar
};
// At least one of apiKey / baseUrl must be present — empty {} rejected.
```

Per-runner credential forwarding:

- **In-process** — passed as the third arg of `InProcessCallable`.
- **Sidecar** — passed inside the `init` JSON-RPC `params.credential`.
  NOT via env vars or argv (which leak to `ps` / `/proc/<pid>/environ`).
- **Remote-service** — passed as `Authorization: Bearer` header.

## Resource limits (sidecar-only)

`AdapterDescriptor.resourceLimits?` — top-level optional field:

```ts
{ maxMemoryMb?: number; maxCpuMs?: number; maxDiskMb?: number; }
```

Enforcement (v1):

| Dimension | Mechanism | Status |
|---|---|---|
| `maxCpuMs` | Wall-clock timer (NOT real CPU time) — SIGKILL on expiry | Enforced |
| `maxMemoryMb` | Userspace poll (default 500ms) via injectable `readMemoryRssMb(pid)` — SIGKILL on overage | Enforced (best-effort) |
| `maxDiskMb` | DECLARED ONLY in v1 | Enforcement DEFERRED to T-447 (cgroups) |

On breach, emits `AdapterAuditEvent` with `kind:
'killed-for-resource-limit'` and the offending dimension.

## Audit events (T-446 consumer-ready)

Every invocation emits `start` immediately, then ONE of `complete` /
`failed` / `killed-for-resource-limit`:

```ts
type AdapterAuditEvent =
  | { kind: 'start';     adapterId; modality; tenantId; sandboxKind }
  | { kind: 'complete';  adapterId; modality; tenantId; sandboxKind; durationMs? }
  | { kind: 'failed';    adapterId; modality; tenantId; sandboxKind; errorMessage }
  | { kind: 'killed-for-resource-limit';
      adapterId; modality; tenantId; sandboxKind: 'sidecar'; dimension: 'cpu' | 'memory' | 'disk' };
```

The default `InMemoryAuditEmitter` is a ring buffer (capacity 1000;
drops oldest). T-446 wires `CloudLoggingAuditEmitter`.

## Wiring — `FallbackChainExecutor` sandbox-aware mode

```ts
await executor.execute(adapters, () => { throw 0; }, {
  sandboxFactory,        // SandboxFactory instance
  sandboxContext: {
    tenantId,
    credentialFor: (adapter) => credentialsStore.getCredentials(tenantId, adapter.id),
    auditEmitter,
    inputFor: (adapter) => assembleAdapterInput(adapter),
  },
});
```

When `sandboxFactory + sandboxContext` are set, each adapter call
routes through `factory.pick(adapter).run(invocation)` — the
caller's `call(adapter)` arg is IGNORED. When omitted, the executor
falls back to the original direct-call mode (backwards-compat with
T-418-era tests).

## §13 structural extension — option 3 deferral

T-444 introduces two new degrees of freedom:

1. `AdapterDescriptor.resourceLimits?` — sidecar-only metadata.
2. `TenantSettings.adapterCredentials?` — per-tenant + per-adapter
   credential map.

Both are metadata; neither participates in the RIR document tree,
threads into a renderer, produces visible output, or alters parity
goldens. Pixel-level verification N/A; evidence is unit-test +
contract-test roundtrip. Adapter-regression snapshots
(`packages/adapter-regression/snapshots/*.json`) remain stable —
the canonicalizer omits absent optional keys.

## v2 roadmap

- **Real cgroups enforcement** for sidecar `maxMemoryMb` / `maxDiskMb`
  (T-447 GA hardening).
- **`wasm-sandbox` runner** — when a WASM-runtime adapter ships.
- **`vm.Context` isolation for `in-process`** — if a third-party
  Apache-2.0 adapter ever lands in-tree.
- **Sidecar warm-pool** — per-invocation spawn-then-kill is the v1
  design; pooling is a perf optimization.
- **Production audit transport** — `CloudLoggingAuditEmitter` lands
  in T-446.

## Package layout

```
packages/adapter-sandbox/                                  # T-444
  src/
    types.ts                  AdapterCredential, ResourceLimits, SandboxInvocation, AdapterAuditEvent
    audit-emitter.ts          InMemoryAuditEmitter (ring buffer)
    in-process-runner.ts      InProcessSandboxRunner (no-op wrapper)
    sidecar-runner.ts         SidecarSandboxRunner (spawn + RPC + limits)
    remote-service-runner.ts  RemoteServiceSandboxRunner (HTTPS)
    sandbox-factory.ts        Dispatches on descriptor.sandbox.kind

packages/storage/
  src/
    tenant-adapter-credentials.ts        Zod schema for credential + map
    tenant-adapter-credentials-store.ts  Facet (mirror of TenantCostTrackerStore)
    tenant-settings.ts                   Extended with `adapterCredentials?`

packages/adapters-core/
  src/
    adapter-descriptor.ts                Extended with `resourceLimits?`
    fallback-executor.ts                 Extended with `sandboxFactory + sandboxContext`
```
