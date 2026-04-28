// packages/render-farm/src/errors.ts
// Render-farm error types. NotImplementedError is the documented signal that a
// stub adapter has been called; consumers can catch it specifically to surface
// "vendor not configured" UX without conflating with real submission failures.

/**
 * Thrown by stub adapters whose methods have no real implementation yet.
 * Production code should never see this in a deployed environment — encountering
 * it means an adapter was selected (e.g. `STAGEFLIP_RENDER_FARM_ADAPTER=k8s`)
 * before its vendor implementation landed.
 */
export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

/**
 * Thrown when an adapter cannot find a job by id. Distinct from a job that
 * exists but failed; use `state === 'failed'` for that.
 */
export class RenderFarmJobNotFoundError extends Error {
  constructor(public readonly jobId: string) {
    super(`render-farm: job not found: ${jobId}`);
    this.name = 'RenderFarmJobNotFoundError';
  }
}

/**
 * Thrown when an adapter cannot accept a submission for transient reasons
 * (capacity exhausted with no queue, vendor outage, etc.). Callers may retry.
 */
export class RenderFarmSubmitError extends Error {
  override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'RenderFarmSubmitError';
    if (cause !== undefined) this.cause = cause;
  }
}
