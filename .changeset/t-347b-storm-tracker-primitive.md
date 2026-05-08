---
'@stageflip/runtimes-frame-runtime-bridge': patch
---

T-347b — `stormTracker` runtime-clip primitive (Cluster C second-of-two new primitives).

Single-style v1 (no `discriminatedUnion` — only consumer is `nhc-cone-of-uncertainty`). Future "inland warnings" 2026 NHC update or regional alternatives (JMA / NHK) introduce a style enum then.

**Mandatory beyond-cone-impact disclaimer**: every render emits the `'Impacts extend beyond the cone'` disclaimer (caller may override text via `disclaimerText?` prop but CANNOT suppress rendering — public-safety failure mode per cluster SKILL "non-negotiable" rule).

Canonical NHC coastal-warning palette baked as static module constants:

- `NHC_HURRICANE_WARNING_RED` (#DC143C)
- `NHC_HURRICANE_WATCH_MAGENTA` (#FF00FF)
- `NHC_TROPICAL_STORM_FIREBRICK` (#B22222)
- `NHC_STORM_SURGE_PURPLE` (#B524F7)

Plus NWS-mandated intensity-letter shorthand `NHC_INTENSITY_LETTERS = ['D', 'S', 'H', 'M']` for forecast-track-dot labels.

Exported helper: `resolveCoastalWarningColor(warningType)` for parity-cli resolver-shim use.

Cone polygon, base map, coastal-warning region paths consumer-supplied as SVG path data per the T-347a `mapPaths[]` precedent (primitive does NOT bundle storm-by-storm geometry).

`ALL_BRIDGE_CLIPS` length: 58 → 59. Frame-deterministic; theme slots `background` + `foreground` (palettes themselves NOT theme-bound).

v1 carve-outs deferred:

- T-347b-advisory-cycle (multi-advisory animated time-lapse)
- T-347b-live-data (`LiveDataClip` integration; Track A frontier per ADR-005)
- T-347b-2026-inland-warnings (would introduce style enum at that point)

Unblocks 1 of 6 Cluster C presets: `nhc-cone-of-uncertainty`.

Note: this PR was opened in parallel with PR #449 (T-347a `weatherMap`). Both bump `ALL_BRIDGE_CLIPS` length 58 → 59. Whichever merges second will need a length bump 59 → 60 — handled in the merge-time conflict resolution.
