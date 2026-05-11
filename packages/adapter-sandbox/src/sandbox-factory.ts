// packages/adapter-sandbox/src/sandbox-factory.ts
// `SandboxFactory` — picks the right `SandboxRunner` for an
// `AdapterDescriptor` based on `descriptor.sandbox.kind`.
//
// The factory is constructed with the three runner instances already
// wired (the host owns the wiring — it knows the `inProcessCallable`,
// `httpsCallable`, `spawnSidecar`, and audit emitter). Dispatch is
// pure read-of-discriminant.

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import type { SandboxRunner } from './types.js';

/** Construction options for the factory — one runner per supported kind. */
export interface SandboxFactoryOptions {
  readonly inProcess: SandboxRunner;
  readonly sidecar: SandboxRunner;
  readonly remoteService: SandboxRunner;
}

/**
 * `SandboxFactory` — `pick(descriptor)` returns the runner for the
 * descriptor's declared sandbox kind. Throws on `'wasm-sandbox'`
 * (declared at T-418 but no runner ships in T-444 — v2 work).
 */
export class SandboxFactory {
  constructor(private readonly opts: SandboxFactoryOptions) {}

  pick(descriptor: AdapterDescriptor): SandboxRunner {
    const kind = descriptor.sandbox.kind;
    switch (kind) {
      case 'in-process':
        return this.opts.inProcess;
      case 'sidecar':
        return this.opts.sidecar;
      case 'remote-service':
        return this.opts.remoteService;
      case 'wasm-sandbox':
        throw new Error(
          `SandboxFactory: 'wasm-sandbox' is not implemented in v1 (adapter '${descriptor.id}'); see docs/tasks/T-444.md "Out of scope".`,
        );
      default: {
        const exhaustive: never = kind;
        throw new Error(`SandboxFactory: unknown sandbox kind '${String(exhaustive)}'`);
      }
    }
  }
}
