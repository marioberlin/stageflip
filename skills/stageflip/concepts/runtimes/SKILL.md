---
title: Runtime Tiers
id: skills/stageflip/concepts/runtimes
tier: concept
status: substantive
last_updated: 2026-04-27
owner_task: T-265
related:
  - skills/stageflip/concepts/clip-elements/SKILL.md
  - skills/stageflip/concepts/storage-contract/SKILL.md
  - skills/stageflip/concepts/rate-limits/SKILL.md
---

# Runtime Tiers

A clip is a unit of motion that the renderer dispatches to a registered
runtime. StageFlip ships **three runtime tiers** so each clip kind picks the
fastest path that still produces correct output.

| Tier | Where it runs | When to use | Reference |
|---|---|---|---|
| **Frame-deterministic** | JS, in-browser preview + CDP export | Math-driven motion (interpolate, spring, easing); same frame number → same pixels | `@stageflip/frame-runtime` |
| **Interactive** | Live JS engine in a sandbox | Frontier clips that mount real DOM/WebGL — `liveMount` + `staticFallback` per ADR-005 | `@stageflip/runtimes/interactive` |
| **Bake** | Offline worker (Blender 4.2 LTS) | Heavy 3D scenes, ray-tracing, photoreal materials that cannot run live | `@stageflip/runtimes/blender` (T-265) |

Per ADR-003, every `ClipDefinition` declares which tiers it supports. The
renderer-core dispatcher picks the highest-quality available output that
fits the export budget.

## Bake tier (T-265)

A bake-tier clip ships its scene + parameters to a Blender worker, which
renders frames offline and uploads them to a content-addressed cache:

```
bakes/{inputsHash}/frame-{N}.png   (architecture-locked path,
                                    docs/architecture.md:330)
bakes/{inputsHash}/manifest.json   (frameCount, fps, region, completedAt)
```

The cache key — `inputsHash` — is the **whole game**. Same `{scene,
duration}` → same hash → cache hit; any input change → new hash → re-bake.
Wrong canonicalization here means cache poisoning, missed cache hits, or
duplicate bakes for the same intent. Pinned in `inputs-hash.test.ts`:

- Field order in objects is normalized (sorted-key JSON canonicalization).
- Field types are NOT coerced: `1` and `"1"` produce different hashes.
- Arrays preserve order (semantic).
- `bigint`, non-finite numbers, and circular structures are rejected.

### Lifecycle

1. **Author** creates a `BlenderClip` element with `scene + duration`.
   Editor computes `inputsHash` and pins it in the document.
2. **Submit** — caller invokes the `submitBakeJob` Cloud Function. Handler
   verifies `requireAuth`, debits 10 tokens from the org's rate-limit
   bucket (bake is ~10x more expensive than a normal request), recomputes
   the hash, and either short-circuits (cache hit) or enqueues a BullMQ job
   on `stageflip:bakes`.
3. **Render** — a `services/blender-worker` container consumes from
   `stageflip:bakes`, opens the scene template, applies parameters, and
   renders `[0, ceil(durationMs/1000 * fps))` frames via Cycles in
   deterministic mode (`use_persistent_data = True`, fixed seed,
   `use_denoising = False`, pinned sample count). The worker is **idempotent
   on `manifest.json`**: if it sees the manifest at the output path, it
   short-circuits successfully — required because BullMQ delivery is
   at-least-once and a duplicate-delivery race must not produce two
   parallel bakes.
4. **Fetch** — clients poll `getBakedFrames(inputsHash, { region })`. The
   call returns one of `'ready' | 'pending' | 'failed'` based on whether
   `manifest.json`, neither marker, or `bake_failed.json` is present.

### Region routing

Bake outputs respect `org.region` per T-271. The submit handler reads the
caller's region from their org doc; the worker writes to either the US
(`stageflip-assets`) or EU (`stageflip-eu-assets`) bucket. The cache key
is region-namespaced **only by bucket** — the path
`bakes/{inputsHash}/...` is the same in both regions.

### GPU / CPU dual-path (D-T265-7)

The worker tries GPU rendering first when `CUDA_VISIBLE_DEVICES` is set;
on CUDA failure, it retries on CPU and emits a `bake.cpu_fallback` warning.
CPU is ~10x slower but produces identical output thanks to Cycles'
deterministic mode.

### Determinism contract

Same `inputsHash` → byte-identical frames. This is pinned by:

- `bpy.context.scene.cycles.use_persistent_data = True`
- `cycles.seed = 0`
- `cycles.use_denoising = False`
- `cycles.samples = 64`

If you change any of these defaults, the cache is silently invalidated for
existing hashes. Bump the canonicalization rule explicitly and document the
migration.

## Cross-links

- `packages/runtimes/blender/` — submit + fetch + queue + inputs-hash.
- `services/blender-worker/` — Docker image, BullMQ consumer, render.py.
- `firebase/functions/src/bake/` — Cloud Function adapter.
- `docs/decisions/ADR-003-interactive-runtime-tier.md` — three-tier model.
- `docs/architecture.md:330` — bake path layout.
- `docs/architecture.md:339-341` — BullMQ queue names.
