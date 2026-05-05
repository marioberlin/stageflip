---
id: bloomberg-ticker
cluster: data
clipKind: newsTicker
source: docs/compass_artifact.md#financial-market-data
status: substantive
preferredFont:
  family: Bloomberg in-house
  license: proprietary-byo
fallbackFont:
  family: IBM Plex Mono
  weight: 500
  license: ofl
permissions:
  - network
signOff:
  parityFixture: 'signed:2026-05-05'
  typeDesign: na
---

# Bloomberg Ticker — financial market register

The universal financial-broadcast convention modeled on Bloomberg TV's iconic ticker bar: a continuous horizontal left-scrolling band along the bottom of the screen carrying ticker symbols + price + delta + arrow (▲/▼/▬). Common uses cover market open/close coverage, earnings reports, crypto trading dashboards, and lower-third stock chyrons. The preset's stylistic point is the **continuous scroll + the symbol/price/delta register** — every viewer of any financial broadcast parses this geometry without legend.

This preset is the **fourth Cluster E preset to land** (after `f1-sector-purple-green`, `cricket-ball-by-ball-dots`, `big-number-stat-impact`), the **first Cluster E preset to bind `LiveDataClip`**, and the **first preset to ship using `clipKind: newsTicker`**. Per ADR-003 §D2 the `live-data` family ships two render paths — `liveMount` (host fetches an endpoint, renders live ticks) and `staticFallback` (deterministic snapshot for parity goldens, exports, screenshots). T-356 covers the **staticFallback path** end-to-end via the bound `news-ticker-bar` primitive (T-356a); the liveMount path is documented in prose only — host responsibility per ADR-003.

## Visual tokens

The Bloomberg-canonical palette is a universal financial-broadcast register: every market viewer parses up-green / down-red without legend. Asian-market locales swap green↔red — that is a compose-time `locale: 'us-eu' | 'asia'` prop, NOT a preset variant.

- **Band** sits at the bottom of the canvas at 60 px height (~5.5% of 1080p), full width. Background `#0A0A0A` solid (near-black; matches the broadcast graphics base used across cluster E).
- **Symbol fill** white `#FFFFFF` — high-contrast against the dark band. Same color regardless of direction; the symbol is identification, not message.
- **Price fill** white `#FFFFFF` — same color as symbol. The number is the value, not the message.
- **Up direction** (positive delta): green `#00D26A` for the delta text + ▲ arrow. Bloomberg-canonical green; the message is "value increased".
- **Down direction** (negative delta): red `#FF3C3C` for the delta text + ▼ arrow. Bloomberg-canonical red; the message is "value decreased".
- **Flat direction** (zero delta): neutral gray `#999999` for the delta text + ▬ arrow. Default state when price has not moved within the polling window.
- **Chip layout**: each entry occupies a fixed 220 px slot (D-T356a-4 — keeps the modulo math watertight for the doubled-row marquee). Adjacent chips separated by a 60 px gap. At 1920×1080 with the canonical six-token snapshot, ~5–6 chips are visible mid-band depending on scroll offset.

The direction color IS the message — applied uniformly to the delta text + arrow glyph. Symbol and price stay white across all three states; the eye locks onto the colored delta as the salient signal.

## Typography

