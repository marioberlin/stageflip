---
"@stageflip/renderer-cdp": minor
---

Bake-runtime scaffolding + two-pass orchestration (T-089 [rev]).

The T-083 escalation moved two-pass bake orchestration out of
T-083 and into this task (see `docs/escalation-T-083.md` §B1).
This PR ships the interfaces and a minimal in-memory reference
implementation. No concrete bake runtime (Blender, heavy three,
offline shader) ships here — those arrive in Phase 12. No wiring
into `exportDocument` yet either; the T-084 preflight still
blocks bake-tier work with `bake-not-implemented`.

New module `packages/renderer-cdp/src/bake.ts`:

**Interfaces**:
- `BakeJob` — `{ id, runtimeId, clipKind, params, width, height,
  fps, durationFrames }`. `id` is a caller-supplied content hash
  used as the cache key.
- `BakeArtifact` — `{ jobId, kind: 'frames' | 'video' | 'audio',
  localPath, sizeBytes?, metadata? }`.
- `BakeRuntime` — `canBake(clipKind)` + `bake(job)`.
- `BakeCache` — `has / get / put / delete` keyed by `BakeJob.id`.
- `BakeOrchestrator` — `register(runtime)`, `listRuntimes()`,
  `bakeAll(jobs) → { baked, cached, failed }`. Per-job failures
  are captured as `BakeFailure` (reason: `'no-runtime'` |
  `'bake-error'`), never thrown — callers decide whether to
  proceed with a partial bake.

**Reference implementations**:
- `InMemoryBakeCache` — Map-backed.
- `InMemoryBakeOrchestrator({ cache? })` — sequential (determinism
  over parallelism). Per job: cache hit → `cached[]`; cache miss +
  matching runtime → `baked[]` + cache write-through; cache miss +
  no runtime → `failed[]` (no-runtime); runtime throw → `failed[]`
  (bake-error). First-registered runtime wins on clipKind tie.

Test surface: 13 cases for bake (+ existing 161 = 174 total
across 16 files). Covers cache round-trips, register idempotency
+ id uniqueness, bakeAll happy path, cache hits/misses, write-
through, no-runtime failure, bake-error isolation (continues with
remaining jobs), first-registered-wins tie-breaking, empty job
list.
