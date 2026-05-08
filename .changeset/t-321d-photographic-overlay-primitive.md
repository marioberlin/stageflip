---
"@stageflip/runtimes-frame-runtime-bridge": minor
"@stageflip/cdp-host-bundle": patch
"@stageflip/skills-sync": patch
---

T-321d — `photographic-overlay` primitive carve-out (Cluster D; film-grade tonal overlay; last new-primitive T-321 carve-out).

Static film-grade tonal overlay rendered via SVG `<filter>` primitives. Sealed `mode: 'sepia' | 'cross-process' | 'cinematic-lut' | 'fade'` flat enum. SVG `<feColorMatrix>` for sepia / cinematic-LUT modes; `<feComponentTransfer>` for cross-process / fade modes. Pinned `color-interpolation-filters="sRGB"`; deterministic across CDP per SVG 1.1 §15.3 (Filter Effects spec).

Primary consumer T-351 true-detective-double-exposure (compass canon "photographic clip" register); secondary T-348 stranger-things-benguiat.

58th bridge clip. With T-321d merged, the T-321 carve-out roadmap is structurally complete: 4 of 6 done (T-321a grain + T-321b superseded + T-321c superseded + T-321d); remaining 2 (ThreeSceneClip integration + video-shot kind) are titleSequence modifications deferred to consumer presets.

NO frame counter (static per D-T321d-8); NO theme slots (canonical pre-tuned values per D-T321d-9). v1 carve-outs: T-321d-animated (frame-driven LUT crossfade), T-321d-custom-lut (user 3D LUT input), T-321d-curves (per-channel curve editing), T-321d-modes (additional canonical modes).
