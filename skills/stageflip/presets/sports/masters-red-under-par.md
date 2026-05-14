---
id: masters-red-under-par
cluster: sports
clipKind: standings
source: docs/compass_artifact.md#the-masters-leaderboard
status: substantive
preferredFont:
  family: CBS Sports custom
  license: proprietary-byo
fallbackFont:
  family: Inter
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: 'signed:2026-05-06'
  typeDesign: 'signed:2026-05-14'
---

# Masters Red-Under-Par — standings / leaderboard

The canonical Masters Tournament golf-leaderboard register: a compact 5-row top-of-leaderboard ranked panel on a dark broadcast base `#0E0E12` with **Augusta National green `#006747` accent** on the rank column (theme-slot mapping; not a visible accent strip — see Rules §accent-strip), white text, Mixed-case player surnames left-aligned in the PLAYER column, score-to-par + thru-hole as right-aligned tabular-numeric columns, and Inter 600 OFL fallback for the proprietary CBS Sports custom face. Common uses: golf live tournament leaderboards (Augusta-specific palette + register); sister-but-distinct from T-357's neutral Olympic medal-table register on the same dark base.

This preset is the **sixth Cluster B preset to land** AND the **second `standings` clipKind consumer** (after T-357's clipKind-default `olympic-medal-tracker`) AND the **first `standings`-keyed `PRESET_ID_BINDINGS` override**. Wired via `PRESET_ID_BINDINGS['masters-red-under-par']` per Pattern C — the `'standings'` arm in `DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED at `standingsBinding` (T-357); T-333 / T-334 / T-335 / T-337 / T-339a's prior overrides stay UNCHANGED. **First production consumer of the canonical CBS-Chirkinian red-black-green score-to-par color rule** at the preset level (with documented cosmetic divergence per D-T338-10 — primitive renders single-color-per-column, not per-cell-VALUE-derived).

## Visual tokens

The Masters leaderboard register is canonical and locked: dark broadcast base + 5-row top-5 ranked panel + Augusta-green-rank-column-accent + Mixed-case surnames + tabular-numeric score-to-par + thru-hole columns. Restraint is the signature.

- **Background / dark broadcast base** `#0E0E12` — Cluster B/E shared default. Augusta green is the accent, NOT the full fill (stub line 24 — "Augusta National green permeates the broadcast — applied as accent strip, not full fill"). Passed to the primitive's `background` prop.
- **Foreground / text** `#FFFFFF` — all text white: ranks, surnames, scores, thru-hole.
- **Augusta National green accent** `#006747` — Augusta National's official green hex. Applied two ways:
  - As `column.color: '#006747'` on the rank column (visible tint on the rank glyph per primitive `renderCell`).
  - As `goldColor: '#006747'` (theme-slot mapping to `palette.accent` per primitive D-T357a-6 line 358) — the primitive's `goldColor` prop carries the accent color even though the primitive does not expose a dedicated `accentColor` slot.
  - The visible accent-strip register (e.g., a 4 px left-edge bar across the panel) is **NOT** natively renderable; see Rules §accent-strip.
- **5-row compact top-5 leaderboard** — exactly 5 rows (Scheffler / McIlroy / Schauffele / Spieth / Bryson). Stub line 23 calls for "showing top 5–10 players"; T-338 ships exactly 5 (cluster-norm match with T-357's Olympic 5-row snapshot).
- **5-column shape** — `rank / label (PLAYER) / numeric (TO PAR) / numeric (THRU) / total (placeholder)`:
  - `rank` column with `color: '#006747'` (Augusta green), `width: 56`, right-aligned tabular-nums.
  - `label` column with `flex: 2`, reads `row.code` (player surname; Mixed-case), left-aligned weight 600.
  - `score` column (`TO PAR` header), right-aligned tabular-nums; **default fg color** (no per-column color override) — see Rules §canonical-color.
  - `thru` column (`THRU` header), right-aligned tabular-nums; default fg color.
  - `total` column with `width: 0` — visually-empty placeholder; primitive renders `row.total ?? ''` (none of our rows carry `total`, so an empty cell). Width 0 to suppress visible space; column kept for visual rhythm + valid 5-column shape.
- **Per-row fields** — `rank` (1..5 integer), `code` (player surname Mixed-case), `values: [scoreToPar, thruHole]` 2-element number array. No `total`, no `delta` — golf canon doesn't surface position-change deltas inline with the score.
- **Numeric encoding for canonical golf-string values** — the primitive's `'numeric'` column kind reads `row.values[]` as `number` (Zod `z.array(z.number())`); strings are rejected. The canonical golf rendering (`E` for even par, `+2` with leading `+`, `F` for finished) is **NOT** directly expressible. v1 ships:
  - `E` (even par) renders as `0`.
  - Positive scores (e.g., +2) render as `2` (no leading `+`).
  - `F` (finished, hole 18) renders as `18`.
  - Cosmetic divergence — see Rules §numeric-encoding.
- **Compact upper-right anchor** — conceptual `position: { x: 760, y: 80 }` on a 1280×720 canvas; ~60% from the left, near the top. The `standings-table` primitive does NOT expose a `position` prop on its propsSchema — the actual render position depends on the host scaffold's clip-mount geometry. v1 supplies `bandPosition: 'overlay'` (matches T-357 olympic posture); upper-right anchoring is a host concern, not a primitive prop.
- **`bandPosition: 'overlay'`** — primitive renders as overlay rather than fullscreen (matches T-357 olympic posture; primitive default).
- **Row + header dimensions** — `rowHeight: 64`, `headerHeight: 48`, `staggerMs: 80` (cluster-norm defaults). 5 rows × 64 = 320 px body + 48 px header = 368 px panel total. By frame 22 at 30fps all 5 rows are settled; frame 60 is well past entrance — steady-state.

The compact 5-row leaderboard with Augusta-green-rank-column-accent IS the message — at frame 60 the eye locks onto a clean ranked stack of `1 Scheffler -12 18`, `2 McIlroy -10 17`, `3 Schauffele -8 18`, `4 Spieth 0 18`, `5 Bryson 2 15` on the dark base.

## Typography

- **`preferredFont: CBS Sports custom`** (`proprietary-byo` per ADR-004 §D3). The CBS Sports broadcast graphics typeface — bespoke geometric sans with characteristic numeral construction tuned for tabular score columns. Tenants licensing CBS Sports custom locally slot it in via the FontManager (T-072). Cluster B IS in `TYPE_DESIGN_REQUIRED_CLUSTERS`, so `signOff.typeDesign` MUST be `'pending-cluster-batch'` or `'signed:YYYY-MM-DD'`, NOT `'na'`. T-338 holds at `pending-cluster-batch`; the cluster-B type-design batch review (cluster-composer task) flips this field across all nine Cluster B presets in one downstream PR.
- **`fallbackFont: Inter`** weight `600` (SIL Open Font License 1.1 via Google Fonts; originally Rasmus Andersson). Inter 600 (Semibold) approximates the bold register the stub calls for ("Player surnames: Bold, 18–22 pt"; "Score to par: Bold, 20–24 pt"). Substituted automatically by the FontManager on every rendering medium where the BYO CBS Sports custom face is not cleared.
- **`font` prop NOT on primitive propsSchema** — the `standings-table` primitive (lines 43–63) does NOT carry a `font` prop. The font posture is set primitively to `system-ui, -apple-system, BlinkMacSystemFont, sans-serif` (line 80); per the primitive's TSDoc (lines 181–184), the FontManager applies the preset's frontmatter-declared `preferredFont` / `fallbackFont` at render time. T-338 omits `font` from the resolver snapshot (D-T338-13). The frontmatter font declarations satisfy the bespoke-font invariant 6 fallback half.
- **Per-cell weights from primitive defaults** — `rank` cells weight 500 (line 113); `label` cells weight 600 (line 128); `numeric` cells weight 500 (line 134); `total` cells weight 700 (HEAVY_FONT_WEIGHT, line 138).
- **Tabular numerals on rank / numeric / total columns** — primitive applies `fontVariantNumeric: 'tabular-nums'` UNCONDITIONALLY on these column kinds. Score-to-par + thru-hole + rank align cleanly across rows.
- **Casing** — surnames (`'Scheffler'` / `'McIlroy'` / `'Schauffele'` / `'Spieth'` / `'Bryson'`) are Mixed-case. The primitive's `'label'` column kind reads `row.code` as-is — no `toUpperCase()` call (lines 122–128; contrast with `score-bug` primitive's hard-uppercase on `countryCode`). Mixed-case surnames render as supplied.
- **Distinct numeral design substitution** — Inter 600 numerals are the v1 render typeface; CBS Sports custom's bespoke numeral geometry is NOT preserved. Cosmetic divergence — same posture as T-333 / T-334 / T-335 / T-337 (see Rules §cbs-custom).
- **No italic, no underline, no strikethrough.** Masters broadcast graphics never use them.

## Animation

- **Steady-state register only in v1.** The `standings-table` primitive renders a **static layout post-entrance** (5 rows fully settled by ~frame 22 at 30fps with `staggerMs: 80`). The reference frame for the parity golden is steady-state mid-round at frame 60.
- **400 ms position-change row-slide deferred** (stub line 38 — "Position changes: smooth row-slide, 400 ms ease-in-out"). The primitive renders a steady-state layout post-entrance — there is NO frame-driven row-position-swap choreography. Candidate `T-357b`-family carve-out IF Reviewer scrutiny demands; primitive-level concern (frame-driven row reordering with positional interpolation between former and current rank rows). NOT a T-338 fix.
- **250 ms birdie/eagle red-pulse + position callout deferred** (stub line 39 — "flash highlight (red pulse, 250 ms) + brief position callout"). The primitive renders a static layout — no per-row pulse on score-change. Candidate `T-357b`-family carve-out IF Reviewer demands. NOT a T-338 fix.
- **600 ms score-change physics-eased count-up deferred** (stub line 40 — "physics-eased tick through intermediate values, 600 ms"). The primitive renders score values statically; no frame-driven numeric interpolation between values. Candidate `T-357b`-family carve-out IF Reviewer demands. NOT a T-338 fix.
- **Full-screen leaderboard scroll deferred** (stub line 41 — "scrolls during commercial-break transitions"). Scroll variant requires an additional render mode on the primitive. Candidate `T-338a` carve-out IF Reviewer demands; out of envelope. v1 ships the compact upper-right register only. NOT a T-338 fix.
- **Steady-state mid-round at frame 60.** The standings-table primitive's entrance stagger settles by ~frame 22; any post-mount frame after that produces an identical render. Cluster-norm consistency (T-333 / T-334 / T-335 / T-337 / T-323 / T-325 / T-326 / T-327 / T-328 / T-329 / T-330 / T-357 all use frame 60) AND the operator-default `--frame=60` are the deciding factors.
- **No state-transition animation in v1.** State transitions (row-slide, birdie-flash, score-count-up, scroll) belong to the live-mount surface where the data source streams updates AND to the runtime composition where the host orchestrates broadcast pacing.

## Rules

- **Bound primitive**: `standings-table` from `@stageflip/runtimes-frame-runtime-bridge` (`packages/runtimes/frame-runtime-bridge/src/clips/standings-table.tsx`, exported as `StandingsTable`; primitive `kind: 'standings-table'` kebab-case). T-338 wires the binding via `PRESET_ID_BINDINGS['masters-red-under-par']` (Pattern C — n-th-preset-for-clipKind via the override path, NOT clipKind-default). The `'standings'` arm in `DEFAULT_CLIP_KIND_RESOLVER` stays UNCHANGED at `standingsBinding` (T-357); T-333 / T-334 / T-335 / T-337 / T-339a's prior overrides stay UNCHANGED. Composing tools should mount `StandingsTable` with the snapshot per `MASTERS_PROPS` and the resolver's `buildProps` defaults.
- **`standings-table` primitive, NOT a Masters-specific clip** — the load-bearing UX render is the dark base + Augusta-green-rank-column + 5-row top-5 leaderboard with rank + label + score + thru columns. T-338 inherits the primitive verbatim from T-357a; no carve-out in T-338.
- **Restraint is the signature** (stub line 45 — "Augusta National green is accent only, never full-fill; the tournament's visual identity is restrained"). The dark broadcast base + Augusta-green-rank-column-tint + 5-row leaderboard IS the load-bearing UX render in v1; flipping to a Augusta-green-fill or larger panel defeats the brand signal AND the heritage citation. Do NOT override `background` to `'#006747'`.
- **The red/black/green color semantic is UNIVERSAL golf canon** (stub line 44 — "originated CBS 1950s. Do not re-theme. Even color-blind-safe alternatives should keep RED meaning under par"). T-338 v1 cannot render this canon per-cell (see §canonical-color); the rule is preserved at the documentation level for the canonical Masters identity.
- **§canonical-color — per-cell red/black/green canonical color rule N/A in v1** (D-T338-10 / D-T338-11-a). The primitive's `column.color` is single-color-per-column; per-row VALUE-derived color (RED for negative-to-par values, BLACK for positive, GREEN for even — CBS / Chirkinian canon) is NOT natively expressible. v1 ships the score column with default `#FFFFFF` foreground (monochrome white). The canonical color rule is the most distinctive single brand signal Masters carries, so the divergence is highly visible — but per cluster-norm primitive-fit posture, T-338 inherits the divergence rather than re-carving the primitive. Carving out per-cell-value-derived color is `T-357c`-family — extend `standingsTableColumnSchema` with `colorRule: 'score-to-par' | 'fixed'` semantic, or extend `standingsTableRowSchema` with `colorOverrides?: Record<columnKey, hex>` map. NOT a T-338 fix.
- **§numeric-encoding — score-to-par + thru-hole render as integers** (D-T338-11-b). Stub line 35 calls for the column to read `-4`, `E`, `+2`; canonical golf renders `E` for even par, `+2` with leading `+`, `F` for finished. The `standings-table` primitive's `'numeric'` column kind reads `row.values[]` as `number` (line 26 — `z.array(z.number())`); strings are rejected by the schema. v1 inherits the divergence — numeric encoding only:
  - `E` (even par) renders as `0`.
  - Positive scores render without leading `+` (e.g., `+2` → `2`).
  - `F` (finished, hole 18) renders as `18`.
  - Carving out string-supporting numeric kind is `T-357b`-family. NOT a T-338 fix.
- **§accent-strip — visible Augusta-green left-edge accent strip NOT natively renderable** (D-T338-11-d). Stub line 24 calls for "applied as accent strip, not full fill"; the `standings-table` primitive does not expose an `accentStrip: { side, color, width }` slot. v1 wires `goldColor: '#006747'` (theme-slot mapping to `palette.accent`) AND `column.color: '#006747'` on the rank column — partial register at best. The visible left-edge accent strip register is NOT renderable. Carving out a primitive-level accent-strip slot is `T-357b`-family. NOT a T-338 fix.
- **§cbs-custom — CBS Sports custom preserved by the proprietary path only** (D-T338-11-c). The OFL fallback Inter 600 does NOT preserve the bespoke CBS-Sports-DNA letter shapes. Cosmetic divergence; the `proprietary-byo` path is the user's escape hatch when they license CBS Sports custom locally. Same posture as T-333 D-T333-11-b / T-334 D-T334-11-c / T-335 D-T335-11-d / T-337 D-T337-11-c.
- **§row-slide — position-change row-slide animation deferred** (D-T338-11-e). Stub line 38 calls for "smooth row-slide, 400 ms ease-in-out". The primitive renders a steady-state layout post-entrance; no frame-driven row-position-swap. Carving out is `T-357b`-family. NOT a T-338 fix.
- **§birdie-flash — birdie/eagle red-pulse deferred** (D-T338-11-e). Stub line 39 calls for "flash highlight (red pulse, 250 ms) + brief position callout". Static layout; no per-row pulse. Carving out is `T-357b`-family. NOT a T-338 fix.
- **§score-count-up — physics-eased score count-up deferred** (D-T338-11-e). Stub line 40 calls for "physics-eased tick through intermediate values, 600 ms". Static layout; no frame-driven numeric interpolation. Carving out is `T-357b`-family. NOT a T-338 fix.
- **§full-screen-scroll — full-screen leaderboard scroll variant deferred** (D-T338-11-e). Stub line 41 calls for scrolling during commercial-break transitions (Augusta's 4-minute-per-hour commercial constraint). Out of envelope; v1 ships the compact register only. Carving out is `T-338a`. NOT a T-338 fix.
- **§font-position — `font` + `position` props omitted from resolver snapshot** (D-T338-13). The `standings-table` primitive's `propsSchema` does NOT carry `font` or `position` props. The font posture is FontManager-applied per the primitive's TSDoc; the position is host-scaffold-determined per `bandPosition`. v1 declares the preset font in frontmatter (`preferredFont: CBS Sports custom` + `fallbackFont: Inter 600`) and supplies `bandPosition: 'overlay'`; conceptual upper-right anchor is documented at the spec level only.
- **§code-misnomer — `row.code` field used for player surname, not ISO code** (D-T338-13). The `standingsTableRowSchema.code` field is named for the Olympic ISO 3-letter use case but T-338 reuses it for golf player surnames (Mixed-case strings up to ~15 chars). The primitive's `'label'` column kind reads `row.code` and renders left-align without case modification — Mixed-case surnames render as supplied. The field-name mismatch is cosmetic; semantic intent is "label string for the row".
- **2025 Masters register**: Scheffler / McIlroy / Schauffele / Spieth / Bryson is one canonical mid-round top-5 — illustrative of the brand register; cluster owners rebrand at compose time with the actual tournament leaderboard. The shape (5 rows + rank + Mixed-case surname + score-to-par + thru-hole + Augusta-green-rank-tint + dark base) IS the load-bearing identity.
- **Reference frame for parity is steady-state at frame 60** per ADR-004 §D5 — single canonical variant. The standings-table primitive is a static layout post-entrance so any post-mount frame after ~frame 22 produces an identical render.

## Acceptance (parity)

One reference-frame fixture at `frame: 60` (steady-state mid-round per ADR-004 §D5):

- `golden-frame-60.png` — the canonical Masters red-under-par leaderboard rendered as a 5-row ranked panel on a `#0E0E12` dark base; rank column carries an Augusta green `#006747` color tint; player surnames render Mixed-case (`Scheffler` / `McIlroy` / `Schauffele` / `Spieth` / `Bryson`) left-aligned weight 600 in the PLAYER column; score-to-par values render as integers (`-12 / -10 / -8 / 0 / 2` — no leading `+`, `0` instead of `E`, per §numeric-encoding); thru-hole values render as integers (`18 / 17 / 18 / 18 / 15` — `18` instead of `F`); white `#FFFFFF` text on score and thru columns (per-cell red/black/green NOT applied per §canonical-color); tabular-numeric alignment on rank / score / thru columns; header row reads `# PLAYER TO PAR THRU` (capitalized labels; right-aligned numerics, left-aligned label); 5 rows fully settled at frame 60 (no entrance animation visible). Augusta green appears ONLY on the rank column (per §accent-strip — accent-strip register not natively renderable). Inter 600 numerals are the v1 render typeface (CBS Sports custom not rendered per §cbs-custom).

Thresholds: **PSNR ≥ 42 dB**, **SSIM ≥ 0.98** (matches the cross-cluster norm used by T-333 / T-334 / T-335 / T-337 / T-339a / T-323 / T-325 / T-326 / T-327 / T-328 / T-329 / T-330 / T-355 / T-358 / T-359 / T-360 / T-356 / T-357 / T-362 / T-363 / T-364 / T-365 / T-366 / T-367 / T-350). Hand-pinned via the F-4 generator-flag route `--psnr=42 --ssim=0.98 --mark-signed` (NO manual `thresholds.json` edit per D-T338-7). The static 5-row table with dark base + white text + per-column color tints (Augusta green on rank column) + tabular-numeric score / thru / rank columns is aliasing-comparable to T-357's olympic medal-table register (less aliasing than T-356's scrolling chyron).

**Sign-off (T-338 D-T338-8, in-PR — Pattern D):** the canonical steady-state golden is committed at `parity-fixtures/sports/masters-red-under-par/` with the single-variant manifest shape. Frontmatter `signOff.parityFixture` is `signed:<UTC date>` after running `scripts/generate-preset-parity-fixture-prod.ts --preset=masters-red-under-par --frame=60 --psnr=42 --ssim=0.98 --mark-signed`. The golden was rendered locally via the puppeteer/CDP-bound prod renderer; the `standings` clipKind binds to `standings-table` for the `masters-red-under-par` preset id via `PRESET_ID_BINDINGS['masters-red-under-par']` per the v1 resolver. Re-render + re-sign with `--force` is the operator's path if the canonical snapshot changes or the FontManager's preload list updates the rendered Inter 600 weights. **`signOff.typeDesign` STAYS `pending-cluster-batch`** — the cluster-B type-design batch review (cluster-composer task) flips this field across all nine Cluster B presets in one downstream PR; T-338's merge brings Cluster B to **6/9 substantive + signed** (NOT YET ELIGIBLE for batch merge).

## References

- `docs/compass_artifact.md` § The Masters leaderboard — canonical visual source (note: on-disk path mismatch flagged for resolution; integrity invariant 7 SKIPped globally per cluster norm).
- `skills/stageflip/presets/data/olympic-medal-tracker.md` — sister preset (T-357; first `standings`-clipKind preset; clipKind-default at `standingsBinding`); T-338 reuses the same `standings-table` primitive with golf-themed snapshot constants. The decision-letter naming, AC grouping, in-PR sign-off section, and snapshot-constant approach mirror T-357 verbatim.
- `skills/stageflip/presets/sports/wimbledon-green-purple.md` — sister Cluster B preset (T-337; fifth Cluster B preset; bound via `PRESET_ID_BINDINGS` override on `scoreBug` clipKind — direct Pattern C template). T-338 mirrors T-337's `PRESET_ID_BINDINGS` override mechanics + sign-off cadence + commit shape verbatim, swapping the clipKind from `scoreBug` to `standings` AND the bound primitive from `score-bug` to `standings-table`.
- `skills/stageflip/presets/sports/{premier-league-field-of-play,fox-nfl-no-chrome,nbc-snf-possession-illuminated,espn-bottomline-flipper}.md` — sister Cluster B presets (T-333 / T-334 / T-335 / T-339a; first / second / third / fourth Cluster B presets); supplemental templates for the Cluster B sign-off cadence + cluster-norm typography posture. T-338 inherits the `proprietary-byo → ofl-fallback` shape.
- `skills/stageflip/presets/sports/SKILL.md` — Cluster B SKILL (locked per spec; owned by the cluster-B composer task).
- `skills/stageflip/presets/sports/{f1-timing-tower,cricket-scorebug,uefa-starball-refraction}.md` — sister Cluster B stubs not yet promoted; each has its own preset PR.
- `packages/runtimes/frame-runtime-bridge/src/clips/standings-table.tsx` — the bound primitive (`StandingsTable`); shipped by T-357a. **Second production consumer (after T-357 olympic-medal-tracker)**: T-338 masters-red-under-par. **First production consumer of the `'label'` column kind reading non-ISO-code Mixed-case strings (player surnames)**: T-338.
- `packages/parity-cli/src/generate-fixture.ts` — v1 resolver mapping `standings` → `standings-table` clipKind-default (T-357 standingsBinding) + per-preset `PRESET_ID_BINDINGS` overrides (T-338 masters-red-under-par → `mastersRedUnderParBinding`, golf-leaderboard consumer) + exported `MASTERS_PROPS` constant (D-T338-4).
- "The red/black/green color semantic is UNIVERSAL golf canon (originated CBS 1950s). Do not re-theme. Even color-blind-safe alternatives should keep RED meaning under par." (stub line 44) — heritage citation; preserve register faithfully even though v1 cannot render the per-cell color rule (§canonical-color).
- "Restraint is the signature." Augusta National green is accent only, never full-fill (stub line 45) — heritage citation.
- Color canon invented by CBS producer Frank Chirkinian (1950s).
- ADR-004 (preset system contract — frontmatter, loader, validator, parity sign-off, integrity invariants).
- ADR-005 (frontier clip catalogue — standings posture).
