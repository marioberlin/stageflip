---
'@stageflip/parity-cli': patch
---

T-378 — preset `nba-ar-replay` substantive (Cluster H 4/4 ELIGIBLE — **CLOSES Cluster H ELIGIBLE**; fourth + final arOverlay consumer via PRESET_ID_BINDINGS override).

Fourth + FINAL `arOverlay`-clipKind consumer; brings **Cluster H (AR & environmental overlays)** from **3/4 → 4/4 ELIGIBLE**. Wired via `PRESET_ID_BINDINGS` override (Pattern C — fourth-preset-for-clipKind via override; the `arOverlay` clipKind-default arm in `DEFAULT_CLIP_KIND_RESOLVER` STAYS bound to `skySportsArFormationsBinding` from T-375 / PR #461 / commit `a5614b56`; sibling overrides `hawkeyeVarSkeletalBinding` from T-376 / PR #462 / commit `54a93ac1` and `olympicSwimLaneTrackBinding` from T-377 / PR #463 / commit `cb2a8c47` also stay unchanged).

**Cluster H closure.** After this PR merges, all four `arOverlay` consumers are signed and `pnpm tsx scripts/check-cluster-eligibility.ts --cluster=ar` reports 4/4 ELIGIBLE. The orchestrator's next dispatch is T-379 cluster-h-compose handler bundle (mirroring T-347 cluster-c-compose pattern).

**§13 (F-30) statement: NOT a structural extension.** PR #461 (T-375 sky-sports-ar-formations as first downstream consumer) discharged the §13 obligation for the `arOverlay` clipKind structural extension introduced in T-375a (PR #460). This PR adds a new preset-binding entry; no new clipKind / element type / compositing mode. Per CLAUDE.md §13, structural-extension verification is a one-time obligation already met.

**New canonical palette `NBA_AR_REPLAY_PALETTE`** (frozen module const) — `hardwoodWarm: '#C68E54'` (hardwood-warm backdrop evokes the court surface the AR overlay composites onto per stub line 27), `nbaRed: '#C9082A'` (NBA brand-red accent per stub line 28; honors the stub hex verbatim — the stub spec calls this "orange" but the cited hex is the canonical NBA brand red), `basketballOrange: '#EE6730'` (reserved for live-mount path; not surfaced in v1 static-fallback), `nbaBlue: '#17408B'` (secondary brand register; reserved for live-mount), `foreground: '#FFFFFF'`. Brand canon is preset-specific per D-T375a-3 (the primitive does NOT bake palettes; AR overlays composite OVER existing video / sport context).

**Visual differentiation from sibling Cluster H presets:**
- sky-sports: navy backdrop (`#0A1128`) + Premier League purple accent border (`#38003C`) + `'Sky Sports Sans', 'Inter'` font stack — register: pitch-anchored formation lineup.
- hawkeye-var: PL purple backdrop (`#34003A`) + decision-green accent border (`#00FC8A`) + `'Premier Sans', 'Champions', 'Space Grotesk'` font stack — register: VAR offside-decision moment, dramatic suspense beat.
- olympic-swim: pool-blue backdrop (`#0E3B6E`) + Olympic-gold accent border (`#D4AF37`) + `'Paris 2024', 'Atkinson Hyperlegible'` font stack — register: lane-anchored timing graphics on a pool surface, world-record-line dramatic moment.
- **nba-ar-replay: hardwood-warm backdrop (`#C68E54`) + NBA brand-red accent border (`#C9082A`) + `'NBA Brand', 'Inter'` font stack — register: court-anchored slow-motion shot-arc trajectory on a hardwood surface, replay highlight moment per stub line 36.**

All four presets ship the SAME primitive (`arOverlay`) but render visually distinct cards.

**Preset binding `nbaArReplayBinding`** — `staticFallback: { label: 'NBA — AR REPLAY', sublabel: 'COURT TRAJECTORY · SHOT ARC', backgroundColor: hardwoodWarm, foregroundColor: foreground, accentColor: nbaRed, showLiveMountIndicator: true }` + `font: { family: "'NBA Brand', 'Inter', system-ui, ...", weight: 700 }` + `permissions: ['camera-tracking']` (declared per stub line 42; v1 ignores at render time per D-T375a-2). `setupRef` intentionally OMITTED — live-mount via `ThreeSceneClip` (NBA AR shot-arc trajectory tracked to camera motion + slowed-replay footage at 25% speed + parabolic shot-arc draw-in + court-anchored player markers + movement-vector arrows) lands with T-378-live-mount post-T-397 Track A finale.

**Reverts to `permissions: ['camera-tracking']`** (D-T378-5). Per stub line 42 ("Court-anchored overlay requires camera tracking. Without it, fall back to a 2D court diagram with shot chart"), NBA AR replay is fundamentally camera-side — the court-anchored 3D AR overlay requires camera-coordinate tracking to project the shot-arc trajectory + player position markers onto the hardwood. Aligns with sibling sky-sports + hawkeye-var camera-tracking declarations; contrasts olympic-swim's network-bound `'network'` declaration. The declaration reserves the schema slot for the post-T-397 live-mount path; v1 render dispatch ignores `permissions` per D-T375a-2 — verified by both unit and round-trip tests asserting `expect(props.permissions).toEqual(['camera-tracking'])`.

**Single-frame static** at frame 60 for cluster-norm consistency with sibling sky-sports + hawkeye-var + olympic-swim presets. PSNR ≥ 36 / SSIM ≥ 0.93 per stub line 49 — looser than the cluster-norm 38/0.95 because the stub authorises that variance for "3D + slow-mo footage variance"; the v1 static-fallback render is byte-deterministic, so the looser thresholds carry no risk for the v1 register and reserve headroom for the post-T-397 live-mount path's expected variance (slow-mo replay at 25% speed introduces sub-frame timing variance; parabolic shot-arc draws over 800 ms; court markers scale-in over 250 ms each).

`PRESET_ID_BINDINGS` length grows from 36 → 37 (Pattern C confirmed — fourth-preset-for-clipKind via override; cluster closer). `DEFAULT_CLIP_KIND_RESOLVER`'s `'arOverlay'` arm UNCHANGED. T-348b `parityFixture-non-blank` CI gate passes against the new golden.

v1 carve-outs deferred:

- T-379 cluster-h-compose handler bundle (mirroring T-347 cluster-c-compose pattern, baking in §3 lessons from `docs/handover-phase13-cluster-c-shipped.md`) — orchestrator dispatches AFTER this PR merges and Cluster H is 4/4 ELIGIBLE.
- T-378-live-mount: wire `ThreeSceneClip` mount path post-T-397 Track A finale; live render of NBA AR shot-arc trajectory tracked to camera motion + slowed-replay footage at 25% speed + parabolic shot-arc draw-in + court-anchored player markers + movement-vector arrows.
- T-378-animated: multi-frame slow-mo entry (1.5 s entry transition), shot-arc draw (800 ms ease-out), court-markers scale-in (250 ms each, staggered 100 ms), movement-vectors animate (400 ms) per stub lines 36-39.
- T-378-display-tier-adapt: auto-reduce complexity when `displayTier === 'mobile'`.
- T-378-2d-court-diagram-fallback: 2D court diagram with shot chart fallback per stub line 42 (camera-tracking-unavailable degraded path).
- T-378-poster-image: image-asset poster surface; v1 ships structured 2D placeholder only.
- T-378-trajectory-physics-validator: enforce stub line 43's "Shot arc must be physically plausible (parabolic, not arbitrary)" constraint at the live-mount path.

Cluster H: 3/4 → 4/4 ELIGIBLE — **CLOSES Cluster H**.