- **`preferredFont: Bloomberg in-house`** (proprietary BYO per ADR-004 §D3). The Bloomberg Terminal / Bloomberg TV graphics packages use a proprietary in-house family; tenants with a Bloomberg licensing agreement slot it in via the FontManager (T-072). Cluster E does not require type-design sign-off (`signOff.typeDesign: na`).
- **`fallbackFont: IBM Plex Mono`** (OFL), weight `500`. Substituted automatically by the FontManager on every rendering medium where the BYO face is not cleared. IBM Plex Mono's tabular numerics (`font-variant-numeric: tabular-nums` is implicit in the mono family) keep the price + delta columns stable as the band scrolls leftward; non-tabular numerics would visibly wobble. Already license-cleared in `THIRD_PARTY.md`.
- **Symbol register**: per D-T356-7 the broadcast-canonical posture pairs a heavier sans-serif weight for symbols (3–5 ASCII characters; tabular spacing matters less than glyph weight). The frontmatter schema accepts a single `fallbackFont` entry today (extending it to a font-pair is a preset-system change — out of envelope), so this dual-font posture is documented in prose: composing tools that mount `news-ticker-bar` for `bloomberg-ticker` SHOULD route symbol glyphs through `IBM Plex Sans` w600 (OFL, license-cleared) when the FontManager preload list includes that face. The v1 parity fixture uses IBM Plex Mono for all three glyph runs (symbol + price + delta) — the cluster-E "good-enough not broadcast-exact" posture (mirrors `f1-sector-purple-green`'s Barlow Condensed fallback per T-359 D-T359-7).
- **Mono is mandatory for column-stable scrolling.** The price + delta columns must not wobble as glyphs translate leftward; tabular figures are non-negotiable. Cluster-E convention; documented in `skills/stageflip/presets/data/SKILL.md`.
- **No italic, no underline, no strikethrough.** Bloomberg broadcast graphics never use them.

## Animation

- **Continuous left-scroll** at 60 px/sec (the middle of the stub's 50–80 px/sec range). The `news-ticker-bar` primitive translates the row by `(frame * scrollSpeed) / fps` pixels and wraps via modulo at `entries.length * (chipWidth + chipGap)` — a doubled-row marquee keeps the seam invisible as the first copy exits left and the second copy slides into the original first slot.
- **Direction is always leftward**, linear (no easing). Tickers never bounce; the broadcast convention is a steady mechanical scroll. New entries enter from the right edge; old entries exit at the left edge.
- **Per-tick price-change pulse** (150 ms flash on price update) is the **liveMount surface**, NOT in v1 parity. The static-fallback path renders one mid-hold frame; the flash-on-update belongs to the host's live data feed. A `pulseOnUpdate` prop on `news-ticker-bar` is a flagged follow-up if a Reviewer demands it.
- **Mid-hold steady-state at frame 60** (per ADR-004 §D5). At 30 fps and 60 px/sec scroll, frame 60 = 2 seconds = 120 px of leftward translation — past the entrance window, well into steady-state mid-scroll. The parity fixture snapshots at this frame; ≥4 entries are visible in the band with partial clipping at the entry/exit edges.
- **No state-transition animation in v1.** State transitions (price change, direction flip) belong to the live-mount surface where the data source streams updates. The static-fallback path renders one terminal snapshot.

## Rules

- **Bound primitive**: `news-ticker-bar` from `@stageflip/runtimes-frame-runtime-bridge` (`packages/runtimes/frame-runtime-bridge/src/clips/news-ticker-bar.tsx`, exported as `NewsTickerBar` + `newsTickerBarClip`). The `newsTicker` `clipKind` is an integrity-gate sentinel today (in `VALID_CLIP_KINDS` in `scripts/check-preset-integrity.ts`); the v1 resolver in `packages/parity-cli/src/generate-fixture.ts` maps `newsTicker → news-ticker-bar` (T-356 D-T356-3) — a clipKind-default entry, NOT a per-preset override (the kind is generic enough that future financial / sports / news-feed presets can share the binding). Composing tools should mount `NewsTickerBar` with the `entries` payload + scroll/chip/band parameters per `BLOOMBERG_CANONICAL_SNAPSHOT` and the resolver's `buildProps` defaults.
- **`LiveDataClip` wrapper bypass for parity (D-T356-11)**: T-356's parity flow does NOT route through `packages/runtimes/interactive/src/clips/live-data/static-fallback.ts`'s `defaultLiveDataStaticFallback` (which emits a generic `TextElement[]` summary, not a styled chyron). The resolver returns a binding that mounts `news-ticker-bar` directly with `BLOOMBERG_CANONICAL_SNAPSHOT` inlined as props. Rationale: the parity golden's purpose is to verify the **rendered visual** matches the prose contract; routing through the wrapper would couple the parity golden to wrapper telemetry / endpoint-validation behavior that legitimately changes between releases (T-391 / T-392 evolution). The wrapper's job (host the live mount, emit telemetry, route to staticFallback on failure) is exercised by T-391 / T-392's own tests; T-356 is not the right harness for that surface.
- **Two render paths per ADR-003 §D2**:
  - **liveMount** (host responsibility): host wires a market-data endpoint (Bloomberg feed, IEX Cloud, Coinbase Pro WebSocket), declares a refresh policy of 1–5 s ticks, renders the per-entry update flash on price change. The preset documents the endpoint shape contract (`{ symbol, price, delta, direction }[]`) but does NOT implement fetching, authentication, or rate-limiting. `permissions: [network]` declares the live path's network requirement.
  - **staticFallback** (parity-golden + non-interactive export path): the `BLOOMBERG_CANONICAL_SNAPSHOT` constant in `packages/parity-cli/src/generate-fixture.ts` substitutes for the endpoint payload. Deterministic frame-runtime path; the parity golden snapshots this path at frame 60.
- **Locale-dependent green/red** (`locale: 'us-eu' | 'asia'`): Asian markets render the up direction red and the down direction green, inverted from the Western convention. This is a **compose-time prop**, NOT a preset variant — the parity golden renders the `us-eu` palette (green-up / red-down). Hosts wire the locale axis at composition time; the resolver does not parameterize it.
- **Always include the unit** (currency symbol, ticker symbol). Don't render bare numbers; the Bloomberg-canonical chyron is parsed as `<symbol> <price> <delta>` triplets.
- **Bloomberg green / red are non-negotiable**: `#00D26A` up / `#FF3C3C` down on `#0A0A0A` background. Tenant brand-color overrides for the up/down hues are an escalation per CLAUDE.md §6 — the universal financial-broadcast register parses these specific hues; brand-recoloring breaks the visual contract.
- **Six entries in the canonical snapshot** (D-T356-4): four equities (`AAPL`, `MSFT`, `GOOGL`, `NVDA`, `TSLA`) + one crypto (`BTC-USD`); five up + one down to exercise both color paths. The values are illustrative — cluster owners rebrand at compose time. The shape (symbol + price + delta + direction) IS the contract; literal values are not.
- **Reference frame for parity is mid-hold (frame 60)** per ADR-004 §D5. The PSNR / SSIM thresholds are stricter than the script default (`35 / 0.95`) per cluster-E norm — see Acceptance below.

## Acceptance (parity)

One reference-frame fixture at `frame: 60` (mid-hold steady-state per ADR-004 §D5):

- `golden-frame-60.png` — the canonical six-token snapshot scrolled 120 px leftward (2 seconds @ 30 fps × 60 px/sec). ≥4 entries visible in the band with partial clipping at the entry/exit edges; symbols + prices in white at the IBM Plex Mono register; deltas + arrows in `#00D26A` green (up) / `#FF3C3C` red (down) on `#0A0A0A` background; band sits at the bottom of the 1280×720 canvas at 60 px height.

Thresholds: **PSNR ≥ 42 dB**, **SSIM ≥ 0.98** (stricter than the generator default `35 / 0.95`; mirrors the `f1-sector-purple-green`, `cricket-ball-by-ball-dots`, `big-number-stat-impact` sister presets in cluster E). The stub's previous `40 / 0.97` target was revised up per T-356 D-T356-8 to match the cluster-E norm; the preset-driven-thresholds follow-up flagged during T-359b is the formal mechanism for per-preset deviation. A horizontal scrolling band is more antialiasing-sensitive than a static bigNumber or chip row — moving glyphs introduce subpixel jitter on every frame; if `42 / 0.98` fails after hand-pinning, the follow-up must ship first OR `news-ticker-bar` needs sub-pixel snap discipline.

**Sign-off (T-356 D-T356-10, in-PR):** the canonical mid-hold golden is committed at `parity-fixtures/data/bloomberg-ticker/` with the single-variant manifest shape (no `variants` key, per T-359a backward compat). Frontmatter `signOff.parityFixture` is `signed:<UTC date>` after running `scripts/generate-preset-parity-fixture-prod.ts --preset=bloomberg-ticker --frame=60 --mark-signed`. The golden was rendered locally via the puppeteer/CDP-bound prod renderer; the `newsTicker` clipKind binds to `news-ticker-bar` per the v1 resolver in `packages/parity-cli/src/generate-fixture.ts`. The `LiveDataClip` wrapper is bypassed (D-T356-11); the renderer mounts `news-ticker-bar` directly with `BLOOMBERG_CANONICAL_SNAPSHOT` inlined as props. Re-render + re-sign with `--force` is the operator's path if the canonical snapshot changes or the FontManager's preload list updates the rendered IBM Plex Mono weight.

## References

- `docs/compass_artifact.md` § Financial Market Data — canonical visual source (note: on-disk path mismatch flagged for resolution; integrity invariant 7 SKIPped globally per T-356 D-T356-9).
- `skills/stageflip/presets/data/f1-sector-purple-green.md` — sister cluster-E preset; `bigNumber` clipKind, state-palette-swap register.
- `skills/stageflip/presets/data/cricket-ball-by-ball-dots.md` — sister cluster-E preset; `scoreBug` clipKind, per-over chip-row register.
- `skills/stageflip/presets/data/big-number-stat-impact.md` — sister cluster-E preset; `bigNumber` clipKind, count-up + settle register.
- `skills/stageflip/presets/data/SKILL.md` — cluster E conventions (tabular numerals mandatory, mono is mandatory for column-stable scrolling, etc.).
- `packages/runtimes/frame-runtime-bridge/src/clips/news-ticker-bar.tsx` — the bound primitive (`NewsTickerBar`, `newsTickerBarClip`); shipped by T-356a as a generic horizontal-scrolling chyron primitive (1..24 entries, three direction states, doubled-row marquee).
- `packages/parity-cli/src/generate-fixture.ts` — v1 resolver mapping `newsTicker → news-ticker-bar` (T-356 D-T356-3) + exported `BLOOMBERG_CANONICAL_SNAPSHOT` constant (D-T356-4).
- `packages/runtimes/interactive/src/clips/live-data/static-fallback.ts` — `defaultLiveDataStaticFallback`; the generic `LiveDataClip` Element[] generator that T-356's parity flow explicitly bypasses per D-T356-11.
- ADR-003 (interactive runtime tier — staticFallback / liveMount duality).
- ADR-004 (preset system contract — frontmatter, loader, validator, parity sign-off, integrity invariants).
- ADR-005 (frontier clip catalogue — LiveData posture).
