---
id: apple-tv-lt
cluster: news
clipKind: lowerThird
source: docs/compass_artifact.md#apple-tv
status: stub
preferredFont:
  family: SF Pro
  license: proprietary-byo
fallbackFont:
  family: Inter
  weight: 300
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Apple TV+ — minimalist lower third

## Visual tokens
- Text-only; no background elements
- Optional very subtle drop shadow (0, 1 px, 2 px blur, 20% opacity black)
- Occasional thin horizontal separator line (`#FFFFFF` @ 40% opacity, 1 px, ≤ 80 px wide)
- Position: bottom-left, significant padding (130–150 px from left, 90–100 px from bottom @ 1080p)
- Follows Apple's generous-whitespace principle

## Typography
- Name: SF Pro fallback, Light / Medium, 26–30 pt, letter spacing +75–120, Mixed Case
- Title: Thin / Light, UPPERCASE, letter spacing +150–200, 18–20 pt
- Extreme precision in kerning — fallback must allow manual per-pair overrides if needed

## Animation
- Entry: refined fade-in with slight scale from 95% → 100%, 600–800 ms, ease-in-out (Apple's signature curve)
- Some shows: word-by-word reveals (opt-in per preset invocation)
- Static hold 5–7 s
- Exit: mirrors entry — fade + subtle scale down

## Rules
- Most restrained preset in the cluster. If a dark-background compose needs more, escalate; don't add one.
- Animation curve is specifically ease-in-out — not linear, not ease-out. This matches iOS/macOS system animations.
- Use this preset by default for premium / enterprise pitch decks where the content should feel "ratified by Apple."

## Acceptance (parity)
- Reference frames: 0 (pre-fade), 18 (mid-fade at 97%), 36 (settled), 150 (pre-exit)
- PSNR ≥ 42 dB, SSIM ≥ 0.98

## References
- `docs/compass_artifact.md` § Apple TV+
- Animation ease curve mirrors iOS — `cubic-bezier(0.42, 0, 0.58, 1)` approximation
- ADR-004
