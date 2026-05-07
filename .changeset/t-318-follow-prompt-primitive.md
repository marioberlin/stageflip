---
'@stageflip/runtimes-frame-runtime-bridge': patch
---

T-318 — `follow-prompt` runtime-clip primitive.

Sealed-platform vertical-video right-thumb-zone follow CTA serving
Cluster G presets via Zod discriminated union on `platform`: `'tiktok'`
(40 × 40 white circular avatar with TikTok Pink `#FE2C55` "+" badge
half-overlapping the bottom edge + optional 1–2 character monogram in
TikTok Sans Bold 700), `'instagram'` (same circular avatar with magenta
`#DD2A7B` badge + optional canonical
`linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)` story-
ring via `showRing: true` + `gradient?` overrides), `'youtube'` (same
circular avatar with YouTube Red `#FF0000` badge + Roboto Medium 500
monogram), `'generic'` (brand-neutral circular avatar with
`avatarColor?` / `badgeColor?` / `avatarTextColor?` theme-slot
fallback). Three sealed animation phases (`'idle'` default — static
avatar; `'pulsing'` — bounded sustained-pulse 1.00 → 1.05 → 1.00 over
`ceil(fps * 1.5)` frames per cycle, `pulseRepeat: 1..10` cycles, with
optional 30%-alpha expanding pulse-ring; `'followed'` — "+" →
checkmark `\u{2713}` glyph swap with 1.00 → 1.20 → 1.00 scale-pop on
the badge over `ceil(fps * 0.3)` frames). Always-present register —
never enters / exits. Brand canon dominates theme on branded platforms;
theme-slot fallback only for `'generic'`. Frame-deterministic — no
`Date.now` / `Math.random` / `crypto.randomUUID` / `setTimeout` /
`setInterval` / `requestAnimationFrame`. `fontRequirements` registers
TikTok Sans 700 + Roboto 500 + Plus Jakarta Sans 700. Theme-slot
fallback (`background` → `palette.background`, `foreground` →
`palette.foreground`, `accent` → `palette.accent`). Bridge clip count
53 → 54. Unblocks T-370 (`tiktok-follow-pulse`, primary Cluster G
consumer) and the broader Cluster G vertical-video follow-CTA register.
