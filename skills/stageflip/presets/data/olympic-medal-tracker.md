---
id: olympic-medal-tracker
cluster: data
clipKind: standings
source: docs/compass_artifact.md#olympic-medal-tracker
status: substantive
preferredFont:
  family: Games-specific (Paris 2024 etc.)
  license: proprietary-byo
fallbackFont:
  family: IBM Plex Sans
  weight: 600
  license: ofl
permissions:
  - network
signOff:
  parityFixture: 'signed:2026-05-05'
  typeDesign: na
---

# Olympic Medal Tracker — standings register

The universal Olympic / world-championship medal-table convention modeled on broadcast graphics packages (NBC's Chyron PRIME pipeline, BBC's Sport medal tracker, IOC official feeds): a vertical ranked panel listing top countries by gold count, with rank + ISO 3-letter country code + gold/silver/bronze counts + total + rank-delta arrow per row. Common uses cover Olympic broadcast lower-third or fullscreen interlude during medal-ceremony coverage; world-championship aggregations; college-tournament leaderboards (March Madness adjacent); any sport whose closing graphic is "who is winning the meet". The preset's stylistic point is the **ranked-table shape itself + the medal-color column tints + the rank-delta arrows** — every viewer of any medal broadcast parses this geometry without legend.

This preset is the **fifth Cluster E preset to land** (after `f1-sector-purple-green`, `cricket-ball-by-ball-dots`, `big-number-stat-impact`, `bloomberg-ticker`), the **second Cluster E preset to bind `LiveDataClip`** (after `bloomberg-ticker`), and the **first preset to ship using `clipKind: standings`**. Per ADR-003 §D2 the `live-data` family ships two render paths — `liveMount` (host fetches a medal-table feed, renders live with periodic refresh) and `staticFallback` (deterministic snapshot for parity goldens, exports, screenshots). T-357 covers the **staticFallback path** end-to-end via the bound `standings-table` primitive (T-357a); the liveMount path is documented in prose only — host responsibility per ADR-003.

## Visual tokens

The Olympic medal-color palette is a universal broadcast register: every viewer parses gold-silver-bronze without legend. Per-Games "Look of the Games" accents (Paris 2024 blue / red / gold; Tokyo 2020 indigo) are a compose-time tenant theming layer, NOT a preset variant — the medal hexes stay canonical.

- **Background** `#0E0E12` solid (near-black; matches the broadcast graphics base used across cluster E). The panel is a self-contained register, not a window onto the venue feed.
- **Foreground** white `#FFFFFF` for the rank column, country code, total column, and the header row labels.
- **Gold column** `#FFD700` (ISO Olympic gold). Numeric cell tint AND header label tint — the column is the message.
- **Silver column** `#C0C0C0` (ISO Olympic silver). Same posture.
- **Bronze column** `#CD7F32` (ISO Olympic bronze). Same posture.
- **Total column** white `#FFFFFF` (the aggregate is identification, not message) — rendered at heavy weight (`fontWeight: 700`) per `column.kind === 'total'` so it visually anchors the row.
- **Up direction** (rank improved): green `#00B54A` for the ↑ arrow. Same hue as F1 personal-best green for cluster-E consistency.
- **Down direction** (rank dropped): red `#CC0000` for the ↓ arrow.
- **Flat direction** (no rank change within the polling window): neutral gray `#999999` for the ▬ glyph.
- **Country identification**: ISO 3-letter codes (USA, CHN, JPN, AUS, GBR — `column.kind === 'label'`). v1 baseline; **flag-asset slot is a v2 tenant-asset hook**, NOT a v1 requirement. Reasons: (a) license-clean default (no third-party flag-pack dependency); (b) the medal counts + rank are the identification anchor, not the flag (the flag would be decoration). Hosts wire flags at compose time without changing the preset.
- **Records flash overlay** (WR / OR / PB / SB indicators) is a **liveMount surface**, NOT in v1 parity. Documented in `## Animation` for the host's live-feed integration.
- **Row geometry**: `rowHeight: 64` px + `headerHeight: 48` px. With five rows the full panel is ~370 px tall — fits comfortably as a centered overlay on a 1280×720 (or larger) canvas; leaves abundant whitespace above / below for a title or composition framing.

