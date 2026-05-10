---
'@stageflip/parity-cli': patch
---

T-377 — preset `olympic-swim-lane-track` substantive (Cluster H 3/4 ELIGIBLE; third arOverlay consumer via PRESET_ID_BINDINGS override; FIRST Cluster H preset to declare `permissions: ['network']` for forward-compat).

Third `arOverlay`-clipKind consumer; brings **Cluster H (AR & environmental overlays)** from **2/4 → 3/4 ELIGIBLE**. Wired via `PRESET_ID_BINDINGS` override (Pattern C — third-preset-for-clipKind via override; the `arOverlay` clipKind-default arm in `DEFAULT_CLIP_KIND_RESOLVER` STAYS bound to `skySportsArFormationsBinding` from T-375 / PR #461 / commit `a5614b56`; sibling override `hawkeyeVarSkeletalBinding` from T-376 / PR #462 / commit `54a93ac1` also stays unchanged; the remaining Cluster H consumer T-378 nba-ar-replay also wires via `PRESET_ID_BINDINGS`).

**§13 (F-30) statement: NOT a structural extension.** PR #461 (T-375 sky-sports-ar-formations as first downstream consumer) discharged the §13 obligation for the `arOverlay` clipKind structural extension introduced in T-375a (PR #460). This PR adds a new preset-binding entry; no new clipKind / element type / compositing mode. The new `permissions: ['network']` declaration is a binding-payload-level value on a pre-existing schema field — `'network'` is one of the four pre-existing values on T-375a's `permissionEnum` (`packages/runtimes/frame-runtime-bridge/src/clips/ar-overlay.tsx` line 118: `z.enum(['camera-tracking', 'live-data', 'network', 'audio'])`). Per CLAUDE.md §13, structural-extension verification is a one-time obligation already met.

**New canonical palette `OLYMPIC_SWIM_LANE_TRACK_PALETTE`** (frozen module const) — `poolBlue: '#0E3B6E'` (pool-blue backdrop evokes the pool water register the AR overlay composites onto), `olympicGold: '#D4AF37'` (world-record / Olympic-record line per stub line 26; doubles as WR-flash peak color per stub line 40), `recordRed: '#E63946'` (paired with gold in the dramatic flash; "the most electrifying broadcast moment" per stub line 47), `foreground: '#FFFFFF'`, `touchFlash: '#FFE74C'` (the 250ms touch flash per stub line 39; reserved for live-mount path; not surfaced in v1 static-fallback). Brand canon is preset-specific per D-T375a-3 (the primitive does NOT bake palettes; AR overlays composite OVER existing video / sport context).

**Visual differentiation from sibling Cluster H presets:**
- sky-sports: navy backdrop (`#0A1128`) + Premier League purple accent border (`#38003C`) + `'Sky Sports Sans', 'Inter'` font stack — register: pitch-anchored formation lineup.
- hawkeye-var: PL purple backdrop (`#34003A`) + decision-green accent border (`#00FC8A`) + `'Premier Sans', 'Champions', 'Space Grotesk'` font stack — register: VAR offside-decision moment, dramatic suspense beat.
- **olympic-swim: pool-blue backdrop (`#0E3B6E`) + Olympic-gold accent border (`#D4AF37`) + `'Paris 2024', 'Atkinson Hyperlegible'` font stack — register: lane-anchored timing graphics on a pool surface, world-record-line dramatic moment.**

All three presets ship the SAME primitive (`arOverlay`) but render visually distinct cards.

**Preset binding `olympicSwimLaneTrackBinding`** — `staticFallback: { label: 'OLYMPIC SWIM — LANE TRACK', sublabel: 'OMEGA VIONARDO TIMING · WR-LINE', backgroundColor: poolBlue, foregroundColor: foreground, accentColor: olympicGold, showLiveMountIndicator: true }` + `font: { family: "'Paris 2024', 'Atkinson Hyperlegible', system-ui, ...", weight: 700 }` + `permissions: ['network']` (declared per stub frontmatter line 14 + stub line 45; v1 ignores at render time per D-T375a-2). `setupRef` intentionally OMITTED — live-mount via `ThreeSceneClip` (T-384) + `LiveDataClip` (Omega Vionardo timing-feed integration with .01s touch-pad precision + WR-line draw-in + record gold/red flash on touch) lands with T-377-live-mount post-T-397 Track A finale.

**FIRST Cluster H preset to declare `permissions: ['network']`** (D-T377-N). Sibling sky-sports + hawkeye-var both declare `permissions: ['camera-tracking']` (camera-side source data); olympic-swim is fundamentally network-bound — touch-pad timing data arrives over the Omega network via `LiveDataClip`; without the timing feed, the canonical .01s precision register collapses to a 2D scoreboard fallback per stub line 45 ("Requires camera-tracking + timing-data feed. Without both, fall back to a 2D scoreboard"). The declaration reserves the schema slot for the post-T-397 live-mount path; v1 render dispatch ignores `permissions` per D-T375a-2 — verified by both unit and round-trip tests asserting `expect(props.permissions).toEqual(['network'])`.

**Single-frame static** at frame 60 for cluster-norm consistency with sibling sky-sports + hawkeye-var presets. PSNR ≥ 34 / SSIM ≥ 0.91 per stub line 51 — looser than the cluster-norm 38/0.95 because the stub authorises that variance for "live AR + camera motion has high variance"; the v1 static-fallback render is byte-deterministic, so the looser thresholds carry no risk for the v1 register and reserve headroom for the post-T-397 live-mount path's expected variance (Omega timing-feed data is asynchronous; touch-pad flash + WR-line draw-in introduce sub-frame timing variance in the live render path).

`PRESET_ID_BINDINGS` length grows from 35 → 36 (Pattern C confirmed — third-preset-for-clipKind via override). `DEFAULT_CLIP_KIND_RESOLVER`'s `'arOverlay'` arm UNCHANGED. T-348b `parityFixture-non-blank` CI gate passes against the new golden.

v1 carve-outs deferred:

- T-377-live-mount: wire `ThreeSceneClip` + `LiveDataClip` mount path post-T-397 Track A finale; live render of AR lane graphics tracked to camera motion + Omega Vionardo timing-feed integration with .01s touch-pad precision + WR-line draw-in + record gold/red flash on touch.
- T-377-animated: multi-frame start-tick (200ms position-number tick), mid-race lane-tracking with camera (continuous), touch-flash (250ms touch flash + 100ms time populate), record-flash (gold + red, 600ms peak), ISO Track 2.0 pointer graphics (athlete names, rankings, headshots above each swimmer) per stub lines 37-41.
- T-377-display-tier-adapt: auto-reduce complexity when `displayTier === 'mobile'`.
- T-377-iso-track-pointer-graphics: SMT ISO Track 2.0 pointer overlay per stub line 41.
- T-377-2d-scoreboard-fallback: 2D scoreboard fallback per stub line 45 for the network-unavailable degraded path.
- T-377-poster-image: image-asset poster surface; v1 ships structured 2D placeholder only.
- T-377-camera-tracking-permission: `permissions: ['camera-tracking', 'network']` variant if the live-mount path requires both per stub line 45; v1 declares `['network']` only (the camera-tracking surface is gated on the `setupRef` ThreeSceneClip path).

Cluster H: 2/4 → 3/4 ELIGIBLE.
