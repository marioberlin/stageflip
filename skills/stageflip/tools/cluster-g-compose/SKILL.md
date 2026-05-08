---
title: Tools — Cluster G Compose Bundle
id: skills/stageflip/tools/cluster-g-compose
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-374
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Cluster G Compose Bundle

Cluster G (CTAs / social) composer tools — preset-binding factories for subscribe / follow / link-sticker / QR-bounce / social-handle briefs across the 5 ratified Cluster G presets (T-374).

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/cluster-g-compose/`.

Registration: see `@stageflip/engine`'s `registerClusterGComposeBundle` (or equivalent) export.

## Tools

### `compose_cta`

Pick a Cluster G (CTAs / social) preset by `intent` + optional `platform` and emit a ratified preset id + clipKind + opaque props payload. Sealed intent enum: `subscribe` / `follow` (require `platform: 'youtube' | 'tiktok'`; route to youtube-subscribe-bounce / tiktok-follow-pulse — Instagram is intentionally not in this branch, use `intent: 'link'` for Instagram link-sticker register), `link` (requires `platform: 'instagram'` + `url`; routes to instagram-link-sticker), `qr` (requires `qrMatrix`; routes to coinbase-dvd-qr; default theme 'unbranded' per Coinbase canon), `social-handle` (requires `handles[]`; routes to social-handle-lower-third). Read-only: caller mounts the clip via a separate write-tier tool.

- `intent` (`string`) — enum: `subscribe` / `follow` / `link` / `qr` / `social-handle`
- `platform` (`string`) _(optional)_ — enum: `youtube` / `tiktok` / `instagram` / `coinbase`
- `channelName` (`string`) _(optional)_
- `subscriberCount` (`string`) _(optional)_
- `handles` (`array`) _(optional)_
- `url` (`string`) _(optional)_
- `qrMatrix` (`string`) _(optional)_
- `brand` (`object`) _(optional)_ — Brand atom: `{ primary (#RRGGBB), accent (#RRGGBB)?, font? }`. All hex colors validated server-side against `^#[0-9a-fA-F]{6}$`.
- `theme` (`string`) _(optional)_ — enum: `platform-native` / `branded` / `unbranded`
- `repetition` (`integer`) _(optional)_

### `compose_subscribe_prompt`

Pick a Cluster G subscribe-button mimicry preset by `platform`. `youtube` → youtube-subscribe-bounce (subscribeButton; cursor-click animation, YouTube red), `tiktok` → tiktok-follow-pulse (followPrompt; pink-red pulse, right-thumb zone). Sealed 2-value enum; Instagram is intentionally excluded — for Instagram CTAs use compose_cta with intent: 'link' (link-sticker register).

- `platform` (`string`) — enum: `youtube` / `tiktok`
- `channelName` (`string`)
- `subscriberCount` (`string`) _(optional)_
- `theme` (`string`) _(optional)_ — enum: `light` / `dark`
- `brand` (`object`) _(optional)_ — Brand atom (color-only): `{ primary (#RRGGBB), accent (#RRGGBB)? }`.

### `compose_social_handle`

Emit the Cluster G social-handle lower-third preset (social-handle-lower-third; lowerThird) for a cross-platform handle passport. Accepts 1–6 platform-keyed handle entries; defaults `repetition: 1` and `duration: 6` per cluster canon (4–8s repeated, not single long hold). The preset prepends platform-icon + `@` to each handle; pass the bare handle string without leading `@`.

- `handles` (`array`)
- `brand` (`object`) _(optional)_ — Brand atom: `{ primary (#RRGGBB), accent (#RRGGBB)?, font? }`. All hex colors validated server-side against `^#[0-9a-fA-F]{6}$`.
- `repetition` (`integer`) _(optional)_
- `duration` (`integer`) _(optional)_

### `compose_qr_bounce`

Emit the Cluster G coinbase-dvd-qr preset (qrBounce) for a bouncing QR-code overlay. Accepts an opaque pre-computed `qrMatrix` (base64 PNG asset id or 2D bit array — the QR encoder runs upstream of this composer); optional `url` (informational pass-through), `brand` overrides, `theme` ('unbranded' default per Coinbase canon — the zero-context curiosity gap that drove 20M scans in 60 seconds; 'branded' for in-house registers), and `bounceSpeed`. Single Cluster G consumer of the `qrBounce` clipKind.

- `qrMatrix` (`string`)
- `url` (`string`) _(optional)_
- `brand` (`object`) _(optional)_ — Brand atom (color-only): `{ primary (#RRGGBB), accent (#RRGGBB)? }`.
- `theme` (`string`) _(optional)_ — enum: `unbranded` / `branded`
- `bounceSpeed` (`string`) _(optional)_ — enum: `slow` / `normal` / `fast`


## Invariants

- Every handler declares `bundle: 'cluster-g-compose'`.
- Tool count 4 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-374
