// packages/runtimes/blender/src/queue.ts
// BullMQ producer for the bake queue (T-265 AC #17, #18). Queue name pinned
// by docs/architecture.md:341 — `stageflip:bakes`. The producer is split out
// from the submit handler so unit tests can inject a stub queue without
// pulling in real Redis.

import type { Region } from '@stageflip/auth-schema';

import type { BlenderDuration, BlenderScene } from '@stageflip/schema';

/** The architecture-locked queue name. Must NOT be versioned (D-T265-4). */
export const BAKE_QUEUE_NAME = 'stageflip:bakes';

/**
 * Job payload pushed onto the queue. The worker validates this shape on
 * receipt; on schema mismatch the job is dead-lettered.
 */
export interface BakeJobPayload {
  readonly bakeId: string;
  readonly inputsHash: string;
  readonly scene: BlenderScene;
  readonly duration: BlenderDuration;
  readonly outputBucket: string;
  readonly region: Region;
}

/** Default BullMQ job options per AC #18. */
export const DEFAULT_BAKE_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { age: 86400 },
  removeOnFail: { age: 7 * 86400 },
} as const;

/**
 * Minimal structural shape of a BullMQ Queue we depend on. Lets tests inject
 * a recording stub without `new Queue()` actually opening a Redis connection.
 */
export interface BullQueueLike {
  add(name: string, data: BakeJobPayload, opts?: unknown): Promise<{ id?: string | null }>;
}

/** Producer constructor input. */
export interface BakeQueueProducerOptions {
  readonly queue: BullQueueLike;
  /** Override the job options. Defaults to {@link DEFAULT_BAKE_JOB_OPTIONS}. */
  readonly jobOptions?: Record<string, unknown>;
}

/**
 * Enqueue a bake job. The job's `name` is `'bake'`; the payload carries the
 * full descriptor. Returns the BullMQ job id so the submit handler can echo
 * it back to the caller.
 */
export class BakeQueueProducer {
  private readonly queue: BullQueueLike;
  private readonly jobOptions: Record<string, unknown>;

  constructor(opts: BakeQueueProducerOptions) {
    this.queue = opts.queue;
    this.jobOptions = opts.jobOptions ?? { ...DEFAULT_BAKE_JOB_OPTIONS };
  }

  async enqueue(payload: BakeJobPayload): Promise<string> {
    const job = await this.queue.add('bake', payload, this.jobOptions);
    if (typeof job.id !== 'string' || job.id.length === 0) {
      throw new Error('BakeQueueProducer: queue returned a job without an id');
    }
    return job.id;
  }
}
