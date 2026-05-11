// packages/adapter-sandbox/src/index.ts
// Public surface of `@stageflip/adapter-sandbox` (T-444 — FINAL Phase
// 14 γ task). Three runners (in-process / sidecar / remote-service), a
// factory that dispatches on `descriptor.sandbox.kind`, an in-memory
// audit-event emitter, and the typed sandbox-invocation envelope.
//
// Determinism posture: this package is operational glue and is NOT in
// the determinism scan path. The sidecar runner uses `setTimeout` /
// `setInterval`; the audit emitter is pure sync. No `Date.now` /
// `Math.random` / `fetch`.

export type {
  AdapterAuditEvent,
  AdapterCredential,
  AuditEmitter,
  ResourceLimits,
  SandboxInvocation,
  SandboxRunner,
} from './types.js';

export { InMemoryAuditEmitter } from './audit-emitter.js';

export { InProcessSandboxRunner, type InProcessCallable } from './in-process-runner.js';

export {
  RemoteServiceConfigError,
  RemoteServiceSandboxRunner,
  type EnvLookup,
  type HttpsCallable,
} from './remote-service-runner.js';

export {
  SidecarProtocolError,
  SidecarRpcError,
  SidecarSandboxRunner,
  type ReadMemoryRssMb,
  type SidecarChildHandle,
  type SidecarSandboxRunnerOptions,
  type SpawnSidecar,
} from './sidecar-runner.js';

export { SandboxFactory, type SandboxFactoryOptions } from './sandbox-factory.js';
