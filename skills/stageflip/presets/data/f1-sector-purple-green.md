---
id: f1-sector-purple-green
cluster: data
clipKind: bigNumber
source: docs/compass_artifact.md#formula-1
status: substantive
preferredFont:
  family: Formula1 Display
  license: proprietary-byo
fallbackFont:
  family: Barlow Condensed
  weight: 600
  license: ofl
permissions: []
# parityFixture is `pending-user-review` (a non-blocking WARN per
# `checkParityFixtureSignOff` in `scripts/check-preset-integrity.ts`). The
# T-313 generator currently supports a single canonical mid-hold reference
# frame per preset; this preset requires three (one per state:
# sessionBest / personalBest / neutral) per D-T359-5. Sign-off is deferred
# to T-359a (separate task spec) which extends the T-313 generator with
# multi-variant manifest support and binds a working productionRenderer.
signOff:
  parityFixture: pending-user-review
  typeDesign: na
---

# F1 Sector Purple/Green — sector-time delta callout

The Formula 1 broadcast convention for a single sector callout: a driver's most recent sector time, rendered as a large central number, where the **color of the number is the message** — purple if it is the session-best, green if it is the driver's personal-best, otherwise neutral / yellow. Standalone callout (not the full timing tower; that is `f1-timing-tower` in cluster B). The data path is hard-coded: the preset takes a `state` prop ∈ `{ sessionBest, personalBest, neutral }`. Live binding to a `LiveDataClip` source is deferred to T-355–T-357.

## Visual tokens

The state palette is universal F1 broadcast shorthand. Every visible viewer of an F1 race recognizes it; do not re-theme it for any tenant.

- **`sessionBest` → purple `#6F2E9E`.** The driver's most recent sector is the fastest anyone has run that sector during the session. Strongest of the three states.
- **`personalBest` → green `#00B54A`.** The driver beat their own previous time on this sector but did not beat the session leader. Mid-strength.
- **`neutral` → yellow `#F0C800`.** The driver's most recent sector is slower than their personal best for that sector. Default state. Yellow (rather than white or grey) because F1 viewers parse it as "no improvement" rather than "no signal".

Layout (16:9 default; 9:16 vertical inverts left/right but keeps top/bottom):

- **Number** centered horizontally and vertically. Number height = `min(canvas.height * 0.55, canvas.width * 0.40)`. The number IS the composition.
- **Driver code** (3 letters, uppercase) anchored top-left, ~6% inset from each edge. Height ~12% of canvas height.
- **Sector label** (`S1` / `S2` / `S3`) anchored top-right, ~6% inset from each edge. Same height as driver code.
- **Background** transparent by default, allowing the host composition to slot the callout over a dark gradient or the broadcast feed. When rendered standalone (e.g., for parity fixtures), use `#0E0E12` (near-black; matches the F1 broadcast graphics base).

The number, the driver code, and the sector label all share the same color in a given state — the color is the message, applied uniformly to all three glyph runs. Do NOT keep the labels white while only coloring the number; the broadcast convention colors all foreground text.

## Typography

- **`preferredFont: Formula1 Display`**, weight `700` for the number, weight `600` for the driver code and sector label. Formula1 Display is the proprietary F1 brand face (BYO at the tenant level per the font-license registry; see ADR-004 §D3).
- **`fallbackFont: Barlow Condensed`**, weight `600`, OFL. Substituted automatically by the FontManager (T-072) on every rendering medium where Formula1 Display is not BYO-cleared. Barlow Condensed shares Formula1 Display's narrow proportions and engineered geometry — visually closest of the OFL options.
- **Tabular numerals are mandatory** (`font-variant-numeric: tabular-nums`). The F1 sector time changes as the value flips through digits during the count-up; non-tabular numerals would visibly wobble. This is also a cluster-E convention (see `skills/stageflip/presets/data/SKILL.md` § Cluster conventions).
- **No italic, no underline, no strikethrough.** F1 broadcast graphics never use them.

## Animation

- **Number count-up** uses `AnimatedValue`'s default spring (`damping: 15, mass: 0.8, stiffness: 120`) over the first ~24 frames @ 30fps. Final value is the sector time formatted to three decimals (see `## Rules`). The starting value is `0` — the count-up runs the full sweep so the viewer sees the digits land. (For a future LiveData binding where the previous value is known, a baseline-relative count-up is the right call; that decision belongs to T-355.)
- **Driver code + sector label fade-in** over the same ~24-frame window, linear opacity `0 → 1`. They settle to their final position; no slide.
- **No state-transition animation in v1.** The state is a prop, not a stream. The preset renders one of the three states for the entire composition. State-transition animation (purple flash on session-best landing) belongs to T-355 (LiveData binding) where the data source actually changes the state mid-composition.
- **Mid-hold steady-state at frame 60** (per ADR-004 §D5). Parity fixtures snapshot at this frame.

