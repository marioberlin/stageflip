---
'@stageflip/runtimes-frame-runtime-bridge': patch
'@stageflip/cdp-host-bundle': patch
'@stageflip/skills-sync': patch
---

T-375a — `arOverlay` bridge-clip primitive (Cluster H first-of-six PR sequence; static-fallback v1, live-mount gated on Track A T-397+).

First-of-six PR opening **Cluster H (AR overlays)**. Shared primitive that all 4 Cluster H presets (T-375 `sky-sports-ar-formations` / T-376 `hawkeye-var-3d-skeletal` / T-377 `olympic-swim-lane-track` / T-378 `nba-ar-replay`) bind to via `clipKind: arOverlay`.

**New primitive `arOverlay`**:

- Single-style v1 (no `discriminatedUnion` — the 4 presets share one prop surface; per-sport canon supplied as caller-side `staticFallback` content + (when live) author-defined ThreeSceneClip `setupRef`). Mirrors T-347g `weatherStar4000Panel` / T-347h `imrStaticFallback` single-object-schema precedent.
- **v1 ships static-fallback rendering ONLY**. Live-mount via `ThreeSceneClip` (T-384 merged via PR #272) is GATED on Track A finale (T-397+ not yet merged); downstream task T-375a-live-mount wires the integration once T-397+ lands. Live-mount API surface (`setupRef`, `permissions`) DECLARED on the schema for forward compatibility but ignored at v1 render. Same posture as T-347h's stub-canon-explicit static-fallback allowance for `ThreeSceneClip` deferral.
- **Surface**: required `staticFallback: { label, sublabel?, backgroundColor?, foregroundColor?, accentColor?, showLiveMountIndicator? }` (centered card render — label ALL CAPS Bold 48px; optional sublabel Regular 22px at 70% opacity; optional accent border 1px; default bottom-right "AR · STATIC FALLBACK" 14px monospace badge at 50% opacity); optional `setupRef: { module, symbol? }` (reserved); optional sealed `permissions: ReadonlyArray<'camera-tracking' | 'live-data' | 'network' | 'audio'>` (reserved); optional `displayTier: 'broadcast' | 'mobile'` (reserved); optional top-level `backgroundColor` / `foregroundColor` / `accentColor` (theme-slot resolution path); optional `font?` / `position?`.
- **No canonical palettes baked at primitive level** — AR overlays composite OVER existing video / sport context; per-sport color canon (Sky Sports navy `#0A1128` + PL purple `#38003C`, Hawk-Eye PL purple `#34003A` + offside red `#FF6B35` + offside blue `#00B5D8`, Olympic gold/red WR-line flash, NBA orange `#C9082A`) lives in per-preset binding.
- **Theme slots**: `backgroundColor` → `palette.background`, `foregroundColor` → `palette.foreground`, `accentColor` → `palette.accent`.
- **mixBlendMode**: NOT declared in v1 (opaque static-fallback render); may be revisited post-T-397 for transparent compositing over background video.
- **Frame-deterministic**: pure function of props; no `Date.now` / `Math.random` / `crypto.*` / `setTimeout` / `setInterval` / `fetch` / `requestAnimationFrame` / `addEventListener` / `useEffect`.
- **Typography**: default `'Inter', system-ui` (preset-driven; `fontRequirements` omitted).

`ALL_BRIDGE_CLIPS` length: 62 → 63. Updates 14 sibling clip tests + cdp-host-bundle runtime test + skills-sync `LIVE_RUNTIME_MANIFEST` + frame-runtime-bridge SKILL.md. No PRESET_ID_BINDINGS / parity-fixture / golden edits in this PR (those land with PR2).

v1 carve-outs deferred:

- T-375a-live-mount: wire `ThreeSceneClip` mount path post-T-397 (Track A finale).
- T-375a-camera-tracking: surface + thread `cameraTrack` input (Zero Density / Stype / Omega Vionardo / SMT ISO Track 2.0).
- T-375a-display-tier-adapt: auto-reduce complexity for `displayTier === 'mobile'`.
- T-375a-poster-image: image-asset poster surface (data: URL or absolute URL); v1 ships structured 2D placeholder only.

Per CLAUDE.md §13 (F-30) verification posture: **deferral to PR2** per acceptable-evidence option 3 — pixel verification deferred to PR2 (T-375 `sky-sports-ar-formations`), the first downstream consumer; unit tests in this PR verify the wired-up shape (props validation, schema rejections, render dispatch shape, ALL_BRIDGE_CLIPS membership, manifest sync).
