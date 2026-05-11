// packages/adapter-sandbox/src/sidecar-runner.ts
// `SidecarSandboxRunner` — spawns a child process (Node or Python),
// hands the input across via JSON-RPC over stdio, and kills the child on
// completion or resource-limit breach.
//
// Protocol (minimal JSON-RPC 2.0):
//
//   Host → sidecar (stdin):
//     `{ "jsonrpc": "2.0", "id": 1, "method": "init",
//        "params": { "adapterId", "credential", "input" } }\n`
//
//   Sidecar → host (stdout, one JSON object per line):
//     `{ "jsonrpc": "2.0", "id": 1, "result": <payload> }\n`
//   OR
//     `{ "jsonrpc": "2.0", "id": 1,
//        "error": { "code": <num>, "message": <string> } }\n`
//
// Credentials are forwarded inside the JSON-RPC `init` `params` — NOT
// via env vars and NOT via argv. Neither leaks to `ps` / `/proc/<pid>/
// environ`.
//
// Resource limits (`descriptor.resourceLimits`):
//   - `maxCpuMs` — wall-clock timer (NOT real CPU time; documented).
//                   On expiry: SIGKILL + emit `killed-for-resource-limit`
//                   with `dimension: 'cpu'`.
//   - `maxMemoryMb` — userspace poll (default 500ms interval) via
//                     `readMemoryRssMb(pid)` seam. Linux reads
//                     `/proc/<pid>/statm`; macOS reads `ps -o rss=`. On
//                     overage: SIGKILL + emit `killed-for-resource-limit`
//                     with `dimension: 'memory'`.
//   - `maxDiskMb` — DECLARED ONLY in v1. ENFORCEMENT DEFERRED to T-447.
//
// Determinism: this runner is operational glue (not clip code); it is
// NOT in the determinism scan path. It uses `setTimeout` and a process
// boundary by design.

import type { SandboxInvocation, SandboxRunner } from './types.js';

/**
 * Minimal interface for a stdio-attached child process. This is the
 * subset of `ChildProcess` the runner uses; tests inject a fake.
 * The runner never imports `node:child_process` directly — that import
 * lives in the host wiring (or in the default `spawnNodeSidecar`
 * helper exported below).
 */
export interface SidecarChildHandle {
  /** Write a single line of stdin to the sidecar. */
  writeStdin(line: string): void;
  /** Subscribe to stdout lines. */
  onStdoutLine(handler: (line: string) => void): void;
  /** Subscribe to a stderr line (logged but not parsed). */
  onStderrLine(handler: (line: string) => void): void;
  /** Subscribe to process exit. */
  onExit(handler: (exitCode: number | null, signal: NodeJS.Signals | null) => void): void;
  /** Send a kill signal. */
  kill(signal?: NodeJS.Signals): void;
  /** The OS PID; used for memory-poll lookups. May be undefined if the spawn failed. */
  readonly pid: number | undefined;
}

/**
 * Host-supplied factory that spawns the sidecar process. Receives the
 * runtime (`'node'` or `'python'`) declared on the descriptor; returns
 * a `SidecarChildHandle`. Production wiring uses `node:child_process.
 * spawn`; tests inject a fake.
 */
export type SpawnSidecar = (runtime: 'node' | 'python') => SidecarChildHandle;

/**
 * Reads the resident-set-size of the child in MB. Linux impl reads
 * `/proc/<pid>/statm`; macOS impl spawns `ps -o rss=`. Returns
 * `undefined` if unsupported (Windows / no-pid). Injectable seam so
 * tests can simulate memory growth.
 */
export type ReadMemoryRssMb = (pid: number) => number | undefined;

/** Default memory poll interval (ms). */
const DEFAULT_MEMORY_POLL_MS = 500;

