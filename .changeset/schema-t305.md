---
"@stageflip/schema": minor
---

T-305: interactive-clip contract — `staticFallback` + `liveMount` schema +
export-matrix hooks per ADR-003 §D2/§D3/§D4 and ADR-005 §D1.

- New `packages/schema/src/clips/` subdirectory:
  - `interactive.ts` — `interactiveClipSchema`, `permissionSchema`,
    `componentRefSchema`, `liveMountSchema`, `INTERACTIVE_CLIP_FAMILIES`
    (the seven frontier families per ADR-005 §D1). The
    `staticFallback.min(1)` refine enforces ADR-003 §D2's invariant at
    the type level (bare-`liveMount` clips are rejected).
  - `export-targets.ts` — `exportTargetSchema` (8 closed targets),
    `EXPORT_MATRIX`, and `resolveClipPath(target, clip)` per ADR-003 §D3.
  - `index.ts` — public surface re-exports.
- `packages/schema/src/elements/index.ts` adds `interactive-clip` to the
  discriminated `Element` union (additive; existing branches unchanged).
- Browser-safe surface: pure Zod, no fs/path/child_process imports.
- Mechanical exhaustiveness updates in `@stageflip/rir` and
  `@stageflip/export-pptx` to cover the new union branch (no behavior
  change for existing element types). Per-target exporter integration is
  follow-up work.

T-305 is the schema/contract layer the runtime (T-306) and per-family
frontier clips (T-383–T-396) consume.
