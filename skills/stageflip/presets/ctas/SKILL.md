---
title: Cluster G — Calls-to-action & social
id: skills/stageflip/presets/ctas
tier: cluster
status: substantive
last_updated: 2026-04-25
owner_task: T-374
related:
  - docs/decisions/ADR-004-preset-system.md
  - skills/stageflip/agents/type-design-consultant/SKILL.md
---

# Cluster G — Calls-to-action & social

CTA register: YouTube subscribe, TikTok follow, Instagram link sticker, Coinbase DVD QR, social-handle lower-third. Depends on gap clips `SubscribeButton` (T-317), `FollowPrompt` (T-318), `QRCodeBounce` (T-319).

## When to invoke

Invoke any `compose_*` tool in this cluster when the brief cites:

- Creator monetization (subscribe, follow, join)
- Paid social (engagement prompts, link stickers)
- Event promotion (QR to landing page)
- Cross-platform handoff (handle reveal across channels)

Do **not** invoke for news / sports / weather / captions — this cluster is exclusively about conversion actions.

## Presets

- [`youtube-subscribe-bounce`](youtube-subscribe-bounce.md) — `SubscribeButton`, YouTube-native UI, cursor-click animation
- [`tiktok-follow-pulse`](tiktok-follow-pulse.md) — `FollowPrompt`, pink-red pulse, right-thumb zone
- [`instagram-link-sticker`](instagram-link-sticker.md) — rounded pill, platform-native UX
- [`coinbase-dvd-qr`](coinbase-dvd-qr.md) — `QRCodeBounce`, zero-context curiosity gap
- [`social-handle-lower-third`](social-handle-lower-third.md) — lowerThird, platform-icon cascade, cross-platform passport

## Semantic tools

- `compose_cta(action, channel, brand)` — picks preset by action (subscribe / follow / link / handle) and channel
- `compose_subscribe_prompt(channel_brand)` — YouTube-native register
- `compose_social_handle(handles, brand)` — multi-platform cascade lower-third
- `compose_qr_bounce(url, brand)` — Coinbase-register or branded variant

## Cluster conventions (from the compass canon)

- **Mimicry wins.** The YouTube subscribe-button preset replicates the native UI because the viewer has seen it billions of times; familiarity lowers cognitive friction. Don't "design around" native UI — mimic it.
- **Right-thumb zone on mobile.** 67% of mobile users scroll with the right thumb (TikTok UX canon). Mobile-register presets place CTAs in the right-side column, vertically aligned with like/comment/share. Don't put a follow CTA bottom-center on vertical video.
- **Curiosity gaps beat branding (sometimes).** Coinbase's unbranded bouncing QR got 20M hits in 60 seconds. When the brief demands attention-max (Super-Bowl-style events), consider zero-branding presets. Otherwise default to branded.
- **Cursor animation is communication.** The subscribe-button preset includes an animated cursor that visually demonstrates the action. Don't remove it to "clean up" the preset — it's the mechanism.
- **Brief exposure + repetition beats long static hold.** Social-handle lower-thirds are 4–8 seconds, repeated across a video — not one 30-second hold. The compose API takes a `repetition` param; respect it.
- **Platform icons must be official-color.** Instagram gradient, YouTube red, TikTok pink/black. Using a monochrome "brand-styled" icon here feels amateur. Defer to platform canon.

## Escalation

If the brief cites a platform we don't have a preset for (X / Twitter, Bluesky, Threads), escalate. Platform-native CTA registers require UX research, not improvisation.

If the brief demands a QR code with branding on-code (logo, watermark), confirm the scan rate is acceptable. Branded QR codes have higher scan failure; Coinbase's unbranded canon exists for a reason.

## Type-design batch review

Cluster-G fonts are mostly platform fonts (Roboto for YouTube, TikTok Sans for TikTok, Instagram's platform font). Batch review at `reviews/type-design-consultant-cluster-g.md` covers the fallbacks and cross-preset coherence.

## Related

- ADR-004 (preset system)
- Gap clips T-317 (`SubscribeButton`), T-318 (`FollowPrompt`), T-319 (`QRCodeBounce`) — blocks the relevant presets
- Compass canon: `docs/compass_artifact.md` § Call-to-action overlays
