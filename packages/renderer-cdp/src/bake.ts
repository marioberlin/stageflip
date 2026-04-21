// packages/renderer-cdp/src/bake.ts
// Bake-tier scaffolding (T-089 [rev]). Bake runtimes produce artifacts
// offline (frames, video, audio) before the live CDP capture loop runs;
// those artifacts are then swapped in at capture time by the live-tier
// adapter. This is the "two-pass" orchestration the T-083 escalation
// moved out of T-083 (see docs/escalation-T-083.md §B1) and into this
// task.
//
// This PR ships the INTERFACES and a minimal InMemoryBakeOrchestrator +
// InMemoryBakeCache for tests. No concrete bake runtime (Blender, heavy
// three, offline shader) ships here — Phase 12 fills those. No wiring
// into exportDocument yet either; the T-084 preflight still blocks on
// bake-tier work with `bake-not-implemented`. When a concrete runtime
// and orchestrator get configured, the blocker becomes "missing
// orchestrator" instead.

/**
 * A unit of offline bake work, derived from a single bake-tier clip
 * instance in an RIRDocument. `id` is a caller-supplied content hash
 * used as the cache key — two jobs with the same id are treated as
 * identical regardless of shape drift (caller's responsibility to
 * canonicalise `params` before hashing).
 */
export interface BakeJob {
  readonly id: string;
  readonly runtimeId: string;
  readonly clipKind: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly durationFrames: number;
}

/** The kind of artifact a bake produced. Callers dispatch on this. */
export type BakeArtifactKind = 'frames' | 'video' | 'audio';

export interface BakeArtifact {
  readonly jobId: string;
  readonly kind: BakeArtifactKind;
  /** Local path to the baked artifact (directory for 'frames', file otherwise). */
  readonly localPath: string;
  readonly sizeBytes?: number;
  /** Free-form metadata produced by the runtime (e.g. framePattern). */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * A runtime capable of baking one or more clip kinds. Returned artifacts
 * are opaque to the orchestrator — it just stashes them in the cache.
 */
export interface BakeRuntime {
  readonly id: string;
  canBake(clipKind: string): boolean;
  bake(job: BakeJob): Promise<BakeArtifact>;
}

/** Persistence layer for bake outputs, keyed by `BakeJob.id`. */
export interface BakeCache {
  has(jobId: string): Promise<boolean>;
  get(jobId: string): Promise<BakeArtifact | null>;
  put(artifact: BakeArtifact): Promise<void>;
  delete(jobId: string): Promise<void>;
}

export interface BakeFailure {
  readonly job: BakeJob;
  readonly reason: 'no-runtime' | 'bake-error';
  readonly message: string;
}

export interface BakeOrchestrationResult {
  /** Artifacts produced by a runtime during this run. */
  readonly baked: readonly BakeArtifact[];
  /** Artifacts served from cache (no runtime invoked). */
  readonly cached: readonly BakeArtifact[];
  /** Jobs the orchestrator could not fulfil. */
  readonly failed: readonly BakeFailure[];
}

/**
 * The two-pass entry point. Register one or more `BakeRuntime`s, then
 * call `bakeAll(jobs)` to run every job through its matching runtime
 * (cache-first) and collect the resulting artifacts. Never throws on a
 * per-job failure — failures surface in `result.failed` so the caller
 * can decide whether to proceed with a partial bake.
 */
export interface BakeOrchestrator {
  register(runtime: BakeRuntime): void;
  listRuntimes(): readonly BakeRuntime[];
  bakeAll(jobs: readonly BakeJob[]): Promise<BakeOrchestrationResult>;
}

// ---- in-memory cache ------------------------------------------------------

/** Zero-IO cache for tests + ephemeral runs. */
export class InMemoryBakeCache implements BakeCache {
  private readonly entries = new Map<string, BakeArtifact>();

  async has(jobId: string): Promise<boolean> {
    return this.entries.has(jobId);
  }

  async get(jobId: string): Promise<BakeArtifact | null> {
    return this.entries.get(jobId) ?? null;
  }

  async put(artifact: BakeArtifact): Promise<void> {
    this.entries.set(artifact.jobId, artifact);
  }

  async delete(jobId: string): Promise<void> {
    this.entries.delete(jobId);
  }

  /** Test-only snapshot. */
  get size(): number {
    return this.entries.size;
  }
}

// ---- in-memory orchestrator ----------------------------------------------

export interface InMemoryBakeOrchestratorOptions {
  /** Cache to consult before invoking a runtime. Optional; defaults to InMemoryBakeCache. */
  readonly cache?: BakeCache;
}

/**
 * Minimal reference orchestrator. Iterates jobs sequentially (determinism
 * over parallelism for this task scope); for each job: cache-hit →
 * `cached[]`; cache-miss + matching runtime → `baked[]`; cache-miss + no
 * runtime → `failed[]` (no-runtime); runtime throw → `failed[]`
 * (bake-error). First registered runtime whose `canBake(clipKind)`
 * returns true wins.
 */
export class InMemoryBakeOrchestrator implements BakeOrchestrator {
  private readonly runtimes: BakeRuntime[] = [];
  private readonly cache: BakeCache;

  constructor(opts: InMemoryBakeOrchestratorOptions = {}) {
    this.cache = opts.cache ?? new InMemoryBakeCache();
  }

  register(runtime: BakeRuntime): void {
    if (typeof runtime?.id !== 'string' || runtime.id.length === 0) {
      throw new Error('BakeOrchestrator.register: runtime.id must be a non-empty string');
    }
    if (this.runtimes.some((r) => r.id === runtime.id)) {
      throw new Error(
        `BakeOrchestrator.register: runtime id '${runtime.id}' is already registered`,
      );
    }
    this.runtimes.push(runtime);
  }

  listRuntimes(): readonly BakeRuntime[] {
    return this.runtimes.slice();
  }

  async bakeAll(jobs: readonly BakeJob[]): Promise<BakeOrchestrationResult> {
    const baked: BakeArtifact[] = [];
    const cached: BakeArtifact[] = [];
    const failed: BakeFailure[] = [];

    for (const job of jobs) {
      // A single `get` is all we need: `null` is the canonical miss
      // signal. Going through `has` first would TOCTOU-race with any
      // disk-backed cache in Phase 12 and add a round-trip per hit.
      const hit = await this.cache.get(job.id);
      if (hit !== null) {
        cached.push(hit);
        continue;
      }

      const runtime = this.runtimes.find((r) => r.canBake(job.clipKind));
      if (runtime === undefined) {
        failed.push({
          job,
          reason: 'no-runtime',
          message: `no registered bake runtime claims clipKind '${job.clipKind}' (job ${job.id})`,
        });
        continue;
      }

      try {
        const artifact = await runtime.bake(job);
        await this.cache.put(artifact);
        baked.push(artifact);
      } catch (err) {
        failed.push({
          job,
          reason: 'bake-error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { baked, cached, failed };
  }
}
