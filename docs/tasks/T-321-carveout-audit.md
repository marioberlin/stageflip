---
title: T-321 carve-out audit — actual state of all 5 carve-outs as of 2026-05-08
id: docs/tasks/T-321-carveout-audit
phase: 13
size: S
owner_role: orchestrator
status: substantive
last_updated: 2026-05-08
adr: docs/decisions/ADR-004-preset-system.md
---

# T-321 carve-out audit (2026-05-08)

## Why this audit exists

The T-321 `TitleSequenceClip` primitive (Phase 13 α; shipped earlier) deferred 5 atmospheric / structural pieces to follow-up tasks per its out-of-scope decisions. Those follow-ups were enumerated as five carve-outs to be specced separately:

1. T-321a `Grain` primitive
2. T-321b `LightLeak` primitive
3. T-321c `Particles` primitive
4. T-321d `PhotographicOverlay` sister clip
5. ThreeSceneClip integration into T-321
6. video-shot kind on T-321 (added late; for T-352 succession-home-video VHS register)

T-321a was specced + impl'd cleanly (PR #427/#428 — `grain.tsx`, 57th bridge clip, hash-based per-pixel canvas+ImageData noise).

**T-321b's spec (PR #429) was authored without verifying the file's pre-existence.** Mid-impl 2026-05-08, the implementer agent halted on a real architectural collision: `light-leak.tsx` had been on `main` since **T-131b.2 (PR #65, Phase 1 medium-tranche bridge clip ports)**. The spec author missed it; the impl agent's escalation was correct.

T-321b was marked `superseded` via PR #430. **This audit** covers the remaining 4 carve-outs to determine which (if any) face similar collisions, before more specs get authored.

## Audit findings

### 1. T-321b `LightLeak` — SUPERSEDED (PR #430)

| Property | Value |
|---|---|
| File | `packages/runtimes/frame-runtime-bridge/src/clips/light-leak.tsx` |
| Origin | T-131b.2, PR #65 (Phase 1 medium-tranche bridge clip port) |
| ClipKind | `'light-leak'` (kebab-case) |
| Schema | 5 optional props: `color1`, `color2`, `color3`, `intensity`, `seed` |
| Render | Three blurred radial-gradient blob `<div>`s + inline `<feTurbulence>` SVG grain texture |
| Determinism | `Math.sin/cos` over `frame/fps`; pure; deterministic |
| Counted in | `ALL_BRIDGE_CLIPS` (one of the 57); `live-runtime-manifest.ts`; `runtimes.test.ts` `expectedKinds` |
| Serves canon? | **YES** — T-348 stranger-things-benguiat compass canon "Light leaks (warm orange, intermittent)" satisfied by tuning `color1/2/3` to warm-orange + adjusting `intensity`/`seed` |

**Status**: T-321b spec marked `superseded`. T-348's preset PR consumes the existing primitive directly.

### 2. T-321c `Particles` — LIKELY SUPERSEDED (this audit)

| Property | Value |
|---|---|
| File | `packages/runtimes/frame-runtime-bridge/src/clips/particles.tsx` |
| Origin | T-131d.1, PR #67 (Phase 1 medium-tranche; lottie/three/shader tier — bridge-eligible portion) |
| ClipKind | `'particles'` |
| Schema | sealed `style: 'confetti' \| 'sparkles' \| 'snow' \| 'rain' \| 'bokeh'` enum + `count`, `color`, etc |
| Render | seeded LCG-driven particle positions; per-particle `<div>` overlay; deterministic memoised initial state |
| Determinism | seeded LCG (no `Math.random`); pure; deterministic |
| Counted in | `ALL_BRIDGE_CLIPS`; `live-runtime-manifest.ts`; `runtimes.test.ts` `expectedKinds` |
| Serves canon? | **YES** — T-348's "atmospheric dust particles drifting" satisfied by `style: 'snow'` or `'sparkles'` with low `count` + low `intensity` |

**Recommendation**: Mark T-321c as **SUPERSEDED**, no new spec needed. T-348's preset PR consumes the existing primitive directly with `style: 'snow'`.

If T-348 surfaces a register gap (e.g., needs a "drifting-dust" style not in the existing 5-style enum), file as **T-321c-extend** follow-up.

### 3. T-321d `PhotographicOverlay` — GENUINE NEW PRIMITIVE

| Property | Value |
|---|---|
| File | does NOT exist |
| Existing similar | `light-leak.tsx` (color blobs); `grain.tsx` (per-pixel noise); `particles.tsx` (sparse overlay) — none provide film-grade tonality |
| Compass canon role | T-351 true-detective-double-exposure ("photographic clip" — film-grade tonality / cross-process / sepia / cinematic LUT register); T-348 stranger-things-benguiat may also benefit |
| Approximate scope | Sealed mode enum (e.g. `'sepia' \| 'cross-process' \| 'cinematic-lut' \| 'fade'`) with SVG `<filter>` render via per-mode `<feColorMatrix>` / `<feComponentTransfer>` |

**Recommendation**: Spec + impl as a genuine new primitive. M-sized; mirror T-321a / T-321b spec structure but render via SVG filter overlay (deterministic across CDP). Will become the 58th bridge clip.

### 4. ThreeSceneClip integration into T-321 — TITLE-SEQUENCE MODIFICATION (not a new clip)

| Property | Value |
|---|---|
| Existing primitive | `packages/runtimes/interactive/src/clips/three-scene/` (T-384 ThreeSceneClip; frontier track per ADR-005) |
| Existing in bridge | `packages/runtimes/frame-runtime-bridge/src/clips/scene-3d.tsx` (T-131d.1 port; `'scene-3d'` kind; static 3D scene) |
| Integration target | `packages/runtimes/frame-runtime-bridge/src/clips/title-sequence.tsx` |
| Existing T-321 shot kinds | `titlePlate` / `letterAnimation` / `creditsBlock` / `colorPanel` / `holdFrame` (5 sealed `kind` values in the discriminatedUnion) |
| Integration shape | Add a 6th shot kind `kind: 'threeScene'` with content `{ sceneRef: string, ...threeSceneProps }` that delegates to the interactive ThreeSceneClip OR scene-3d bridge clip |
| Consumers | T-349 got-trajan-clockwork; T-353 severance-surreal-3d |

**Status**: Genuine integration work — modifies existing `title-sequence.tsx`, NOT a new primitive. L-sized (frontier-track decisions: live-tier vs bridge-tier delegation; permission envelope; static-fallback for non-interactive renders).

**Recommendation**: Defer this carve-out until the user actually starts on T-349 or T-353. The integration's shape depends on consumer needs (interactive vs static; permission required vs not). Spec should be authored alongside the first consumer task.

### 5. video-shot kind on T-321 — TITLE-SEQUENCE MODIFICATION (not a new clip)

| Property | Value |
|---|---|
| Integration target | `packages/runtimes/frame-runtime-bridge/src/clips/title-sequence.tsx` |
| Existing T-321 shot kinds | `titlePlate` / `letterAnimation` / `creditsBlock` / `colorPanel` / `holdFrame` |
| Existing video clip in bridge | `packages/runtimes/frame-runtime-bridge/src/clips/video-background.tsx` (T-131c) |
| Integration shape | Add a 6th shot kind `kind: 'videoShot'` with content `{ src: AssetRef, poster?, mute?: boolean, fitMode? }` that renders a video element scoped to the shot's `[startMs, endMs]` window |
| Consumer | T-352 succession-home-video (VHS-tape register; video-as-letterforms) |

**Status**: Genuine integration work — modifies existing `title-sequence.tsx`. M-sized (sealed-shot-kind extension + per-shot video element + mute/fitMode props + frame-windowed playback math).

**Recommendation**: Spec + impl when T-352 is the active task; the integration's exact prop shape is driven by T-352's consumer needs.

## Updated remaining work

Of the original 5 T-321 carve-outs:

| # | Item | Status |
|---|---|---|
| 1 | T-321a `Grain` | ✅ DONE — PR #428 |
| 2 | T-321b `LightLeak` | ✅ SUPERSEDED — exists from T-131b.2 |
| 3 | T-321c `Particles` | ✅ SUPERSEDED — exists from T-131d.1 (this audit) |
| 4 | T-321d `PhotographicOverlay` | 🟡 NEW — spec + impl needed |
| 5 | ThreeSceneClip integration into T-321 | 🟡 DEFERRED — integration spec lives with first consumer (T-349 or T-353) |
| 6 | video-shot kind on T-321 | 🟡 DEFERRED — integration spec lives with T-352 consumer |

**1 of 5 is genuine new-primitive work (T-321d).** The other 4 are either already shipped or are integration tasks whose specs naturally live alongside their consumer preset specs.

## Lesson captured (process)

The T-321b spec author missed T-131b.2 because the spec template's "required reading" list didn't include a "verify file does not already exist on main" step. **Future primitive-carve-out specs MUST include this step in the required-reading checklist** as item #1, before any other reading. Implementer agent escalation is the safety net (which worked here), but catching it at spec-time saves a wasted spec-review cycle.

## Recommendation for next dispatch

1. **T-321d `PhotographicOverlay` spec + impl** — the only genuine new-primitive carve-out. M-sized.
2. After T-321d lands, the T-321 carve-out chain is complete (the remaining 2 deferrals are consumer-driven integrations).
3. Free the next session to either pick up Cluster D presets (T-348/T-349/T-350/T-351/T-352/T-353) or pivot to a different cluster (C / H).
