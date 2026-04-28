// packages/runtimes/blender/src/index.ts
// @stageflip/runtimes-blender — bake-tier runtime (T-265). The package ships
// the JS-side surface for the bake pipeline:
//   - inputs-hash      — deterministic SHA-256 cache key
//   - queue            — BullMQ producer (queue: stageflip:bakes)
//   - submit           — pure handler for the submitBakeJob Cloud Function
//   - fetch            — read-only manifest + frame URL accessor
//
// The Blender worker itself lives in services/blender-worker; it consumes
// the queue and writes to `bakes/{inputsHash}/frame-{N}.png` per
// docs/architecture.md:330. See skills/stageflip/concepts/runtimes/SKILL.md.

export {
  type BakedFramesResult,
  type BakeBucketReader,
  type BakeFailureMarker,
  type BakeManifest,
  bakeKeyPrefix,
  failureMarkerKey,
  frameKey,
  getBakedFrames,
  type GetBakedFramesOptions,
  manifestKey,
} from './fetch.js';
export {
  type BlenderInputs,
  canonicalize,
  computeInputsHash,
} from './inputs-hash.js';
export {
  BAKE_QUEUE_NAME,
  type BakeJobPayload,
  type BakeQueueProducerOptions,
  BakeQueueProducer,
  type BullQueueLike,
  DEFAULT_BAKE_JOB_OPTIONS,
} from './queue.js';
export {
  DEFAULT_TOKENS_PER_SUBMIT,
  type RateLimiterLike,
  SubmitError,
  type SubmitCaller,
  type SubmitDeps,
  type SubmitInput,
  type SubmitOutput,
  type SubmitRegionRouter,
  submitBakeJobHandler,
} from './submit.js';
