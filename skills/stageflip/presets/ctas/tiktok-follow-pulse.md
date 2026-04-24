---
id: tiktok-follow-pulse
cluster: ctas
clipKind: followPrompt
source: docs/compass_artifact.md#tiktok-follow-prompt
status: stub
preferredFont:
  family: TikTok Sans
  license: platform-byo
fallbackFont:
  family: Source Sans 3
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# TikTok Follow Pulse — right-thumb-zone CTA

## Visual tokens
- Circular avatar: 40 × 40 px native
- "+" badge in TikTok Pink/Red `#FE2C55`
- Position: right side of vertical-video frame, vertically aligned with native Like / Comment / Share icons (~70% down from top)
- Touch target: 44 px diameter (iOS / Android minimum)
- Always present on a creator's video frame (no independent entry / exit)

## Typography
- N/A — icon-only CTA
- Optional algorithmic toast text "Follow [Creator]" in Source Sans 3 fallback, 14–16 pt

## Animation
- Subtle pulse when unfollowed: scale 1.0 → 1.05 → 1.0, 1500 ms cycle, 30% opacity ring expanding
- Follow confirmation: "+" morphs to checkmark with quick scale pop (1.0 → 1.2 → 1.0, 300 ms)
- Algorithmic toast: slides up from bottom after viewing multiple videos from the same creator, 400 ms (gated by tenant data)

## Rules
- Right-thumb zone placement is non-negotiable on vertical video. 67% of mobile users scroll right-thumb (UX canon); the CTA must be reachable.
- Single tap with no confirmation. Don't add an "are you sure?" — friction kills conversion.
- Always-present, no entry — the pulse animation is the only attention mechanism.
- Algorithmic toast is opt-in per tenant; default off.

## Acceptance (parity)
- Reference frames: 0 (start of pulse), 30 (mid-pulse), 60 (end of pulse), 90 (post-follow checkmark)
- PSNR ≥ 42 dB, SSIM ≥ 0.98

## References
- `docs/compass_artifact.md` § TikTok follow prompt
- BJ Fogg behavior model: low ability + high motivation + clear trigger
- Gap clip T-318 (`FollowPrompt`)
- ADR-004
