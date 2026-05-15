---
'@stageflip/schema': minor
'@stageflip/runtimes-interactive': minor
'@stageflip/runtimes-three': minor
---

Close T-403 YELLOW residuals R-6 + R-7 — DoS protections for ShaderClip + ThreeSceneClip. ShaderClip gains `frameBudgetMs` cap (default 16ms WARN; 200ms KILL ceiling) with per-frame kill-switch + telemetry (`shader-clip.frame-budget-warning`, `shader-clip.frame-budget-exceeded`). ThreeSceneClip gains `memoryBudgetMb` cap (default 256MB; ceiling 2048MB) with author opt-in `ThreeClipHandle.getMemoryEstimateMb()` poll + `three-scene-clip.memory-budget-exceeded` kill path. `ThreeClipHostProps` gains an optional `onHandleReady` seam used by the interactive-tier factory to capture the author's handle. **All 9 originally-YELLOW residuals from T-403 now closed across PRs (YELLOW batches 1 + 2 + 3).** YELLOW batch 3 (final) per PO direction 2026-05-15.
