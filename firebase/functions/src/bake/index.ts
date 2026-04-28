// firebase/functions/src/bake/index.ts
// Bake-tier Cloud Function barrel (T-265). Exports the submitBakeJob adapter
// for wiring into the top-level `firebase/functions/src/index.ts`.

export {
  type BakeSubmitDeps,
  type SubmitBakeJobInput,
  type SubmitBakeJobOutput,
  submitBakeJobAdapter,
} from './submit.js';
