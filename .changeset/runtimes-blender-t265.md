---
"@stageflip/runtimes-blender": minor
---

T-265: bake-tier ClipRuntime — `@stageflip/runtimes-blender`.

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
  + frame URL accessor, returning `'ready' | 'pending' | 'failed'`.
- `BakeQueueProducer` + `BAKE_QUEUE_NAME = 'stageflip:bakes'` — BullMQ
  producer pinned to the architecture-locked queue name.

The Cloud Function adapter lives in `firebase/functions/src/bake/`; the
worker that consumes the queue is `services/blender-worker/`.
