// services/blender-worker/src/worker.ts
// Bake worker entry point (T-265 D-T265-3, D-T265-6). Consumes from
// `stageflip:bakes` (BullMQ) and renders frames via the Blender CLI.
//
// The pure orchestration logic lives in `processBakeJob` so it can be unit-
// tested without BullMQ or Blender. The `main()` function wires the BullMQ
// Worker on top.
//
// Idempotency contract (T-265 AC #20): if `manifest.json` already exists at
// the output path, processBakeJob short-circuits successfully without
// invoking Blender. This is critical because BullMQ delivery is at-least-once;
// without idempotency a duplicate job races to write the same hash and one
// wins arbitrarily.

import { BAKE_QUEUE_NAME, type BakeJobPayload, manifestKey } from '@stageflip/runtimes-blender';

/** Object-storage interface for frame writes. Decouples from GCS / S3 / etc. */
export interface BakeOutputBucket {
  /** Read an object as UTF-8; null when absent. Used for the idempotency check. */
  getText(path: string): Promise<string | null>;
  /** Write an object as bytes. Overwrites existing content. */
  putBytes(path: string, bytes: Uint8Array): Promise<void>;
  /** Write an object as UTF-8. Overwrites existing content. */
  putText(path: string, text: string): Promise<void>;
}

/**
 * Why a render ran on CPU:
 *   - 'gpu-not-configured' → dev default; no GPU was ever attempted. Quiet.
 *   - 'gpu-runtime-failure' → GPU was attempted and threw at runtime. Loud.
 */
export type CpuFallbackReason = 'gpu-not-configured' | 'gpu-runtime-failure';

/** Result of a Blender render invocation: a sorted list of frame buffers. */
export interface BlenderRenderResult {
  /** Per-frame PNG bytes, in frame order (frame 0 first). */
  readonly frames: ReadonlyArray<Uint8Array>;
  /** Whether the render fell back to CPU (GPU unavailable). */
  readonly cpuFallback: boolean;
  /**
   * Distinguishes the dev-default no-GPU path (quiet) from a real GPU runtime
   * failure (loud). Undefined when no fallback occurred.
   */
  readonly cpuFallbackReason?: CpuFallbackReason;
}

/** Pluggable Blender invoker — production wires the Python script, tests stub. */
export interface BlenderInvoker {
  render(payload: BakeJobPayload): Promise<BlenderRenderResult>;
}

/** Routes a region+bucket name to a writable bucket adapter. */
export interface BucketRouter {
  bucketFor(region: BakeJobPayload['region'], bucketName: string): BakeOutputBucket;
}

/** Minimal observability surface — production wires Sentry + structured log. */
export interface WorkerObservability {
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  captureError(err: unknown, ctx?: Record<string, unknown>): void;
}

/**
 * Render-farm state-marker emitter (T-266 D-T266-5). The in-memory adapter
 * reads these from the worker's stdout to drive job lifecycle transitions.
 * Production K8s adapters ignore them — they read pod state from the API.
 *
 * This is a separate interface from `WorkerObservability` because the markers
 * are a parseable protocol, not a log: their format is load-bearing for
 * adapter integration and must NOT be reformatted by structured-log shims.
 */
export interface StateMarkerEmitter {
  /** Emit "started" — the worker has picked up the job and is rendering. */
  started(bakeId: string): void;
  /** Emit "finished" with succeeded or failed status (and optional error). */
  finished(args: { bakeId: string; status: 'succeeded' | 'failed'; error?: string }): void;
}

export interface ProcessBakeJobDeps {
  readonly invoker: BlenderInvoker;
  readonly router: BucketRouter;
  readonly observability: WorkerObservability;
  readonly clock: () => number;
  /**
   * Optional render-farm state-marker emitter (T-266). Omitting it disables
   * marker emission; existing T-265 tests don't pass it and remain unchanged.
   */
  readonly stateMarkers?: StateMarkerEmitter;
}

export type ProcessBakeJobResult =
  | { readonly status: 'cached'; readonly inputsHash: string; readonly manifestPath: string }
  | {
      readonly status: 'rendered';
      readonly inputsHash: string;
      readonly frameCount: number;
      readonly cpuFallback: boolean;
      readonly cpuFallbackReason?: CpuFallbackReason;
      readonly manifestPath: string;
    };

