// packages/render-farm/src/in-memory.ts
// In-memory render-farm adapter (T-266 D-T266-2). Spawns the worker as a
// child process via `node:child_process`. Used for:
//   - local dev (no K8s required)
//   - integration tests
//   - the parity harness (so we can render bakes deterministically without
//     a vendor account)
//
// Lifecycle is driven by:
//   1. Spawn time — state goes `queued → running` (running once we observe the
//      "started" stdout marker; until then, the process exists but the worker
//      is still booting / pulling deps).
//   2. Process exit — state transitions to `succeeded`, `failed`, or `canceled`.
//      A clean exit with a "finished" marker reporting status=succeeded becomes
//      `succeeded`; any other exit is `failed` (or `canceled` if we sent SIGTERM).
//
// Concurrency: we cap at `maxConcurrentJobs` (default 4). Submissions beyond the
// cap are kept in `state: 'queued'`; when a running job finishes we promote one.
//
// Determinism: this file is NOT in the determinism scan path (D-T266-5) — we
// use Date.now() for timestamps, child_process for spawning, and emit OTel
// spans freely. Adapter implementations are operational glue, not clip code.

import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { captureError, withForcedTrace } from '@stageflip/observability';

import type {
  RenderFarmAdapter,
  RenderFarmCapabilities,
  RenderFarmJob,
  RenderFarmJobStatus,
  StreamLogsOptions,
} from './contract.js';
import { RenderFarmJobNotFoundError, RenderFarmSubmitError } from './errors.js';
import { parseMarkerLine } from './state-markers.js';

/** Maximum log buffer per job (defensive — protects against unbounded memory). */
const DEFAULT_LOG_BUFFER_LINES = 5_000;

/** Internal record for one job's lifecycle. */
interface JobRecord {
  readonly jobId: string;
  readonly job: RenderFarmJob;
  state: RenderFarmJobStatus['state'];
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  child?: ChildProcess;
  logBuffer: string[];
  /** Resolves when the job reaches a terminal state. */
  donePromise: Promise<void>;
  resolveDone: () => void;
  /** Listeners for streamLogs to consume new lines as they arrive. */
  logListeners: Set<(line: string) => void>;
  /** Notified when a terminal state is reached. */
  terminalListeners: Set<() => void>;
}

/** Constructor options. */
export interface InMemoryRenderFarmAdapterOptions {
  /** Concurrency cap. Default 4. Must be >= 1. */
  readonly maxConcurrentJobs?: number;
  /**
   * Override the spawn behaviour — test seam. Production callers leave this
   * unset and the adapter spawns `node` against the worker entry point.
   */
  readonly spawn?: SpawnFn;
  /** Override clock for deterministic tests. */
  readonly clock?: () => number;
  /** Override id generator for deterministic tests. */
  readonly idGenerator?: () => string;
  /** Maximum number of stdout lines retained per job. Default 5000. */
  readonly logBufferLines?: number;
}

/**
 * Spawn function — given a job, returns the spawned ChildProcess. The default
 * spawns the job's `image` value as a node script with the job's env applied.
 * Tests inject a stub that wires deterministic stdout instead.
 */
export type SpawnFn = (job: RenderFarmJob, jobId: string) => ChildProcess;

