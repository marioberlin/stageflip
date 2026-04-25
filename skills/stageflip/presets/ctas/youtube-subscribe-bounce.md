---
id: youtube-subscribe-bounce
cluster: ctas
clipKind: subscribeButton
source: docs/compass_artifact.md#youtube-subscribe-button-animation
status: stub
preferredFont:
  family: Roboto
  license: apache-2.0
fallbackFont:
  family: Roboto
  weight: 500
  license: apache-2.0
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# YouTube Subscribe Bounce — native CTA

## Visual tokens
- Rounded pill button matching YouTube's native UI (border-radius: 8 px @ 1080p)
- YouTube Red `#FF0000`
- Text: white `#FFFFFF`, "SUBSCRIBE"
- After "click": gray `#AAAAAA` background with "SUBSCRIBED"
- Bell icon (white) appears post-subscribe
- Animated mouse cursor
- Position: lower-right or lower-left, ~15–20% of screen width
- Subtle drop shadow (0 / 4 px / 8 px blur, 20% opacity black)

## Typography
- Roboto Medium (500), 18 px native size — scales with screen
- "SUBSCRIBE" / "SUBSCRIBED": ALL CAPS
- Native YouTube UI canon — no other type choice

## Animation
- Entry: scale 0% → 100% with bounce overshoot to 110%, 400–600 ms
- Animated cursor slides in (~600 ms), hovers, "clicks" the button (red → gray transition, 250 ms)
- Bell icon: clicked, wiggles 2–3 times (rotation ±15° over 350 ms)
- Total sequence: 3–6 s
- Exit: fades out or slides down, 300 ms
- Recommended placement: 10–15 s into video

## Rules
- Mimicry of native YouTube UI is the mechanism — do NOT redesign to match brand. The familiar UI is the conversion.
- Animated cursor is the demonstration; without it, viewers don't see the action modeled. Mandatory.
- Bell-wiggle animation is part of the sequence (post-2018 canon for notifications).
- Place at 10–15 s mark; earlier feels desperate, later misses uncommitted viewers.

## Acceptance (parity)
- Reference frames: 0 (pre-entry), 12 (button settled), 36 (cursor on button), 48 (post-click gray state)
- PSNR ≥ 42 dB, SSIM ≥ 0.98

## References
- `docs/compass_artifact.md` § YouTube subscribe button animation
- Gap clip T-317 (`SubscribeButton`)
- ADR-004
