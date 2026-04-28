// packages/render-farm/src/contract.ts
// RenderFarmAdapter contract (T-266 D-T266-1). Vendor-neutral interface that
// abstracts over CoreWeave / Paperspace / self-hosted-K8s vendor choices. The
// consumer (the bake worker from T-265) calls into this contract; concrete
// implementations bind to a specific vendor's API.
//
// AC #1–#2: this shape is a stable public interface. Once shipped, a future
// vendor implementation must conform to it. Minor changes here are a major-
// version bump on @stageflip/render-farm.

/** Resource shape for a render-farm job. */
export interface RenderFarmJobResources {
  /** CPU cores (fractional permitted, e.g. 0.5). */
  readonly cpu: number;
  /** Memory in gibibytes. */
  readonly memoryGB: number;
  /** GPU type. `cpu-only` means no GPU. */
  readonly gpu?: 'cuda' | 'rocm' | 'cpu-only';
}

/**
 * A submission to the render farm. Vendor adapters translate this into
 * vendor-specific job specs (K8s Job, CoreWeave VirtualMachineInstance, etc.).
 */
export interface RenderFarmJob {
  /** BullMQ job id from T-265's queue. The farm runs the worker against this. */
  readonly bakeId: string;
  /** Container image (worker image from T-265). */
  readonly image: string;
  /** Resource requirements. */
  readonly resources: RenderFarmJobResources;
  /** Env vars to pass to the worker (REDIS_URL, ORG_ID, INPUTS_HASH, OUTPUT_BUCKET). */
  readonly env: Readonly<Record<string, string>>;
  /** Optional metadata for telemetry (org_id, region). */
  readonly tags?: Readonly<Record<string, string>>;
}

/** Lifecycle states. Strict ordering: queued → running → (succeeded | failed | canceled). */
export type RenderFarmJobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';

/** Snapshot of a job's current state. */
export interface RenderFarmJobStatus {
  readonly jobId: string;
  readonly state: RenderFarmJobState;
  /** ISO timestamp; set once running starts. */
  readonly startedAt?: string;
  /** ISO timestamp; set once terminal state is reached. */
  readonly finishedAt?: string;
  /** Set when state === 'failed'. */
  readonly error?: string;
  /** Whether streamLogs is meaningful for this job. */
  readonly logsAvailable: boolean;
}

/**
 * Static description of an adapter's capabilities. Consumers consult this to
 * decide whether to call optional methods (e.g. streamLogs).
 */
export interface RenderFarmCapabilities {
  /** Supports streaming logs via streamLogs. */
  readonly streamingLogs: boolean;
  /** GPU types this adapter can provision. */
  readonly gpuTypes: ReadonlyArray<'cuda' | 'rocm' | 'cpu-only'>;
  /** Sub-minute scale-up supported. */
  readonly fastScaleUp: boolean;
  /**
   * Maximum concurrent jobs the adapter can run. `0` signals "not deployed"
   * (e.g. K8s stub before a vendor is picked).
   */
  readonly maxConcurrentJobs: number;
}

/** Options for streamLogs. */
export interface StreamLogsOptions {
  readonly signal?: AbortSignal;
}

/**
 * The render-farm adapter contract. Implementations:
 *   - InMemoryRenderFarmAdapter — child_process spawn (dev + tests).
 *   - KubernetesRenderFarmAdapter — stub until a vendor is picked.
 *   - (future) CoreWeaveRenderFarmAdapter / PaperspaceRenderFarmAdapter / ...
 *
 * All methods emit OTel spans (D-T266-5) with `vendor`, `jobId`, `state`,
 * `duration_ms` attributes; failures call `captureError`.
 */
export interface RenderFarmAdapter {
  /**
   * Submit a job. Returns a `jobId` immediately; actual scheduling happens
   * asynchronously. The adapter is responsible for queuing / scaling.
   */
  submitJob(job: RenderFarmJob): Promise<{ readonly jobId: string }>;

  /**
   * Cancel a queued or running job. Best-effort — running jobs may still
   * complete depending on the vendor. After cancel, getJobStatus eventually
   * reports `state: 'canceled'`.
   */
  cancelJob(jobId: string): Promise<void>;

  /** Query the current state of a job. */
  getJobStatus(jobId: string): Promise<RenderFarmJobStatus>;

  /**
   * Stream stdout/stderr lines from a running job. Optional — adapters whose
   * `capabilities.streamingLogs === false` may omit it. Lines are yielded as
   * they arrive; the iterator ends when the job reaches a terminal state.
   * Honour `opts.signal` for early termination.
   */
  streamLogs?(jobId: string, opts?: StreamLogsOptions): AsyncIterable<string>;

  /** Static capabilities — which features are real vs stubs. */
  readonly capabilities: RenderFarmCapabilities;

  /** Vendor identifier for telemetry. e.g. `'in-memory'`, `'k8s'`, `'coreweave'`. */
  readonly vendor: string;
}
