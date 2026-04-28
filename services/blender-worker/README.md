# `services/blender-worker`

Bake-tier worker for StageFlip (T-265). Consumes from BullMQ
`stageflip:bakes`, renders frames via Blender 4.2 LTS, writes outputs to
`bakes/{inputsHash}/frame-{N}.png` per `docs/architecture.md:330`.

## Architecture

- `src/worker.ts` — pure orchestration (idempotency check, frame writes,
  manifest write). Unit-tested.
- `src/blender-invoker.ts` — Blender CLI invoker with GPU/CPU dual-path.
  Unit-tested with a stubbed `child_process.spawn`.
- `src/main.ts` — BullMQ + GCS wiring. Integration-only.
- `scripts/render.py` — Blender Python script. Pure helpers unit-tested via
  `scripts/render_test.py`; the `bpy`-bound render path runs nightly under
  `STAGEFLIP_BLENDER_INTEGRATION=1`.

## Local dev

```sh
docker compose -f docker-compose.dev.yml up --build
```

Spawns Redis + the worker. Submit a job via the `submitBakeJob` Cloud
Function (see `firebase/functions/src/bake/`).

## CI

Per-PR CI runs `docker build` against this Dockerfile (T-265 AC #31).
The full integration test (real Blender render) is gated by
`STAGEFLIP_BLENDER_INTEGRATION=1` and runs nightly.

## Determinism

Same `inputsHash` → byte-identical frames (T-265 D-T265-8). Pinned via:

- `bpy.context.scene.cycles.use_persistent_data = True`
- `cycles.seed = 0`
- `cycles.use_denoising = False`
- `cycles.samples = 64`

If you change any of these, pin the new defaults in `scripts/render.py` and
update the determinism note in
`skills/stageflip/concepts/runtimes/SKILL.md`.

## Out of scope (for T-265)

- Render-farm deployment + scaling — T-266.
- Real `template.blend` files (binary; ship via Git LFS in a follow-up).
- Multi-frame batching, GPU type selection — future tasks.
