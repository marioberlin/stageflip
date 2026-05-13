---
id: f1-ar-grid-lineup
cluster: cluster-b
clipKind: arOverlay
source: https://www.formula1.com/ + broadcast canon (F1 TV / Sky Sports F1 pre-race grid-walk; public reference; no entry in docs/compass_artifact.md)
status: substantive
preferredFont:
  family: Formula1 Display Bold
  license: proprietary-byo
fallbackFont:
  family: Barlow Condensed
  weight: 700
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# F1 AR Grid Lineup — pre-race grid-lineup AR overlay

## Visual tokens
- `arOverlay` clipKind binding (T-375a primitive; the shared Cluster H AR-overlay register; **v1 ships static-fallback rendering ONLY** per D-T375a-2 — the live-mount path via `ThreeSceneClip` is gated on Track A finale T-397+). This preset is the AR-formations-bundle integration half of T-515 — second production consumer of `arOverlay` after T-375 sky-sports-ar-formations (which fills the cluster-H slot); this F1 grid-lineup preset binds the same primitive into the Sports Networks cluster-B pack as the AR-bundle companion to the F1 Pro driver-position register.
- Static-fallback content: centered card on a carbon-modern dark `#15151E` backdrop (matches the T-515 F1 Pro register chrome — same broadcast register family). Card label: `F1 GRID LINEUP` (UPPERCASE, 48 pt, 800 weight per the primitive's labelStyle); sublabel: `20-CAR STARTING GRID · POSITIONS P1–P20` (22 pt, 400 weight, opacity 0.7). The "AR · STATIC FALLBACK" badge (mono font, bottom-right) signals to the operator that the live-mount path is gated — same posture as T-375 sky-sports-ar-formations.
- Accent border: F1 brand red `#E10600` (modern F1 logo red — 2018+ refresh; matches the F1 Pro register accent). The primitive renders a 1 px border around the container when `staticFallback.accentColor` is supplied (primitive line 191: `border: accent !== undefined ? '1px solid ${accent}' : 'none'`). v1 pins the accent to surface the brand red on the static-fallback card edge.
- Foreground white `#FFFFFF` — the label + sublabel text color; matches the F1 Pro register foreground.
- 16:9 broadcast canvas (1280 × 720) — `position` defaulted via the primitive's `useVideoConfig` fallback (region defaults to the full canvas when `position` is omitted); v1 ships without an explicit `position` to render the AR overlay full-frame (the AR-formations register is broadcast-first, not lower-frame-anchored like the score-bug register).
- v1 carries **no live-mount payload** (no `setupRef`, no `permissions`). The schema slot is reserved for forward compatibility per D-T375a-2; the v1 dispatch always renders the static-fallback path even if `setupRef` were supplied. Live-mount integration (the 20-driver 3D grid lineup with team-colored cars positioned by qualifying order) lands in a downstream T-515a-live-mount carve-out once Track A finale (T-397+) merges.
- displayTier: `broadcast` (default per primitive; the F1 TV broadcast register; mobile-tier auto-reduction is a future T-375a-display-tier-adapt carve-out).

## Typography
- Static-fallback label (`F1 GRID LINEUP`): rendered by the primitive in 48 pt 800-weight UPPERCASE via `labelStyle` (primitive lines 215–223). The primitive HARD-CODES `textTransform: 'uppercase'` so any casing of the source string normalizes to UPPERCASE at render time. v1 uses already-uppercase source (`F1 GRID LINEUP`) to make the rendering deterministic across input variations.
- Static-fallback sublabel (`20-CAR STARTING GRID · POSITIONS P1–P20`): 22 pt 400-weight per `sublabelStyle` (primitive line 225–232). The dot separator `·` is an en-space-friendly broadcast-canon token (U+00B7); the P1–P20 range is the canonical 20-car F1 grid spread.
- Live-mount text rendering (3D-positioned floating driver codes above each grid slot, 3-letter UPPERCASE FIA codes per the F1 Pro register convention) is GATED on T-515a-live-mount — out of scope for v1 static-fallback.
- Rendered family v1: `'Inter', system-ui, ...` — the primitive's DEFAULT_FONT_FAMILY (primitive line 143). The `font.family` prop is honored when supplied; v1 ships without `font` to inherit the primitive default. The bespoke `Formula1 Display Bold` (proprietary BYO) is declared in frontmatter for the type-design batch review (sister cluster-B composer task) and is the BYO substitution when a tenant supplies the licensed file at the binding wire step.

## Animation
- v1 static-fallback is a static frame (the primitive is pure — primitive line 161–162: "Frame-deterministic per D-T375a-6; pure function of props; no useEffect"). No animation in v1 — the wave-in / mid-hold / wave-out choreography is provided by the composing `frame-clip` envelope at the binding wire step.
- Live-mount choreography (gated on T-515a-live-mount post-T-397):
  - Wave-in: 20 grid slots illuminate sequentially from the front (P1) to the back (P20), 50 ms per slot stagger (1000 ms total wave duration). Each slot's team-colored car (Red Bull `#1E5BC6` Verstappen P1, Mercedes `#6CD3BF` Hamilton, Ferrari `#ED1C24` Leclerc, McLaren `#F58020` Norris, etc.) fades in with a 200 ms EASE_OUT_QUART transition.
  - Mid-hold: indefinite — the AR overlay holds the 20-car grid through the pre-race grid-walk segment of the broadcast (typically 30–90 s before lights-out).
  - Wave-out: reverse — from P20 (rear) to P1 (front), 30 ms per slot stagger (600 ms total). Each slot's car fades out with a 150 ms EASE_IN_QUART transition.
- All live-mount animation specifications above are GATED on T-515a-live-mount — v1 static-fallback parity captures only the static card.

## Rules
- Use when an F1 pre-race grid-lineup AR overlay is called for — the broadcast-canon pre-race grid-walk segment where the 20-car starting grid is displayed in qualifying order with each car's team livery colors visible. F1 AR Grid Lineup sits within Cluster B's sports-broadcast family as the AR-bundle companion to the T-515 F1 Pro driver-position register (the register shows live race position; the AR overlay shows pre-race grid lineup — they're complementary, not competing).
- Do not use for non-pre-race contexts. The live race itself uses the T-515 F1 Pro driver-position register (scoreBug `'racing'` style branch); the post-race classification uses a future T-515b-family carve-out (full 20-driver final-classification register).
- Do not paint the full backdrop F1 brand red `#E10600`. The brand red is reserved for the accent-border surface (the 1 px border per the primitive's `border` rule); pulling the backdrop to brand red would over-saturate the AR card and destroy the static-fallback dark-chrome register identity.
- The "AR · STATIC FALLBACK" badge is REQUIRED on v1 (matches T-375 sky-sports-ar-formations posture — signals to the operator that the live-mount path is gated). When T-515a-live-mount lands, the badge can be dropped via `staticFallback.showLiveMountIndicator: false` (the v1 default is `true`).
- 20-car grid is the canonical F1 starting-grid count (since 2017 when the grid expanded from the 19-car interim to the post-2017 22-car maximum / 20-car post-Manor-collapse norm). v1 sublabel reads "POSITIONS P1–P20" matching the modern grid count; per-binding overrides at the wire step can adjust for sprint-race or qualifying-session variants.
- Designed for broadcast-first display (`displayTier: 'broadcast'`); mobile-tier auto-reduction is gated on T-375a-display-tier-adapt.

## Acceptance (parity)
- Reference frame: 60 (= 2000 ms @ 30 fps; steady-state static-fallback card visible; matches T-375 sky-sports-ar-formations frame-pinning norm). v1 is a static frame — frame 0 / frame 60 / frame 120 all render byte-identically by primitive contract.
- PSNR ≥ 42 dB, SSIM ≥ 0.98 (hand-pinned per `parity-fixture-signoff.md` workflow — generator default 35 / 0.95 overwritten on land; matches T-375 sky-sports-ar-formations + T-507 / T-508 / T-509 / T-512 / T-513 / T-514 / T-515 cross-cluster norm).

## Trade-offs (v1 cosmetic divergences from the compass register)
- **Static-fallback rendering only — no live 3D grid.** The full F1 grid lineup AR experience (20 team-colored 3D cars positioned in qualifying-order grid slots with floating driver codes + lap-times-from-Q3) requires live-mount via `ThreeSceneClip` (D-T375a-2). v1 ships the static-fallback poster card; the 3D grid renders post-T-397 when Track A finale lands and the T-515a-live-mount carve-out wires the integration. This is the single most visible deviation from the AR-bundle live experience.
- **No per-driver detail in the static-fallback card.** The card surfaces "F1 GRID LINEUP" + "20-CAR STARTING GRID · POSITIONS P1–P20" only — no per-driver code (HAM / VER / NOR), no team-color preview, no qualifying time. Surfacing per-driver detail in the 2D static fallback would require a primitive-level slot addition (the `staticFallback` schema is `label` + `sublabel` + colors only — primitive lines 93–102). Adding a `staticFallback.gridPreview?: GridSlot[]` slot is a candidate T-375a-family primitive-level follow-up.
- **No team-color cars previewed in the static fallback.** The static card is foreground-text + accent-border only; the team-color identification happens only in the live-mount 3D scene (each car is rendered in its constructor's livery accent). v1 accepts the chrome-minimal static card matching T-375 sky-sports-ar-formations posture.
- **No qualifying-time row.** F1 broadcasts often surface the qualifying time alongside each grid position (e.g. `P1 VER 1:24.317`). v1 static-fallback omits qualifying times entirely; live-mount can layer them in 3D space per the T-515a-live-mount carve-out.
- **No pole-position-flash decoration.** F1 broadcast canon often flashes the pole-position slot (P1) with a brand-red `#E10600` pulse when the grid is first revealed. v1 ships a static accent border only; the pole-flash animation is a live-mount-only effect deferred to T-515a-live-mount.
- **No camera-tracking input declared.** The primitive's `permissions` schema accepts `camera-tracking` (primitive line 118); v1 omits it because the static fallback doesn't need camera-tracking. The T-515a-live-mount carve-out will declare `permissions: ['camera-tracking']` when the live 3D grid renders over the broadcast feed.
- **Backdrop opacity rendered at 100 %, not transparent.** The primitive's static-fallback `backgroundColor` is opaque (primitive line 186); production live-mount AR compositing renders the cars over the live broadcast feed transparently. v1 static-fallback is correctly opaque per D-T375a-2; the transparent-compositing posture revisits in T-515a-live-mount.

## Out of scope
- **Live 3D grid render** (20 team-colored cars + floating driver codes + qualifying times) — gated on T-515a-live-mount (post-T-397 Track A finale).
- Camera-tracking integration (Zero Density Reality Engine / Stype RedSpy / SMT ISO Track 2.0 / Omega Vionardo) — primitive-level surfacing of the `cameraTrack` input; T-375a-camera-tracking carve-out.
- Wave-in / mid-hold / wave-out animation choreography (deferred to live-mount; the composing `frame-clip` envelope at the binding wire step covers basic in/out for the static-fallback frame).
- Per-driver detail in the static fallback (driver codes + team colors + qualifying times) — primitive-level slot addition under the T-375a-family label.
- Pole-position-flash decoration (P1 brand-red pulse on grid reveal) — live-mount-only effect.
- Mobile-tier auto-reduction (`displayTier: 'mobile'` complexity adaptation) — T-375a-display-tier-adapt carve-out.
- Sprint-race grid lineup variant (8-driver grid + reverse-qualifying-order) — separate T-515b-family preset.
- Post-race final-classification AR overlay — separate T-515b-family preset.
- Pit-lane start indicator (drivers starting from the pit lane instead of the grid) — primitive-level slot addition.
- Image-asset poster surface (a pre-rendered grid PNG instead of the structured 2D placeholder) — T-375a-poster-image carve-out.

## References
- https://www.formula1.com/ — canonical F1 league website
- Broadcast canon: F1 TV / Sky Sports F1 pre-race grid-walk segment (public reference; 20-car grid lineup pattern documented across decades of F1 broadcasts)
- ADR-004 (preset system contract)
- ADR-005 (frontier surfaces; `ThreeSceneClip` for live AR mount)
- T-375a — `arOverlay` primitive (the shared Cluster H AR-overlay register this preset wires)
- T-375 — sky-sports-ar-formations preset (first production consumer of `arOverlay`; structural template for this preset's static-fallback posture)
- T-376 — hawkeye-var-3d-skeletal (sister Cluster H AR preset)
- T-377 — olympic-swim-lane-track (sister Cluster H AR preset)
- T-378 — nba-ar-replay (sister Cluster H AR preset)
- T-515 — THIS PR — F1 Pro register + F1 AR Grid Lineup; closes the Sports Networks pack at v0.2.0 GA
- T-515a-live-mount (downstream carve-out — wires the live 3D grid render once Track A finale T-397+ lands)
