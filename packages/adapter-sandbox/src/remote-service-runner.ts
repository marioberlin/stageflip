// packages/adapter-sandbox/src/remote-service-runner.ts
// `RemoteServiceSandboxRunner` — wraps an HTTPS call to a third-party API
// (Tripo, Meshy, Seedance, Runway today). Credentials are forwarded as
// request headers; never as env vars or query strings.
//
// The runner ships with NO embedded fetch — the host injects an
// `HttpsCallable` seam. This keeps the package free of network I/O at
// import time (browser-bundle hygiene) and lets tests assert on the
// constructed URL + headers + body without a network stub.
//
// Determinism: pure dispatch. No clock. No RNG.

import type { AdapterAuditEvent, SandboxInvocation, SandboxRunner } from './types.js';

/**
 * Host-supplied HTTPS callable. Receives the resolved URL + headers +
 * body; returns the parsed response body. The host wires this to its
 * preferred client (fetch / undici / axios). Errors are propagated as
 * thrown exceptions — the runner translates these to `failed` audit
 * events.
 */
export type HttpsCallable = (
  url: string,
  headers: Readonly<Record<string, string>>,
  body: unknown,
) => Promise<unknown>;

/**
 * Resolves the base URL for an adapter invocation. Precedence:
 *   1. `credential.baseUrl` (per-tenant override; rare).
 *   2. `process.env[descriptor.sandbox.baseUrlEnvVar]` (production
 *      default — env var named in the descriptor at T-418).
 *   3. Throws `RemoteServiceConfigError` (the host must wire one
 *      or the other).
 *
 * Test seam: `envLookup` injectable. Production callers pass
 * `(k) => process.env[k]`.
 */
export type EnvLookup = (name: string) => string | undefined;

export class RemoteServiceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RemoteServiceConfigError';
  }
}

/**
 * `RemoteServiceSandboxRunner` — HTTPS-call wrapper with credential
 * injection + audit emission. Only handles descriptors with
 * `sandbox.kind === 'remote-service'`; the factory (`SandboxFactory`)
 * is responsible for routing.
 */
export class RemoteServiceSandboxRunner implements SandboxRunner {
  constructor(
    private readonly httpsCallable: HttpsCallable,
    private readonly envLookup: EnvLookup,
  ) {}

  async run<TOut>(invocation: SandboxInvocation): Promise<TOut> {
    const { descriptor, tenantId, credential, input, auditEmitter } = invocation;
    if (descriptor.sandbox.kind !== 'remote-service') {
      throw new Error(
        `RemoteServiceSandboxRunner: expected sandbox.kind 'remote-service'; got '${descriptor.sandbox.kind}'`,
      );
    }

    const baseEvent = {
      adapterId: descriptor.id,
      modality: descriptor.modality.kind,
      tenantId,
      sandboxKind: 'remote-service',
    } as const;

    const startEvent: AdapterAuditEvent = { kind: 'start', ...baseEvent };
    auditEmitter.emit(startEvent);

    try {
      const url = this.resolveBaseUrl(descriptor.sandbox.baseUrlEnvVar, credential);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Adapter-Id': descriptor.id,
        'X-Tenant-Id': tenantId,
      };
      if (credential?.apiKey !== undefined) {
        headers.Authorization = `Bearer ${credential.apiKey}`;
      }
      const result = (await this.httpsCallable(url, headers, input)) as TOut;
      const completeEvent: AdapterAuditEvent = { kind: 'complete', ...baseEvent };
      auditEmitter.emit(completeEvent);
      return result;
    } catch (cause) {
      const errorMessage = cause instanceof Error ? cause.message : String(cause);
      const failedEvent: AdapterAuditEvent = {
        kind: 'failed',
        ...baseEvent,
        errorMessage,
      };
      auditEmitter.emit(failedEvent);
      throw cause;
    }
  }

  private resolveBaseUrl(envVar: string, credential: SandboxInvocation['credential']): string {
    if (credential?.baseUrl !== undefined && credential.baseUrl.length > 0) {
      return credential.baseUrl;
    }
    const fromEnv = this.envLookup(envVar);
    if (fromEnv !== undefined && fromEnv.length > 0) {
      return fromEnv;
    }
    throw new RemoteServiceConfigError(
      `RemoteServiceSandboxRunner: no base URL — neither credential.baseUrl nor env '${envVar}' is set`,
    );
  }
}
