---
id: big-number-stat-impact
cluster: data
clipKind: bigNumber
source: docs/compass_artifact.md#api-37-big-number-stat
status: substantive
preferredFont:
  family: Inter Display
  license: ofl
fallbackFont:
  family: Inter Display
  weight: 800
  license: ofl
permissions: []
signOff:
  parityFixture: 'signed:2026-05-04'
  typeDesign: na
---

# Big Number Stat Impact — count-up callout

The universal "stat impact reveal" broadcast convention: a large central number with a count-up animation that drives narrative emphasis at the terminal value. Common uses cover post-game stats ("3,847 yards passing"), survey results ("87% of Americans"), election totals ("12.4M votes"), and benchmark numbers ("0.91s response time"). The preset's stylistic point is the **count-up + settle** beat — the underdamped spring's natural overshoot at the terminal value reads as the "impact" without any added scale-pulse (D-T360-4).

This preset is the **second `bigNumber`-clipKind preset to land** in cluster E (after `f1-sector-purple-green`); it shares the `bigNumber → animated-value` runtime binding wired by T-359a but parameterizes the primitive differently (different `value`, `decimals`, `suffix`, heavier `fontWeight`). Sister cluster-E preset `cricket-ball-by-ball-dots` covers the per-over chip-row register; sister `f1-sector-purple-green` covers the state-palette swap register. Live binding to a `LiveDataClip` source is deferred to T-355–T-357.

## Visual tokens

The number IS the composition. Layout (16:9 default; 9:16 vertical inverts left/right but keeps top/bottom):