## Typography

- **`preferredFont: Games-specific (Paris 2024 etc.)`** (proprietary BYO per ADR-004 §D3). Per-Games broadcast graphics packages use a Games-specific brand face (Paris 2024 SimplyParis, Tokyo 2020 Hugo Sans, etc.); tenants with a Games licensing agreement slot it in via the FontManager (T-072). Cluster E does not require type-design sign-off (`signOff.typeDesign: na`).
- **`fallbackFont: IBM Plex Sans`** (OFL), weight `600`. Substituted automatically by the FontManager on every rendering medium where the BYO Games face is not cleared. Revised from the stub's `Atkinson Hyperlegible w600` (D-T357-7) for cluster-E consistency: matches `bloomberg-ticker`'s sister IBM Plex Mono register and `big-number-stat-impact`'s heavy-weight register. Atkinson Hyperlegible reads thin at the broadcast register where a humanist sans w600 is the norm.
- **All table cells** (rank, code, numerics, total, delta) carry `font-variant-numeric: tabular-nums` so digit columns align across rows regardless of the fallback font's proportional digits. The ASCII glyph set is small (digits, A–Z, ↑ / ↓ / ▬, simple separators) — no exotic glyph requirements.
- **Total column is heavy weight** (`fontWeight: 700`) — the per-row aggregate visually anchors the row and lets the eye scan down the rightmost number column for the leaderboard reading.
- **Header row** at `fontWeight: 600`, uppercase, letter-spaced (`letterSpacing: 0.04em`) at 85% opacity for the broadcast caption register.
- **No italic, no underline, no strikethrough.** Olympic broadcast graphics never use them.

## Animation

- **Per-row entrance stagger** at `staggerMs: 80` (default) — row `i` fades in from opacity 0 → 1 and slides down from `translateY: -8 → 0 px` over a 12-frame window starting at `delay = i * staggerMs / (1000 / fps)`. At 30 fps the fifth (last) row fully settles by `frame ≈ 12 + 4 * (80 * 30 / 1000) = 22`. Frame 60 (the parity reference frame, mid-hold) is well past entrance — every row is fully opaque + settled.
- **Medal-count increment pulse** (300 ms scale-pulse on per-event medal-count change) is the **liveMount surface**, NOT in v1 parity. The static-fallback path renders one mid-hold frame; the count-up belongs to the host's live data feed where a medal-ceremony tick changes the cell value mid-composition.
- **WR / OR record flash** (gold ↔ red flash with "WR" indicator scaling, 600 ms) is a **per-event live-mount surface**, NOT in v1 parity. The records overlay belongs to the host's live results feed; the parity golden renders the steady-state ranked table without an active record flash.
- **Per-row rank-change pulse** (200 ms flash on rank delta) is the **liveMount surface**. The parity golden renders the steady-state delta arrows (↑/↓/▬) without an active flash.
- **Mid-hold steady-state at frame 60** (per ADR-004 §D5). Parity fixtures snapshot at this frame.
- **No state-transition animation in v1.** State transitions (rank change, medal-count tick, records flash) belong to the live-mount surface where the data source streams updates.

## Rules