/** Build the manifest object the worker writes on success (T-265 AC #23). */
export function buildManifest(args: {
  payload: BakeJobPayload;
  frameCount: number;
  completedAt: string;
}): Record<string, unknown> {
  return {
    inputsHash: args.payload.inputsHash,
    frameCount: args.frameCount,
    fps: args.payload.duration.fps,
    durationMs: args.payload.duration.durationMs,
    outputBucket: args.payload.outputBucket,
    region: args.payload.region,
    completedAt: args.completedAt,
  };
}

/** Compute the expected frame count from duration + fps. Round up to capture the trailing edge. */
export function expectedFrameCount(durationMs: number, fps: number): number {
  return Math.ceil((durationMs / 1000) * fps);
}

/**
 * Run one bake job. Idempotent on `manifest.json`. Throws on any unrecoverable
 * error; BullMQ handles retries via the producer's `attempts: 3` policy.
 */
export async function processBakeJob(
  deps: ProcessBakeJobDeps,
  payload: BakeJobPayload,
): Promise<ProcessBakeJobResult> {
  // T-266 AC #14: emit "started" so the in-memory render-farm adapter can
  // transition queued → running. Fired before any work so cache-hit short-
  // circuits also produce a started/finished pair.
  deps.stateMarkers?.started(payload.inputsHash);
  try {
    const result = await processBakeJobInner(deps, payload);
    deps.stateMarkers?.finished({ bakeId: payload.inputsHash, status: 'succeeded' });
    return result;
  } catch (err) {
    deps.stateMarkers?.finished({
      bakeId: payload.inputsHash,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

async function processBakeJobInner(
  deps: ProcessBakeJobDeps,
  payload: BakeJobPayload,
): Promise<ProcessBakeJobResult> {
  const bucket = deps.router.bucketFor(payload.region, payload.outputBucket);
  const manifestPath = manifestKey(payload.inputsHash);

  // Idempotency check (T-265 AC #20): if manifest exists, short-circuit.
  const existing = await bucket.getText(manifestPath);
  if (existing !== null) {
    deps.observability.info('bake.cache_hit', { inputsHash: payload.inputsHash });
    return { status: 'cached', inputsHash: payload.inputsHash, manifestPath };
  }

  // Invoke Blender. The invoker handles the GPU/CPU dual-path internally
  // (T-265 AC #24); it returns `cpuFallback: true` if it had to drop to CPU.
  const result = await deps.invoker.render(payload);
  if (result.cpuFallback) {
    // Distinguish the dev-default no-GPU path (quiet INFO) from a real GPU
    // runtime failure (loud WARN). Without this split, every dev render
    // produces a warn that masks legitimate CUDA failures in production.
    const reason: CpuFallbackReason = result.cpuFallbackReason ?? 'gpu-runtime-failure';
    if (reason === 'gpu-not-configured') {
      deps.observability.info('bake.cpu_fallback', {
        inputsHash: payload.inputsHash,
        reason,
      });
    } else {
      deps.observability.warn('bake.cpu_fallback', {
        inputsHash: payload.inputsHash,
        reason,
      });
    }
  }

  const expected = expectedFrameCount(payload.duration.durationMs, payload.duration.fps);
  if (result.frames.length !== expected) {
    throw new Error(
      `processBakeJob: frame count mismatch — expected ${expected}, got ${result.frames.length}`,
    );
  }

  // Write each frame (T-265 AC #22).
  for (let i = 0; i < result.frames.length; i++) {
    const frameBytes = result.frames[i];
    if (frameBytes === undefined) {
      throw new Error(`processBakeJob: missing frame at index ${i}`);
    }
    await bucket.putBytes(`bakes/${payload.inputsHash}/frame-${i}.png`, frameBytes);
  }

  // Write manifest last so the idempotency probe is monotonic — the manifest
  // appearing means all frames are written. (T-265 AC #23.)
  const manifest = buildManifest({
    payload,
    frameCount: result.frames.length,
    completedAt: new Date(deps.clock()).toISOString(),
  });
  await bucket.putText(manifestPath, JSON.stringify(manifest));

  deps.observability.info('bake.completed', {
    inputsHash: payload.inputsHash,
    frameCount: result.frames.length,
  });

  return {
    status: 'rendered',
    inputsHash: payload.inputsHash,
    frameCount: result.frames.length,
    cpuFallback: result.cpuFallback,
    ...(result.cpuFallbackReason ? { cpuFallbackReason: result.cpuFallbackReason } : {}),
    manifestPath,
  };
}

/** Convenience: the queue name the worker subscribes to. */
export const WORKER_QUEUE_NAME = BAKE_QUEUE_NAME;
