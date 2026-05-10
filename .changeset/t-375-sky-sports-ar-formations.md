---
'@stageflip/parity-cli': patch
---

T-375 — preset `sky-sports-ar-formations` substantive (Cluster H 1/4 ELIGIBLE; first arOverlay consumer; §13 verifier for arOverlay clipKind).

First `arOverlay`-clipKind consumer; opens **Cluster H (AR & environmental overlays)** to **1/4 ELIGIBLE**. Wired via `DEFAULT_CLIP_KIND_RESOLVER` (Pattern C — first preset for a clipKind takes the clipKind-default slot, NOT a `PRESET_ID_BINDINGS` override; later H consumers T-376 hawkeye-var-3d-skeletal / T-377 olympic-swim-lane-track / T-378 nba-ar-replay wire via `PRESET_ID_BINDINGS`).

**§13 (F-30) verifier** for the `arOverlay` clipKind structural extension introduced in T-375a (PR #460). Per CLAUDE.md §13 acceptable-evidence option 3, T-375a explicitly deferred pixel verification to this preset PR; the parity-golden generated here + PO ratification IS the end-to-end render verification for the new clipKind.

**New canonical palette `SKY_SPORTS_AR_FORMATIONS_PALETTE`** (frozen module const) — `skyNavy: '#0A1128'` (Sky Sports navy backdrop per stub line 26), `premierPurple: '#38003C'` (Premier League purple accent per stub line 27), `foreground: '#FFFFFF'`. Brand canon is preset-specific per D-T375a-3 (the primitive does NOT bake palettes; AR overlays composite OVER existing video / sport context).

**Preset binding `skySportsArFormationsBinding`** — `staticFallback: { label: 'AR FORMATION OVERLAY', sublabel: '4-3-3 LINEUP', backgroundColor: skyNavy, foregroundColor: foreground, accentColor: premierPurple, showLiveMountIndicator: true }` + `font: { family: "'Sky Sports Sans', 'Inter', system-ui, ...", weight: 700 }` + `permissions: ['camera-tracking']` (declared per stub line 42 + cluster SKILL line 42; v1 ignores at render time per D-T375a-2). `setupRef` intentionally OMITTED — live-mount via `ThreeSceneClip` (T-384) lands with T-375-live-mount post-T-397 Track A finale.

**Single-frame static** at frame 60 (canonical "settled" register matching the cluster norm). PSNR ≥ 36 / SSIM ≥ 0.93 per stub line 48 — slightly looser than the cluster-norm 38/0.95 because the stub authorises that variance for "live AR composited frames"; the v1 static-fallback render is byte-deterministic, so the looser thresholds carry no risk for the v1 register and reserve headroom for the post-T-397 live-mount path's expected variance.

`PRESET_ID_BINDINGS` length unchanged at 34 (Pattern C confirmed — no override entry). T-348b `parityFixture-non-blank` CI gate passes against the new golden.

v1 carve-outs deferred:

- T-375-live-mount: wire `ThreeSceneClip` mount path post-T-397 Track A finale.
- T-375-camera-pan: multi-frame animated camera-pan + sequential formation-line draw-in (200ms per line per stub line 37).
- T-375-display-tier-adapt: auto-reduce complexity when `displayTier === 'mobile'`.
- T-375-poster-image: image-asset poster surface; v1 ships structured 2D placeholder only.

Cluster H: 0/4 → 1/4 ELIGIBLE.