/** Options for the runner. All seams injectable. */
export interface SidecarSandboxRunnerOptions {
  readonly spawnSidecar: SpawnSidecar;
  readonly readMemoryRssMb?: ReadMemoryRssMb;
  readonly memoryPollMs?: number;
  /**
   * Setter for the wall-clock timer. Test seam — tests inject a fake
   * timer to advance time without sleeping. Production uses
   * `setTimeout` / `clearTimeout`.
   */
  readonly setWallClockTimer?: (ms: number, cb: () => void) => () => void;
  /**
   * Setter for the memory-poll interval. Test seam. Production uses
   * `setInterval` / `clearInterval`.
   */
  readonly setIntervalSeam?: (ms: number, cb: () => void) => () => void;
}

/** A JSON-RPC error from the sidecar — surfaced as a thrown Error. */
export class SidecarRpcError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = 'SidecarRpcError';
    this.code = code;
  }
}

/** Generic sidecar protocol error (bad JSON, unexpected exit, etc). */
export class SidecarProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SidecarProtocolError';
  }
}

/** Internal marker — child was killed for resource-limit breach. */
class ResourceLimitKill extends Error {
  readonly dimension: 'cpu' | 'memory' | 'disk';
  constructor(dimension: 'cpu' | 'memory' | 'disk') {
    super(`Sidecar killed for resource-limit breach (${dimension})`);
    this.name = 'ResourceLimitKill';
    this.dimension = dimension;
  }
}

/**
 * The default wall-clock-timer seam — `setTimeout` + `clearTimeout`.
 * Returns a cancel function.
 */
function defaultSetWallClockTimer(ms: number, cb: () => void): () => void {
  const h = setTimeout(cb, ms);
  return () => {
    clearTimeout(h);
  };
}

/**
 * The default interval seam — `setInterval` + `clearInterval`. Returns
 * a cancel function.
 */
function defaultSetIntervalSeam(ms: number, cb: () => void): () => void {
  const h = setInterval(cb, ms);
  return () => {
    clearInterval(h);
  };
}

/**
 * `SidecarSandboxRunner` — spawn / talk / kill. Per-invocation
 * lifecycle:
 *   1. Spawn the child via the injected `spawnSidecar`.
 *   2. Subscribe to stdout (line-buffered JSON) + exit + stderr.
 *   3. Arm `maxCpuMs` wall-clock timer if set.
 *   4. Arm `maxMemoryMb` interval poll if set.
 *   5. Write the JSON-RPC `init` request to stdin.
 *   6. Resolve when the result line arrives; reject on RPC error;
 *      reject with `ResourceLimitKill` if the timer / poll fires
 *      first.
 *   7. Always kill the child + cancel timers in `finally`.
 */
export class SidecarSandboxRunner implements SandboxRunner {
  private readonly spawnSidecar: SpawnSidecar;
  private readonly readMemoryRssMb: ReadMemoryRssMb | undefined;
  private readonly memoryPollMs: number;
  private readonly setWallClockTimer: (ms: number, cb: () => void) => () => void;
  private readonly setIntervalSeam: (ms: number, cb: () => void) => () => void;

  constructor(opts: SidecarSandboxRunnerOptions) {
    this.spawnSidecar = opts.spawnSidecar;
    this.readMemoryRssMb = opts.readMemoryRssMb;
    this.memoryPollMs = opts.memoryPollMs ?? DEFAULT_MEMORY_POLL_MS;
    this.setWallClockTimer = opts.setWallClockTimer ?? defaultSetWallClockTimer;
    this.setIntervalSeam = opts.setIntervalSeam ?? defaultSetIntervalSeam;
  }

