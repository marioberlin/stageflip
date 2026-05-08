# @stageflip/runtimes-blender

## 0.1.0

### Minor Changes

- 3112c98: T-265: bake-tier ClipRuntime — `@stageflip/runtimes-blender`.

  Ships the JS-side surface for the bake pipeline:
  - `computeInputsHash({ scene, duration })` — deterministic SHA-256 over a
    sorted-key JSON canonicalization. Field order independent, type
    sensitive. The cache key into `bakes/{inputsHash}/frame-{N}.png`
    per `docs/architecture.md:330`.
  - `submitBakeJobHandler(deps, caller, input)` — pure handler used by the
    Cloud Function adapter. Verifies auth + 10-token rate limit, recomputes
    the hash, checks the region-routed cache, and either short-circuits
    ('ready') or enqueues to BullMQ ('pending').
  - `getBakedFrames(inputsHash, { region, reader })` — read-only manifest
    - frame URL accessor, returning `'ready' | 'pending' | 'failed'`.
  - `BakeQueueProducer` + `BAKE_QUEUE_NAME = 'stageflip:bakes'` — BullMQ
    producer pinned to the architecture-locked queue name.

  The Cloud Function adapter lives in `firebase/functions/src/bake/`; the
  worker that consumes the queue is `services/blender-worker/`.

### Patch Changes

- Updated dependencies [d2021e9]
- Updated dependencies [de13cf8]
- Updated dependencies [019f79c]
- Updated dependencies [785b44c]
- Updated dependencies [753b22a]
- Updated dependencies [49d4533]
- Updated dependencies [2f0ae52]
- Updated dependencies [6cfbb4c]
- Updated dependencies [6474d98]
- Updated dependencies [a36fcbe]
- Updated dependencies [8ddef40]
- Updated dependencies [e054d6d]
- Updated dependencies [4fe6fda]
- Updated dependencies [12a98d3]
- Updated dependencies [ca945df]
- Updated dependencies [5af6789]
- Updated dependencies [22d44d6]
- Updated dependencies [b6d2229]
- Updated dependencies [a4bb803]
- Updated dependencies [bbcbd38]
- Updated dependencies [d393eff]
- Updated dependencies [3112c98]
- Updated dependencies [e422e50]
- Updated dependencies [7c0165c]
- Updated dependencies [732f6c7]
- Updated dependencies [36d0c5d]
- Updated dependencies [38e4017]
  - @stageflip/auth-schema@0.1.0
  - @stageflip/runtimes-contract@0.1.0
  - @stageflip/schema@0.1.0