/** The default spawn function — runs `node <image> ` (image is the script path). */
function defaultSpawn(job: RenderFarmJob): ChildProcess {
  // The image string is interpreted as a path to a Node script the worker
  // entry point ships at. This is sufficient for dev (the worker is a Node
  // service); a Docker-based variant would replace this with `docker run`.
  return spawn('node', [job.image], {
    env: { ...process.env, ...job.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export class InMemoryRenderFarmAdapter implements RenderFarmAdapter {
  readonly vendor = 'in-memory';
  readonly capabilities: RenderFarmCapabilities;

  private readonly jobs = new Map<string, JobRecord>();
  private readonly maxConcurrentJobs: number;
  private readonly spawnFn: SpawnFn;
  private readonly clock: () => number;
  private readonly idGenerator: () => string;
  private readonly logBufferLines: number;
  /** Queue of jobIds awaiting capacity. FIFO. */
  private readonly waitingQueue: string[] = [];

  constructor(opts: InMemoryRenderFarmAdapterOptions = {}) {
    const cap = opts.maxConcurrentJobs ?? 4;
    if (!Number.isInteger(cap) || cap < 1) {
      throw new Error(
        `InMemoryRenderFarmAdapter: maxConcurrentJobs must be a positive integer; got ${cap}`,
      );
    }
    this.maxConcurrentJobs = cap;
    this.spawnFn = opts.spawn ?? defaultSpawn;
    this.clock = opts.clock ?? Date.now;
    this.idGenerator = opts.idGenerator ?? randomUUID;
    this.logBufferLines = opts.logBufferLines ?? DEFAULT_LOG_BUFFER_LINES;
    this.capabilities = {
      streamingLogs: true,
      gpuTypes: ['cpu-only'],
      fastScaleUp: true,
      maxConcurrentJobs: cap,
    };
  }

  async submitJob(job: RenderFarmJob): Promise<{ readonly jobId: string }> {
    return withForcedTrace('render-farm.submitJob', async (span) => {
      const start = this.clock();
      const jobId = this.idGenerator();
      span.setAttribute('vendor', this.vendor);
      span.setAttribute('jobId', jobId);
      span.setAttribute('bakeId', job.bakeId);

      let resolveDone!: () => void;
      const donePromise = new Promise<void>((resolve) => {
        resolveDone = resolve;
      });
      const record: JobRecord = {
        jobId,
        job,
        state: 'queued',
        logBuffer: [],
        donePromise,
        resolveDone,
        logListeners: new Set(),
        terminalListeners: new Set(),
      };
      this.jobs.set(jobId, record);

      const runningCount = this.countRunning();
      if (runningCount < this.maxConcurrentJobs) {
        try {
          this.start(record);
        } catch (err) {
          this.markFailed(record, err instanceof Error ? err.message : String(err));
          captureError(err, { jobId, vendor: this.vendor });
          span.setAttribute('state', 'failed');
          span.setAttribute('duration_ms', this.clock() - start);
          throw new RenderFarmSubmitError(`failed to spawn worker: ${String(err)}`, err);
        }
      } else {
        this.waitingQueue.push(jobId);
      }

      span.setAttribute('state', record.state);
      span.setAttribute('duration_ms', this.clock() - start);
      return { jobId };
    });
  }

  async cancelJob(jobId: string): Promise<void> {
    return withForcedTrace('render-farm.cancelJob', async (span) => {
      const start = this.clock();
      span.setAttribute('vendor', this.vendor);
      span.setAttribute('jobId', jobId);
      const record = this.jobs.get(jobId);
      if (!record) {
        span.setAttribute('duration_ms', this.clock() - start);
        throw new RenderFarmJobNotFoundError(jobId);
      }
      // Already terminal — no-op.
      if (this.isTerminal(record.state)) {
        span.setAttribute('state', record.state);
        span.setAttribute('duration_ms', this.clock() - start);
        return;
      }
      // Queued but never spawned — drop from queue, mark canceled.
      if (record.state === 'queued' && record.child === undefined) {
        const idx = this.waitingQueue.indexOf(jobId);
        if (idx !== -1) this.waitingQueue.splice(idx, 1);
        this.markTerminal(record, 'canceled');
        span.setAttribute('state', 'canceled');
        span.setAttribute('duration_ms', this.clock() - start);
        return;
      }
      // Running — SIGTERM the child. The exit handler marks state.
      if (record.child !== undefined) {
        record.child.kill('SIGTERM');
      }
      // Track that this exit, when it comes, should be treated as canceled
      // rather than failed.
      record.error = '__canceled__';
      span.setAttribute('state', record.state);
      span.setAttribute('duration_ms', this.clock() - start);
    });
  }

  async getJobStatus(jobId: string): Promise<RenderFarmJobStatus> {
    return withForcedTrace('render-farm.getJobStatus', async (span) => {
      const start = this.clock();
      span.setAttribute('vendor', this.vendor);
      span.setAttribute('jobId', jobId);
      const record = this.jobs.get(jobId);
      if (!record) {
        span.setAttribute('duration_ms', this.clock() - start);
        throw new RenderFarmJobNotFoundError(jobId);
      }
      const status = this.snapshot(record);
      span.setAttribute('state', status.state);
      span.setAttribute('duration_ms', this.clock() - start);
      return status;
    });
  }

  /**
   * Yield stdout lines as they arrive. Replays already-buffered lines first,
   * then awaits new ones until terminal. Honours opts.signal.
   */
  async *streamLogs(jobId: string, opts?: StreamLogsOptions): AsyncIterable<string> {
    const record = this.jobs.get(jobId);
    if (!record) throw new RenderFarmJobNotFoundError(jobId);

    // Replay buffer first.
    for (const line of record.logBuffer) {
      if (opts?.signal?.aborted) return;
      yield line;
    }

    // If already terminal, we're done.
    if (this.isTerminal(record.state)) return;

    // Subscribe to new lines.
    const queue: string[] = [];
    let resolveWaiter: (() => void) | null = null;
    const listener = (line: string): void => {
      queue.push(line);
      if (resolveWaiter) {
        const r = resolveWaiter;
        resolveWaiter = null;
        r();
      }
    };
    const terminalListener = (): void => {
      if (resolveWaiter) {
        const r = resolveWaiter;
        resolveWaiter = null;
        r();
      }
    };
    record.logListeners.add(listener);
    record.terminalListeners.add(terminalListener);

    const abortHandler = (): void => {
      if (resolveWaiter) {
        const r = resolveWaiter;
        resolveWaiter = null;
        r();
      }
    };
    opts?.signal?.addEventListener('abort', abortHandler);

    try {
      while (true) {
        if (opts?.signal?.aborted) return;
        if (queue.length > 0) {
          const next = queue.shift();
          if (next !== undefined) yield next;
          continue;
        }
        if (this.isTerminal(record.state)) return;
        await new Promise<void>((resolve) => {
          resolveWaiter = resolve;
        });
      }
    } finally {
      record.logListeners.delete(listener);
      record.terminalListeners.delete(terminalListener);
      opts?.signal?.removeEventListener('abort', abortHandler);
    }
  }

  /**
   * Test/diagnostic helper — returns the promise that resolves when a job
   * reaches a terminal state. Not part of the public RenderFarmAdapter contract.
   */
  whenDone(jobId: string): Promise<void> {
    const record = this.jobs.get(jobId);
    if (!record) return Promise.reject(new RenderFarmJobNotFoundError(jobId));
    return record.donePromise;
  }

  /* --- internal --- */

  private countRunning(): number {
    let n = 0;
    for (const r of this.jobs.values()) {
      if (r.state === 'running' || (r.state === 'queued' && r.child !== undefined)) n++;
    }
    return n;
  }

  private start(record: JobRecord): void {
    const child = this.spawnFn(record.job, record.jobId);
    record.child = child;
    // We optimistically transition queued → running on spawn. If the worker
    // emits an explicit "started" marker we re-confirm; if not, the process
    // exiting before any output still produces a deterministic terminal state.
    record.state = 'running';
    record.startedAt = new Date(this.clock()).toISOString();

    const onLine = (line: string): void => {
      // Maintain bounded buffer.
      record.logBuffer.push(line);
      while (record.logBuffer.length > this.logBufferLines) {
        record.logBuffer.shift();
      }
      // Notify listeners.
      for (const l of record.logListeners) l(line);
      // Parse markers.
      const marker = parseMarkerLine(line);
      if (marker?.kind === 'started') {
        // Idempotent — already running.
      } else if (marker?.kind === 'finished') {
        // Capture intent; the actual terminal transition happens on exit so
        // we don't race the listener removal.
        if (marker.status === 'failed' && marker.error !== undefined) {
          record.error = marker.error;
        }
      }
    };

    bindLineReader(child, onLine);

    child.on('error', (err) => {
      this.markFailed(record, err.message);
      captureError(err, { jobId: record.jobId, vendor: this.vendor });
      this.promoteNextWaiting();
    });

    child.on('exit', (code, signal) => {
      // Already terminal — guard against double-handling.
      if (this.isTerminal(record.state)) {
        this.promoteNextWaiting();
        return;
      }
      if (record.error === '__canceled__' || signal === 'SIGTERM' || signal === 'SIGKILL') {
        this.markTerminal(record, 'canceled');
      } else if (code === 0) {
        this.markTerminal(record, 'succeeded');
      } else {
        const msg =
          record.error ??
          `worker exited with code ${code ?? 'null'}${signal ? ` (signal ${signal})` : ''}`;
        this.markFailed(record, msg);
      }
      this.promoteNextWaiting();
    });
  }

  private promoteNextWaiting(): void {
    while (this.countRunning() < this.maxConcurrentJobs && this.waitingQueue.length > 0) {
      const nextId = this.waitingQueue.shift();
      if (nextId === undefined) return;
      const next = this.jobs.get(nextId);
      if (!next) continue;
      if (next.state !== 'queued') continue;
      try {
        this.start(next);
      } catch (err) {
        this.markFailed(next, err instanceof Error ? err.message : String(err));
        captureError(err, { jobId: nextId, vendor: this.vendor });
      }
    }
  }

  private markFailed(record: JobRecord, message: string): void {
    record.error = message;
    this.markTerminal(record, 'failed');
  }

  private markTerminal(record: JobRecord, state: 'succeeded' | 'failed' | 'canceled'): void {
    if (this.isTerminal(record.state)) return;
    record.state = state;
    record.finishedAt = new Date(this.clock()).toISOString();
    record.resolveDone();
    for (const l of record.terminalListeners) l();
    if (state === 'failed' && record.error !== undefined && record.error !== '__canceled__') {
      captureError(new Error(record.error), {
        jobId: record.jobId,
        vendor: this.vendor,
        state,
      });
    }
  }

  private isTerminal(state: RenderFarmJobStatus['state']): boolean {
    return state === 'succeeded' || state === 'failed' || state === 'canceled';
  }

  private snapshot(record: JobRecord): RenderFarmJobStatus {
    const status: {
      jobId: string;
      state: RenderFarmJobStatus['state'];
      logsAvailable: boolean;
      startedAt?: string;
      finishedAt?: string;
      error?: string;
    } = {
      jobId: record.jobId,
      state: record.state,
      logsAvailable: true,
    };
    if (record.startedAt !== undefined) status.startedAt = record.startedAt;
    if (record.finishedAt !== undefined) status.finishedAt = record.finishedAt;
    if (record.error !== undefined && record.error !== '__canceled__') status.error = record.error;
    return status;
  }
}

/**
 * Wire the child process's stdout (and stderr, merged) to a line-callback. We
 * accumulate partial chunks until newlines arrive — needed because Node pipes
 * deliver bytes, not lines.
 */
function bindLineReader(child: ChildProcess, onLine: (line: string) => void): void {
  const consume = (chunk: Buffer | string, buffer: { value: string }): void => {
    buffer.value += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    while (true) {
      const nl = buffer.value.indexOf('\n');
      if (nl === -1) break;
      const line = buffer.value.slice(0, nl).replace(/\r$/, '');
      buffer.value = buffer.value.slice(nl + 1);
      onLine(line);
    }
  };
  const stdoutBuf = { value: '' };
  const stderrBuf = { value: '' };
  child.stdout?.on('data', (c) => consume(c, stdoutBuf));
  child.stderr?.on('data', (c) => consume(c, stderrBuf));
  child.on('exit', () => {
    if (stdoutBuf.value.length > 0) onLine(stdoutBuf.value.replace(/\r$/, ''));
    if (stderrBuf.value.length > 0) onLine(stderrBuf.value.replace(/\r$/, ''));
  });
}
