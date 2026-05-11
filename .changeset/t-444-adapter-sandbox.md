---
'@stageflip/adapter-sandbox': minor
'@stageflip/adapters-core': minor
'@stageflip/storage': minor
---

T-444 — adapter sandbox model (FINAL Phase 14 γ task).

Third-party (and first-party) adapters now run through a per-kind
`SandboxRunner` dispatched by `AdapterDescriptor.sandbox.kind`.
Per-adapter credentials live in a new `TenantAdapterCredentialsStore`
facet on `@stageflip/storage`; the host forwards ONLY the scoped
credential for the active adapter — never tenant-wide secrets. Every
invocation emits an `AdapterAuditEvent` for the T-446 security-audit
consumer.

New package: **`@stageflip/adapter-sandbox`** —

- `SandboxRunner` interface + `SandboxInvocation` envelope.
- `InProcessSandboxRunner` — no-op wrapper (trust-boundary v1).
- `SidecarSandboxRunner` — spawns a child process, JSON-RPC over
  stdio, kills on completion or resource-limit breach.
  Resource limits: `maxCpuMs` (wall-clock SIGKILL), `maxMemoryMb`
  (userspace poll SIGKILL), `maxDiskMb` (declared only — enforcement
  deferred to T-447).
- `RemoteServiceSandboxRunner` — wraps an injected `HttpsCallable`
  with credential injection (Authorization: Bearer) + URL resolution
  (credential.baseUrl > env var > throw).
- `SandboxFactory.pick(descriptor)` — dispatches on sandbox kind;
  throws on `'wasm-sandbox'` (v2 work).
- `InMemoryAuditEmitter` — bounded ring buffer (capacity 1000).

New public surfaces on `@stageflip/adapters-core`:

- `AdapterDescriptor.resourceLimits?` — optional top-level
  `{ maxMemoryMb?, maxCpuMs?, maxDiskMb? }`. Only meaningful for
  `sandbox.kind === 'sidecar'`.
- `FallbackChainExecutor.execute()` gained optional
  `sandboxFactory` + `sandboxContext` options. When set, each adapter
  call routes through the matching runner with `start` / `complete` /
  `failed` / `killed-for-resource-limit` audit events emitted along
  the way. Backwards-compatible — omitting both keeps the existing
  direct-call mode.
- `SandboxFactoryLike` / `SandboxRunnerLike` / `SandboxInvocationLike`
  structural-type exports (so the executor doesn't take a runtime
  dependency on `@stageflip/adapter-sandbox`).

New public surfaces on `@stageflip/storage`:

- `TenantSettings.adapterCredentials?` — optional
  `Record<adapterId, { apiKey?, baseUrl? }>` (kebab-case keys,
  empty `{}` credential rejected).
- `TenantAdapterCredentialsStore` interface +
  `InMemoryTenantAdapterCredentialsStore` impl. Mirrors
  `TenantCostTrackerStore` (T-443) and `TenantSettingsStore`
  (T-411a) patterns: `getCredentials` / `setCredentials` /
  `listAdapterIds` / `deleteCredentials`.
- `AdapterCredential` + `AdapterCredentialsMap` Zod schemas.

§13 structural extension — option 3 deferral. Both new schema fields
(`resourceLimits?` + `adapterCredentials?`) are metadata; they don't
participate in the RIR document tree, never render, and don't
reach parity goldens. Evidence: unit-test roundtrip + integration
tests for sandbox dispatch + contract tests for the new facet.
Adapter-regression snapshots stable — the canonicalizer omits
absent optional keys, so all 9 reference adapters' descriptor
SHA-256s in `packages/adapter-regression/snapshots/*.json` are
unchanged.

Unblocks **T-446** (security audit consumer of `AdapterAuditEvent`) →
**T-447** (GA readiness). After T-444 lands, Phase 14 γ is fully
complete; δ (Lock-in: T-445/T-446/T-447) opens.