## Rules

- **Bound primitive**: `animated-value` from `@stageflip/runtimes-frame-runtime-bridge` (`packages/runtimes/frame-runtime-bridge/src/clips/animated-value.tsx`, exported as `AnimatedValue` + `animatedValueClip`). The `bigNumber` `clipKind` is an integrity-gate sentinel today (in `VALID_CLIP_KINDS` in `scripts/check-preset-integrity.ts`); the formal `clipKind: bigNumber` → runtime-clip dispatcher does not exist yet (Phase 13/14 follow-up tracked separately). This prose binding IS the contract until the dispatcher lands. Composing tools should mount `AnimatedValue` with `value = parseFloat(sectorTime)`, `decimals = 3`, `color = stateColor(state)`, `fontSize = numberSize`, `fontWeight = 700`.
- **State → color** is universal F1 shorthand and does NOT take a tenant theme override. `sessionBest` → `#6F2E9E`, `personalBest` → `#00B54A`, `neutral` → `#F0C800`. Any tenant request to re-color is an escalation per CLAUDE.md §6.
- **Time is always truncated, never rounded.** `21.412` not `21.41`, `78.999` not `79.000`. Truncation matches the F1 race-control feed and viewers' expectation. Compose-layer code: drop trailing digits past the third decimal; do not round.
- **Driver code is uppercase 3-letter** (`VER`, `HAM`, `LEC`). Two-letter codes do not exist in F1; longer abbreviations are not used in broadcast graphics.
- **Sector label is `S1`, `S2`, or `S3`** — never `Sector 1`, never `1`, never `T1`/`T2`/`T3` (those are turn labels, not sector labels). The capital S is mandatory.
- **No live data in v1.** The `permissions` array is empty; no network call, no telemetry source. The future T-355 LiveData wrap declares `network`; this preset does not.
- **Reference frame for parity is mid-hold (frame 60)** per ADR-004 §D5. The PSNR / SSIM thresholds are stricter than the script default (`35 / 0.95`) because text-heavy big-number content tolerates tighter thresholds — see Acceptance below.

## Acceptance (parity)

Three reference-frame fixtures, one per state, all at `frame: 60` (mid-hold steady-state per ADR-004 §D5):

- `golden-frame-60-sessionBest.png` — purple `#6F2E9E` number, driver code, sector label.
- `golden-frame-60-personalBest.png` — green `#00B54A`.
- `golden-frame-60-neutral.png` — yellow `#F0C800`.

Thresholds: **PSNR ≥ 42 dB**, **SSIM ≥ 0.98** (stricter than the generator default `35 / 0.95`; mirrors the `f1-timing-tower` sister preset's pin in cluster B).

**Sign-off carve-out (T-359):** the parity-fixture generator at `scripts/generate-preset-parity-fixture.ts` (T-313) currently supports a single canonical mid-hold reference frame per preset and does not bind a working `productionRenderer` for this preset's `clipKind`. T-359 ships markdown-only; `signOff.parityFixture` stays at `pending-user-review` (a non-blocking WARN per `checkParityFixtureSignOff`). The three goldens land in a follow-up task spec (T-359a) that extends the generator with multi-variant manifest support + the `clipKind: bigNumber` → renderer wiring. AC #7, #8, #9, #10 from the T-359 spec are deferred to that task.

## References

- `docs/compass_artifact.md` § Formula 1, § Dynamic sports results — canonical visual source (note: on-disk path mismatch flagged for resolution; see PR follow-ups).
- `skills/stageflip/presets/sports/f1-timing-tower.md` — sister F1 preset (cluster B); the canonical timing tower of which this preset is the standalone-callout annex.
- `skills/stageflip/presets/data/big-number-stat-impact.md` — sister bigNumber preset (cluster E); same primitive, different visual register.
- `skills/stageflip/presets/data/SKILL.md` — cluster E conventions (tabular numerals mandatory, count-ups slow the viewer down, etc.).
- `packages/runtimes/frame-runtime-bridge/src/clips/animated-value.tsx` — the bound primitive (`AnimatedValue`, `animatedValueClip`).
- ADR-004 (preset system contract — frontmatter, loader, validator, parity sign-off, integrity invariants).
- ADR-005 (LiveData posture — relevant for the deferred T-355 binding, NOT for T-359).
