---
id: big-number-stat-impact
cluster: data
clipKind: bigNumber
source: docs/compass_artifact.md#api-37-big-number-stat
status: stub
preferredFont:
  family: Inter Display
  license: ofl
fallbackFont:
  family: Inter Display
  weight: 800
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: na
---

# Big Number Stat Impact — count-up callout

## Visual tokens
- Large statistic centered or anchored to a layout slot
- Number scaled to fill 60–80% of the layout slot's height
- Optional prefix (`$`, `+`) and suffix (`%`, `M`, `K`) — smaller than the main number
- Optional context label below or above the number
- Brand-flexible color: defaults to high-contrast (white on dark or dark on light); accepts `accentColor` per compose

## Typography
- Number: Inter Display, ExtraBold / Black, very large (sized by the layout slot, not absolute)
- Prefix / suffix: Inter Display, ExtraBold, ~50–60% of number size
- Label: Regular, 18–24 pt, Mixed Case

## Animation
- Count-up: starts from `animateFrom` (default 0, configurable for delta-from-baseline cases) → target value
- Curve: physics-eased — fast at start, decelerating to target. Total duration 1.2–1.8 s based on magnitude of delta.
- Final-arrival pulse: brief 1.0 → 1.05 → 1.0 scale, 250 ms (the "impact" beat)
- Optional comparison frame after settle: slides in a "vs. last quarter" or similar comparison

## Rules
- Don't start from zero if the actual baseline is non-zero — start from the baseline. (Compass canon: count-ups are reading aids, not animations for their own sake.)
- Format the number at the compose layer (`$3.2M` not `3200000`). Don't leave formatting to the renderer.
- Locale-aware separators: `1,234.56` (US) vs. `1.234,56` (DE) — preset takes `locale` input.
- Use Inter Display for fallback; it's wide enough at heavy weights to carry impact and is OFL-licensed.
- Pulse on arrival is mandatory; without it the count-up feels incomplete.

## Acceptance (parity)
- Reference frames: 0 (start at baseline), 24 (mid-count, ~50% progress), 36 (just-arrived, pre-pulse), 48 (post-pulse settled)
- PSNR ≥ 44 dB, SSIM ≥ 0.99

## References
- `docs/compass_artifact.md` § Big Number Stat
- Used as the count-up primitive across cluster E (Magic Wall, Olympic medals, election counts)
- ADR-004
