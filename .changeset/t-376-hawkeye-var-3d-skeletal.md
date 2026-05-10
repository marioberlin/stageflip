---
'@stageflip/parity-cli': patch
---

T-376 — preset `hawkeye-var-3d-skeletal` substantive (Cluster H 2/4 ELIGIBLE; second arOverlay consumer via PRESET_ID_BINDINGS override).

Second `arOverlay`-clipKind consumer; brings **Cluster H (AR & environmental overlays)** from **1/4 → 2/4 ELIGIBLE**. Wired via `PRESET_ID_BINDINGS` override (Pattern C — second-preset-for-clipKind via override; the `arOverlay` clipKind-default arm in `DEFAULT_CLIP_KIND_RESOLVER` STAYS bound to `skySportsArFormationsBinding` from T-375 / PR #461 / commit `a5614b56`; later H consumers T-377 olympic-swim-lane-track / T-378 nba-ar-replay also wire via `PRESET_ID_BINDINGS`).

**§13 (F-30) statement: NOT a structural extension.** PR #461 (T-375 sky-sports-ar-formations as first downstream consumer) discharged the §13 obligation for the `arOverlay` clipKind structural extension introduced in T-375a (PR #460). This PR adds a new preset-binding entry; no new clipKind / element type / compositing mode. Per CLAUDE.md §13, structural-extension verification is a one-time obligation already met.

**New canonical palette `HAWKEYE_VAR_SKELETAL_PALETTE`** (frozen module const) — `premierLeaguePurple: '#34003A'` (PL purple decision-moment backdrop per stub line 30), `decisionGreen: '#00FC8A'` (decision-moment trim + accent border), `foreground: '#FFFFFF'`, `attackerLine: '#FF6B35'` + `defenderLine: '#00B5D8'` (offside-line colors reserved for live-mount path; not surfaced in v1 static-fallback). Brand canon is preset-specific per D-T375a-3 (the primitive does NOT bake palettes; AR overlays composite OVER existing video / sport context).

**Visual differentiation from sibling sky-sports-ar-formations preset:**
- sky-sports: navy backdrop (`#0A1128`) + Premier League purple accent border (`#38003C`) + `'Sky Sports Sans', 'Inter'` font stack — register: pitch-anchored formation lineup.
- hawkeye-var: PL purple backdrop (`#34003A`) + decision-green accent border (`#00FC8A`) + `'Premier Sans', 'Champions', 'Space Grotesk'` font stack — register: VAR offside-decision moment, dramatic suspense beat per stub line 48 ("Most emotionally charged overlay in football").

Both presets ship the SAME primitive (`arOverlay`) but render visually distinct cards.

**Preset binding `hawkeyeVarSkeletalBinding`** — `staticFallback: { label: 'VAR — CHECKING OFFSIDE', sublabel: 'HAWK-EYE 3D SKELETAL TRACKING', backgroundColor: premierLeaguePurple, foregroundColor: foreground, accentColor: decisionGreen, showLiveMountIndicator: true }` + `font: { family: "'Premier Sans', 'Champions', 'Space Grotesk', system-ui, ...", weight: 700 }` + `permissions: ['camera-tracking']` (declared per stub line 46 + cluster SKILL line 42; v1 ignores at render time per D-T375a-2). `setupRef` intentionally OMITTED — live-mount via `ThreeSceneClip` (T-384) with Hawk-Eye limb-tracking 3D wireframe overlay lands with T-376-live-mount post-T-397 Track A finale.

**Single-frame static** at frame 60 for cluster-norm consistency with sibling sky-sports preset. PSNR ≥ 36 / SSIM ≥ 0.93 per stub line 52 — slightly looser than the cluster-norm 38/0.95 because the stub authorises that variance for "3D overlay variance"; the v1 static-fallback render is byte-deterministic, so the looser thresholds carry no risk for the v1 register and reserve headroom for the post-T-397 live-mount path's expected variance.

`PRESET_ID_BINDINGS` length grows from 34 → 35 (Pattern C confirmed — second-preset-for-clipKind via override). `DEFAULT_CLIP_KIND_RESOLVER`'s `'arOverlay'` arm UNCHANGED. T-348b `parityFixture-non-blank` CI gate passes against the new golden.

v1 carve-outs deferred:

- T-376-live-mount: wire `ThreeSceneClip` mount path post-T-397 Track A finale; live render of 3D wireframe skeletal limb-tracking + animated offside lines on freeze-frame.
- T-376-animated: multi-frame banner-slide-in (400ms), loading-pulse (1.5s cycle), offside-line draw-in (600ms), 3D wireframe scale-in (500ms), pause-then-decision-flash (1s pause + 350ms green/red flash) per stub lines 38-42.
- T-376-display-tier-adapt: auto-reduce complexity when `displayTier === 'mobile'`.
- T-376-audio-cue: `varAudioCue` slot wiring per stub line 38; mandatory audio cue per stub rule line 47.
- T-376-decision-variant: green-flash (goal-confirmed) vs red-flash (overturned) variants per stub line 42; v1 ships pre-decision "checking" register only.
- T-376-poster-image: image-asset poster surface; v1 ships structured 2D placeholder only.

Cluster H: 1/4 → 2/4 ELIGIBLE.
