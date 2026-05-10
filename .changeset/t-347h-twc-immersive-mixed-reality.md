---
'@stageflip/runtimes-frame-runtime-bridge': patch
'@stageflip/parity-cli': patch
---

T-347h — `imrStaticFallback` primitive + preset `twc-immersive-mixed-reality` substantive (Cluster C 6/6 — CLOSES Cluster C ELIGIBLE).

Combined primitive carve-out + preset implementation. The TWC IMR (Immersive Mixed Reality) canon is a Track A frontier feature: live 3D rendering via `ThreeSceneClip` (Unreal Engine + Zero Density Reality Engine + Mo-Sys StarTracker per stub line 34). The stub-canon-explicit static-fallback allowance (line 41) authorizes a v1 static-only register — same posture as T-353 severance-surreal-3d. T-347h ships the static fallback; live IMR defers to T-347h-three-scene.

**New primitive `imrStaticFallback`**:

- Single-style v1 (no `discriminatedUnion`)
- Sealed `scenario: 'severe' | 'calm'` enum (v1 ships 'severe'; 'calm' deferred to T-347h-calm)
- Storm-gray 3-stop vertical gradient backdrop (`IMR_STORM_GRAYS = ['#1A1F26', '#2C3441', '#4A5566']`)
- Severity HUD card (bottom-third) with white 48px UPPERCASE label + 2px black text-stroke + danger-red side-band (`IMR_DANGER_REDS = ['#CC0000', '#FF3333']`)
- Data-label HUD strip (top-right) with Bold 24pt tabular
- Optional deterministic SVG noise particle overlay (closed-form xxhash32-style hash mixer; NOT physics-driven — physics defers to T-347h-physics-particles)
- Theme slots: `background` + `foreground`; palettes themselves NOT theme-bound
- Frame-deterministic; exported helpers `hashSeed` + `generateParticles`

**Preset `twc-immersive-mixed-reality`** binding: TORNADO WARNING / ATLANTA METRO / Issued 4:12 PM EDT severity card + 4 data rows (WIND 155 MPH / PRESSURE 948 MB / TEMP 76°F / GUST 180 MPH) + moderate storm-particle density 0.6. Inter Tight OFL fallback for the proprietary TWC custom modernized typeface (Trollbäck+ system).

`ALL_BRIDGE_CLIPS` length: 60 → 61. Updates 12 sibling clip tests + cdp-host-bundle runtime tests + skills-sync `LIVE_RUNTIME_MANIFEST` + frame-runtime-bridge SKILL.md.

PRESET_ID_BINDINGS-length assertion in `generate-fixture.test.ts` bumped 30 → 31.

v1 carve-outs deferred:

- T-347h-three-scene: live `ThreeSceneClip` IMR rendering (Track A frontier per ADR-005)
- T-347h-camera-sweep: multi-frame cinematic camera sweep 12-20s per stub line 37
- T-347h-physics-particles: physics-driven motion from real / simulated weather telemetry per stub line 36
- T-347h-calm: optional `scenario: 'calm'` parity-register variant

Per CLAUDE.md §13 (F-30) verification posture: this PR's preset golden + PO ratification verifies the new primitive end-to-end. Single consumer means single PO ratification closes the §13 obligation for the static-fallback register.

Wired via `PRESET_ID_BINDINGS` (preset's `clipKind: fullScreen` STAYS UNCHANGED; binding overrides `clipName: 'imrStaticFallback'` per the T-328 msnbc-big-board / T-339 uefa-starball-refraction / T-347g twc-retrocast-8bit precedent).

Cluster C: 5/6 → 6/6 ELIGIBLE (after T-347c, T-347d, T-347e, T-347f, T-347g, T-347h all merge). **Closes Cluster C.**