- **Bound primitive**: `standings-table` from `@stageflip/runtimes-frame-runtime-bridge` (`packages/runtimes/frame-runtime-bridge/src/clips/standings-table.tsx`, exported as `StandingsTable` + `standingsTableClip`). The `standings` `clipKind` is an integrity-gate sentinel today (in `VALID_CLIP_KINDS` in `scripts/check-preset-integrity.ts`); the v1 resolver in `packages/parity-cli/src/generate-fixture.ts` maps `standings → standings-table` (T-357 D-T357-3) — a clipKind-default entry, NOT a per-preset override (the kind is generic enough that future Cluster A/B/E ranked-list presets — F1 / NBA / NCAA leaderboards, election results, crypto top-N dashboards — can share the binding). Composing tools should mount `StandingsTable` with the `rows` payload + `columns` descriptor + per-column `color` for medal tinting per `OLYMPIC_CANONICAL_STANDINGS` and the resolver's `buildProps` defaults.
- **`LiveDataClip` wrapper bypass for parity (D-T357-12)**: T-357's parity flow does NOT route through `packages/runtimes/interactive/src/clips/live-data/static-fallback.ts`'s `defaultLiveDataStaticFallback` (which emits a generic `TextElement[]` summary, not a styled standings panel). The resolver returns a binding that mounts `standings-table` directly with `OLYMPIC_CANONICAL_STANDINGS` inlined as props. Rationale (identical to T-356 D-T356-11): the parity golden's purpose is to verify the **rendered visual** matches the prose contract; routing through the wrapper would couple the parity golden to wrapper telemetry / endpoint-validation behavior that legitimately changes between releases (T-391 / T-392 evolution). The wrapper's job (host the live mount, emit telemetry, route to staticFallback on failure) is exercised by T-391 / T-392's own tests; T-357 is not the right harness for that surface.
- **Two render paths per ADR-003 §D2**:
  - **liveMount** (host responsibility): host wires a medal-table endpoint (a sports-data provider's Olympics endpoint, a custom IOC results aggregator), declares a refresh policy of 30–60 s ticks, renders the per-row update flash on rank change AND the WR / OR record-flash overlay on per-event records. The preset documents the endpoint shape contract (`{ rank, code, gold, silver, bronze, total, delta }[]`) but does NOT implement fetching, authentication, polling, or rate-limiting. `permissions: [network]` declares the live path's network requirement.
  - **staticFallback** (parity-golden + non-interactive export path): the `OLYMPIC_CANONICAL_STANDINGS` constant in `packages/parity-cli/src/generate-fixture.ts` substitutes for the endpoint payload. Deterministic frame-runtime path; the parity golden snapshots this path at frame 60.
- **Gold-silver-bronze color system transcends language**; do not customize. Per-Games "Look of the Games" palette accents (Paris 2024 blue / red / gold) are layered as a compose-time tenant theming axis, NOT replacing the medal hexes. Tenant brand-color overrides for the medal hues are an escalation per CLAUDE.md §6.
- **329+ events × 33+ sports** — the underlying `standings-table` primitive handles 1..16 rows with K (2..8) columns of mixed kind (`rank` / `label` / `numeric` / `delta` / `total`), so different scoring systems (medal counts, total points, qualifying times) all flow through the same shape. Cluster owners author the row payload at compose time.
- **ISO 3-letter country codes are the v1 identification anchor** (D-T357-6); flags are a v2 tenant-asset slot. Codes are ASCII — any registered Latin-script font renders them correctly. License-clean, no inline raster assets.
- **Five entries in the canonical snapshot** (D-T357-4): top-5 leaderboard (USA leading, CHN second, JPN third, AUS fourth, GBR fifth) with mixed up / down / flat deltas (3 active deltas + 2 flat) exercise both ↑ / ↓ color paths AND the flat-state path in a single golden. The values are illustrative — cluster owners rebrand at compose time. The shape (rank + ISO code + gold/silver/bronze counts + total + delta) IS the contract; literal values are not.
- **Reference frame for parity is mid-hold (frame 60)** per ADR-004 §D5 — single canonical variant per D-T357-5 (the preset's stylistic point is the ranked-table shape itself, not a per-frame state swap; contrast with `f1-sector-purple-green` which has three semantically-distinct variants). The PSNR / SSIM thresholds are stricter than the script default (`35 / 0.95`) per cluster-E norm — see Acceptance below.

## Acceptance (parity)

One reference-frame fixture at `frame: 60` (mid-hold steady-state per ADR-004 §D5):

- `golden-frame-60.png` — the canonical five-row top-5 leaderboard with all rows fully settled (entrance stagger complete by frame ~22). Rows in rank order USA → CHN → JPN → AUS → GBR; rank column right-aligned tabular numerals; ISO country code in the second column at heavy weight; gold (`#FFD700`) / silver (`#C0C0C0`) / bronze (`#CD7F32`) numeric columns column-aligned via tabular-nums; total column at heavy weight (`fontWeight: 700`); delta column showing ↑ (JPN, GBR) in `#00B54A` green, ↓ (AUS) in `#CC0000` red, ▬ (USA, CHN) in `#999999` gray; background `#0E0E12` solid.

Thresholds: **PSNR ≥ 42 dB**, **SSIM ≥ 0.98** (stricter than the generator default `35 / 0.95`; mirrors the `f1-sector-purple-green`, `cricket-ball-by-ball-dots`, `big-number-stat-impact`, `bloomberg-ticker` sister presets in cluster E). Revised from the stub's previous `40 / 0.97` target per T-357 D-T357-9 to match the cluster-E norm; the preset-driven-thresholds follow-up flagged during T-359b is the formal mechanism for per-preset deviation. A static ranked table is less antialiasing-sensitive than `bloomberg-ticker`'s scrolling chyron — no moving glyphs, no subpixel jitter beyond the entrance stagger which has fully settled by frame 60. `42 / 0.98` should pass without difficulty.

**Sign-off (T-357 D-T357-8, in-PR):** the canonical mid-hold golden is committed at `parity-fixtures/data/olympic-medal-tracker/` with the single-variant manifest shape (no `variants` key, per T-359a backward compat). Frontmatter `signOff.parityFixture` is `signed:<UTC date>` after running `scripts/generate-preset-parity-fixture-prod.ts --preset=olympic-medal-tracker --frame=60 --mark-signed`. The golden was rendered locally via the puppeteer/CDP-bound prod renderer; the `standings` clipKind binds to `standings-table` per the v1 resolver in `packages/parity-cli/src/generate-fixture.ts`. The `LiveDataClip` wrapper is bypassed (D-T357-12); the renderer mounts `standings-table` directly with `OLYMPIC_CANONICAL_STANDINGS` inlined as props. Re-render + re-sign with `--force` is the operator's path if the canonical snapshot changes or the FontManager's preload list updates the rendered IBM Plex Sans weight.

## References

- `docs/compass_artifact.md` § Olympic medal tracker — canonical visual source (note: on-disk path mismatch flagged for resolution; integrity invariant 7 SKIPped globally per T-358 D-T358-9 / T-356 D-T356-9 / T-357 D-T357-10).
- `skills/stageflip/presets/data/bloomberg-ticker.md` — sister cluster-E preset; first to bind `LiveDataClip`; closest precedent for the LiveDataClip-wrapper-bypass posture (D-T357-12 mirrors D-T356-11).
- `skills/stageflip/presets/data/f1-sector-purple-green.md` — sister cluster-E preset; `bigNumber` clipKind, state-palette-swap register.
- `skills/stageflip/presets/data/cricket-ball-by-ball-dots.md` — sister cluster-E preset; `scoreBug` clipKind, per-over chip-row register.
- `skills/stageflip/presets/data/big-number-stat-impact.md` — sister cluster-E preset; `bigNumber` clipKind, count-up + settle register.
- `skills/stageflip/presets/data/SKILL.md` — cluster E conventions (tabular numerals mandatory, count-ups slow the viewer down, etc.).
- `packages/runtimes/frame-runtime-bridge/src/clips/standings-table.tsx` — the bound primitive (`StandingsTable`, `standingsTableClip`); shipped by T-357a as a generic vertical N-row ranked-table primitive (1..16 rows, 2..8 columns, five column kinds, frame-derived stagger, theme-slot fallback).
- `packages/parity-cli/src/generate-fixture.ts` — v1 resolver mapping `standings → standings-table` (T-357 D-T357-3) + exported `OLYMPIC_CANONICAL_STANDINGS` constant (D-T357-4).
- `packages/runtimes/interactive/src/clips/live-data/static-fallback.ts` — `defaultLiveDataStaticFallback`; the generic `LiveDataClip` Element[] generator that T-357's parity flow explicitly bypasses per D-T357-12.
- NBC's Chyron PRIME pipeline for real-time 2D / 3D broadcast graphics; BBC Sport medal tracker; IOC official results feeds.
- ADR-003 (interactive runtime tier — staticFallback / liveMount duality).
- ADR-004 (preset system contract — frontmatter, loader, validator, parity sign-off, integrity invariants).
- ADR-005 (frontier clip catalogue — LiveData posture).