- **Number** centered horizontally and vertically. Number height = `min(canvas.height * 0.55, canvas.width * 0.40)` — scaled so a four-character payload (`87.4%`) fills 60–80% of the layout slot's height. The number IS the composition.
- **Optional prefix** (`$`, `+`, `−`) and **optional suffix** (`%`, `M`, `K`, `s`) — the `animated-value` primitive renders these inline as smaller (~50–60% of number size) leading/trailing glyphs. The mid-hold parity fixture exercises the suffix path with `%`.
- **Optional context label** below or above the number ("of Americans", "yards passing"). The label is a composition-layer concern in v1; the bound `animated-value` primitive does not render it. Cluster owners slot the label at compose time.
- **Background** is `#0E0E12` (near-black; matches the broadcast graphics base used by `f1-sector-purple-green` and `cricket-ball-by-ball-dots`). Standalone goldens snapshot against this; embedded compositions can override at the host level.
- **Foreground** defaults to high-contrast white (`#FFFFFF`) for the v1 parity fixture. Tenants override at composition time via the `color` prop on `animated-value` — the preset does NOT pin a brand color (contrast with `f1-sector-purple-green`'s state-mapped palette, which IS the message).

The number's color is the only paintable theme slot in v1 (mapped to the `palette.foreground` role declared by `animatedValueClip`); no accent slot, no flash overlay (D-T360-4 / D-T360-10).

## Typography

- **`preferredFont: Inter Display`** (OFL), weight `800` for the number. Inter Display's heavy-weight register carries the broadcast "impact" without licensing friction. License-clean across every rendering medium (no BYO posture; no per-tenant font shopping).
- **`fallbackFont: Inter Display`** (OFL), weight `800`. Identical to the preferred face — the preset has no BYO escape hatch because the OFL face is itself the canonical pick. Mirrors the cluster-E "good-enough not broadcast-exact" posture (the tighter the register, the less room for fallback drift).
- **Tabular numerals are mandatory** (`font-variant-numeric: tabular-nums`). The `animated-value` primitive sets this on its `<span>` style; the count-up flips through digit positions during the entrance window, and non-tabular numerals would visibly wobble. Cluster-E convention; documented in `skills/stageflip/presets/data/SKILL.md`.
- **Prefix / suffix glyphs** render in the same Inter Display 800 face at the same `fontSize` (the `animated-value` primitive does not currently expose a per-affix size scale; the broadcast convention is sized parity at this register and the visible difference is small at the heavy-weight). A future per-affix size knob is a follow-up if a Reviewer demands broadcast-exact fidelity.
- **No italic, no underline, no strikethrough.** Stat impact callouts never use them.

## Animation

- **Number count-up** uses `animated-value`'s default spring (`damping: 15, mass: 0.8, stiffness: 120`) over the standard entrance fraction (~60% of clip duration). The starting value is `0` — the count-up runs the full sweep so the viewer sees the digits land. Final value is `87.4` formatted with `decimals: 1` and `suffix: '%'`.
- **Settle (the "impact" beat).** The underdamped spring's natural overshoot at the terminal value IS the impact beat (D-T360-4). The damping ratio (15 with mass 0.8 + stiffness 120) produces a small overshoot that reads as the broadcast-canon "punch" without any added CSS scale-pulse. **No 1.0 → 1.05 → 1.0 scale transform is rendered in v1** — the original stub's prose pinned a CSS pulse, but `animated-value` does not expose a scale-pulse knob and adding one is out of M-size envelope. A `pulseOnSettle` prop on `animated-value` is a flagged follow-up if a Reviewer demands broadcast-exact fidelity beyond the spring's natural settle.
- **Hold ~30 frames** at the terminal value once the spring settles (mirrors T-406's chart-family hold), then idle. The viewer's eye lands on the resolved number; no further visual work in v1.
- **No state-transition animation in v1.** The state is a single value, not a sequence. The future T-355 LiveData wrap streams new values; this preset renders one terminal value for the whole composition.
- **Mid-hold steady-state at frame 60** (per ADR-004 §D5). The parity fixture snapshots at this frame — count-up resolved, spring overshoot settled, sitting in the hold window.

## Rules

- **Bound primitive**: `animated-value` from `@stageflip/runtimes-frame-runtime-bridge` (`packages/runtimes/frame-runtime-bridge/src/clips/animated-value.tsx`, exported as `AnimatedValue` + `animatedValueClip`). The `bigNumber` `clipKind` is an integrity-gate sentinel today (in `VALID_CLIP_KINDS` in `scripts/check-preset-integrity.ts`); the v1 resolver in `packages/parity-cli/src/generate-fixture.ts` maps `(clipKind: 'bigNumber', presetId: 'big-number-stat-impact') → animated-value` via the per-preset override added by T-360 D-T360-2. The same clipKind also maps to `animated-value` for `f1-sector-purple-green` via the clipKind-only fall-through; the two presets parameterize the primitive differently. Composing tools should mount `AnimatedValue` with `value = 87.4`, `decimals = 1`, `suffix = '%'`, `fontSize = 360`, `fontWeight = 800`.
- **Never start the count-up from zero if the actual baseline is non-zero.** Start from the baseline. (Compass canon: count-ups are reading aids, not animations for their own sake.) The v1 parity fixture starts from `0` because the baseline of `87.4%` IS conceptually `0` (no respondents have been counted). For "swing from 78% to 87.4%" cases, compose-layer code would set `animateFrom: 78` (a flagged follow-up; `animated-value` exposes `delay`, not `animateFrom`, in v1).
- **Format the number at the compose layer** (`$3.2M` not `3200000`). The `animated-value` primitive renders the raw `value * progress` formatted with `decimals` — locale separators are a `toLocaleString` call away when `decimals === 0`. Tenants doing locale-aware separators (`1,234.56` US vs. `1.234,56` DE) compose the numeric format outside the bound primitive and pass the resulting payload as the suffix or as a wrapping label.
- **Theme slot mapping**: `color` (number foreground) maps to `palette.foreground` per `animatedValueClip.themeSlots`. Background is a composition-layer concern (the v1 parity fixture renders against `#0E0E12`). No accent slot in v1 (no flash overlay per D-T360-4). Mirrors `f1-sector-purple-green`'s foreground-only mapping.
- **Concrete parity value `87.4%`.** The mid-hold parity fixture renders `87.4%` (decimals: 1, suffix: '%'). Familiar poll/approval/penetration shape; Reviewer eyeballs without context. Cluster owners rebrand at compose time — the preset's contract is the **shape** (large heavy-weight numeric centerpiece + suffix unit + count-up + settle), not the literal value.
- **No live data in v1.** The `permissions` array is empty; no network call, no telemetry source. The future T-355 LiveData wrap declares `network`; this preset does not.
- **Reference frame for parity is mid-hold (frame 60)** per ADR-004 §D5. The PSNR / SSIM thresholds are stricter than the script default (`35 / 0.95`) because text-heavy big-number content tolerates tighter thresholds — see Acceptance below.

## Acceptance (parity)

One reference-frame fixture at `frame: 60` (mid-hold steady-state per ADR-004 §D5):

- `golden-frame-60.png` — `87.4%` rendered at heavy-weight Inter Display 800, foreground white-on-`#0E0E12`. The count-up has resolved and the spring's underdamped overshoot has settled; the number sits in the hold window.

Thresholds: **PSNR ≥ 42 dB**, **SSIM ≥ 0.98** (stricter than the generator default `35 / 0.95`; mirrors the `f1-sector-purple-green` and `cricket-ball-by-ball-dots` sister presets in cluster E). The stub's previous `44 / 0.99` target was revised down per T-360 D-T360-7 to match the cluster-E norm; the preset-driven-thresholds follow-up flagged during T-359b is the formal mechanism for per-preset deviation.

**Sign-off (T-360 D-T360-6, in-PR):** the canonical mid-hold golden is committed at `parity-fixtures/data/big-number-stat-impact/` with the single-variant manifest shape (no `variants` key, per T-359a backward compat). Frontmatter `signOff.parityFixture` is `signed:2026-05-04`. The golden was rendered locally via `scripts/generate-preset-parity-fixture-prod.ts` (the puppeteer/CDP-bound prod renderer); the `(bigNumber, big-number-stat-impact)` resolver tuple binds to `animated-value` per the T-360 per-preset override added to `packages/parity-cli/src/generate-fixture.ts`. Re-render + re-sign with `--force` is the operator's path if the parity value changes or the FontManager's preload list updates the rendered Inter Display weight.

## References

- `docs/compass_artifact.md` § Big Number Stat — canonical visual source (note: on-disk path mismatch flagged for resolution; integrity invariant 7 SKIPped globally).
- `skills/stageflip/presets/data/f1-sector-purple-green.md` — sister cluster-E preset; same `bigNumber` clipKind, state-palette-swap register.
- `skills/stageflip/presets/data/cricket-ball-by-ball-dots.md` — sister cluster-E preset; per-over chip-row register.
- `skills/stageflip/presets/data/SKILL.md` — cluster E conventions (tabular numerals mandatory, count-ups slow the viewer down, etc.).
- `packages/runtimes/frame-runtime-bridge/src/clips/animated-value.tsx` — the bound primitive (`AnimatedValue`, `animatedValueClip`).
- `packages/parity-cli/src/generate-fixture.ts` — v1 resolver mapping `(bigNumber, big-number-stat-impact) → animated-value` via the per-preset override (T-360 D-T360-2).
- ADR-004 (preset system contract — frontmatter, loader, validator, parity sign-off, integrity invariants).
- ADR-005 (LiveData posture — relevant for the deferred T-355 binding, NOT for T-360).