  async run<TOut>(invocation: SandboxInvocation): Promise<TOut> {
    const { descriptor, tenantId, credential, input, auditEmitter } = invocation;
    if (descriptor.sandbox.kind !== 'sidecar') {
      throw new Error(
        `SidecarSandboxRunner: expected sandbox.kind 'sidecar'; got '${descriptor.sandbox.kind}'`,
      );
    }
    const runtime = descriptor.sandbox.runtime;
    const limits = (
      descriptor as {
        resourceLimits?: { maxMemoryMb?: number; maxCpuMs?: number; maxDiskMb?: number };
      }
    ).resourceLimits;

    const baseEvent = {
      adapterId: descriptor.id,
      modality: descriptor.modality.kind,
      tenantId,
      sandboxKind: 'sidecar',
    } as const;

    auditEmitter.emit({ kind: 'start', ...baseEvent });

    const child = this.spawnSidecar(runtime);

    let cancelCpuTimer: (() => void) | undefined;
    let cancelMemoryPoll: (() => void) | undefined;
    let settled = false;

    try {
      const result = await new Promise<TOut>((resolve, reject) => {
        const settle = (fn: () => void): void => {
          if (settled) return;
          settled = true;
          fn();
        };

        child.onStdoutLine((line) => {
          if (settled) return;
          let parsed: unknown;
          try {
            parsed = JSON.parse(line);
          } catch {
            settle(() =>
              reject(new SidecarProtocolError(`Sidecar emitted non-JSON line: ${line}`)),
            );
            return;
          }
          const obj = parsed as {
            jsonrpc?: unknown;
            id?: unknown;
            result?: unknown;
            error?: { code?: unknown; message?: unknown };
          };
          if (obj.jsonrpc !== '2.0') {
            settle(() =>
              reject(
                new SidecarProtocolError(
                  `Sidecar JSON-RPC envelope missing or wrong: ${JSON.stringify(obj)}`,
                ),
              ),
            );
            return;
          }
          if (obj.error !== undefined) {
            const code = typeof obj.error.code === 'number' ? obj.error.code : -1;
            const message =
              typeof obj.error.message === 'string' ? obj.error.message : 'unknown sidecar error';
            settle(() => reject(new SidecarRpcError(code, message)));
            return;
          }
          settle(() => resolve(obj.result as TOut));
        });

        child.onStderrLine(() => {
          // Stderr is logged by the host wiring; the runner doesn't
          // act on stderr. The intentional empty body keeps the
          // subscription consistent with stdout (test seams expect a
          // handler registered).
        });

        child.onExit((exitCode, signal) => {
          if (settled) return;
          settle(() =>
            reject(
              new SidecarProtocolError(
                `Sidecar exited before producing a result (code=${String(exitCode)}, signal=${String(signal)})`,
              ),
            ),
          );
        });

        // Arm resource limits.
        if (limits?.maxCpuMs !== undefined && limits.maxCpuMs > 0) {
          cancelCpuTimer = this.setWallClockTimer(limits.maxCpuMs, () => {
            settle(() => reject(new ResourceLimitKill('cpu')));
          });
        }
        if (
          limits?.maxMemoryMb !== undefined &&
          limits.maxMemoryMb > 0 &&
          this.readMemoryRssMb !== undefined &&
          child.pid !== undefined
        ) {
          const readMem = this.readMemoryRssMb;
          const pid = child.pid;
          const cap = limits.maxMemoryMb;
          cancelMemoryPoll = this.setIntervalSeam(this.memoryPollMs, () => {
            if (settled) return;
            const rssMb = readMem(pid);
            if (rssMb !== undefined && rssMb > cap) {
              settle(() => reject(new ResourceLimitKill('memory')));
            }
          });
        }

        // Write the init JSON-RPC request.
        const initLine = `${JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'init',
          params: {
            adapterId: descriptor.id,
            credential,
            input,
          },
        })}\n`;
        child.writeStdin(initLine);
      });

      auditEmitter.emit({ kind: 'complete', ...baseEvent });
      return result;
    } catch (cause) {
      if (cause instanceof ResourceLimitKill) {
        auditEmitter.emit({
          kind: 'killed-for-resource-limit',
          ...baseEvent,
          sandboxKind: 'sidecar',
          dimension: cause.dimension,
        });
      } else {
        const errorMessage = cause instanceof Error ? cause.message : String(cause);
        auditEmitter.emit({ kind: 'failed', ...baseEvent, errorMessage });
      }
      throw cause;
    } finally {
      if (cancelCpuTimer !== undefined) cancelCpuTimer();
      if (cancelMemoryPoll !== undefined) cancelMemoryPoll();
      // Best-effort kill. Idempotent on already-dead processes.
      try {
        child.kill('SIGKILL');
      } catch {
        // Already dead — ignore.
      }
    }
  }
}
