---
title: Cluster F — Creator captions & lyrics
id: skills/stageflip/presets/captions
tier: cluster
status: substantive
last_updated: 2026-04-25
owner_task: T-368
related:
  - docs/decisions/ADR-004-preset-system.md
  - skills/stageflip/agents/type-design-consultant/SKILL.md
  - skills/stageflip/concepts/captions/SKILL.md
---

# Cluster F — Creator captions & lyrics

Short-form and creator register: Hormozi, MrBeast, TikTok rounded-box, Ali Abdaal opacity, Netflix invisible, karaoke progressive wipe. The **highest-volume cluster in practice** — every creator video uses it. Depends on the `CaptionClip` gap clip (T-316) and the `LyricsClip` gap clip (T-322).

## When to invoke

Invoke any `compose_*` tool in this cluster when the brief cites:

- Short-form vertical video (TikTok, Reels, Shorts)
- Long-form YouTube content
- Podcast video / talking-head format
- Course / tutorial content with spoken narration
- Music video lyrics, karaoke, lyric video

This cluster pairs with `skills/stageflip/concepts/captions/SKILL.md` — the concept skill covers transcription + packing; this cluster covers presentational register.

## Presets

- [`hormozi-montserrat-black`](hormozi-montserrat-black.md) — caption, Montserrat Black 900 fallback, word-by-word color highlight
- [`mrbeast-komika-axis`](mrbeast-komika-axis.md) — caption, Komika Axis fallback, 1–2 words, snap-cut replacement
- [`tiktok-rounded-box`](tiktok-rounded-box.md) — caption, semi-transparent rounded-corner background, platform-native
- [`ali-abdaal-opacity-karaoke`](ali-abdaal-opacity-karaoke.md) — caption, opacity-based karaoke, elegant register
- [`netflix-invisible`](netflix-invisible.md) — caption, minimum-distraction subtitle register, 42-char max
- [`karaoke-progressive-wipe`](karaoke-progressive-wipe.md) — lyrics, left-to-right color wipe, beat-synced

## Semantic tools

- `compose_creator_caption(transcript, style, brand)` — picks preset by creator register (hormozi / mrbeast / tiktok / ali-abdaal / netflix)
- `compose_subtitle(transcript, accessibility_mode, brand)` — Netflix-invisible register default; accessibility_mode triggers Netflix-strict rules
- `compose_lyric_video(lyrics, music, style, brand)` — karaoke register with beat sync
- `compose_keyword_highlight(transcript, keywords, brand)` — explicit keyword color-pop (Hormozi / MrBeast subvariant)

## Cluster conventions (from the compass canon)

- **Word-level timing, not sentence-level.** This cluster descends from karaoke machines of the 1970s — the progressive color wipe is the ancestor of every modern word-by-word caption style. The `CaptionClip` (T-316) is built for word-level timestamps; never compose at sentence granularity in this cluster.
- **Reading pace, not frame rate.** Hormozi's 4–6 words per line and MrBeast's 1–2 words are chosen for reading cadence, not visual rhythm. Preset output must respect its canonical word-count-per-line rule; overriding it is an escalation.
- **Stroke + shadow, not background box (except TikTok).** Most creator captions use a heavy stroke (3–5 px) and a drop shadow instead of a background rectangle. TikTok's rounded-box is the exception, and it's platform-native — it reads as TikTok even when reposted elsewhere.
- **Color highlights convey meaning.** Hormozi's yellow/green/red highlight keywords; MrBeast's green highlights monetary amounts. When `compose_keyword_highlight` is invoked, the preset's color semantics apply — don't override unless brand requires.
- **Minimum duration matters for subtitles.** Netflix mandates ≥ 5/6 s (833 ms) minimum per caption event. `netflix-invisible` enforces this automatically; other presets don't — but the validator warns if a compose produces sub-833 ms events for accessibility-mode output.
- **Avoid bottom 20–25% on platform-native registers.** TikTok, Reels, and Shorts overlay UI in the lower band. Platform-native presets (`tiktok-rounded-box`) default to upper-center or center; don't override without confirming the platform.

## Escalation

If the brief cites a register not in the cluster (e.g., a specific creator's signature style that we don't carry), escalate. Do **not** mix Hormozi + MrBeast tokens — the registers are incompatible.

If the brief demands accessibility compliance (FCC-grade), confirm the preset is `netflix-invisible` or a derivative; it's the only one that guarantees the strict-subtitle rules.

## Type-design batch review

Cluster-F fonts span free / cheap / custom: Montserrat (OFL), Komika Axis (cheap commercial), TikTok Sans (platform), TT Fors (commercial), Netflix Sans (proprietary-BYO). Batch review at `reviews/type-design-consultant-cluster-f.md`.

## Related

- ADR-004 (preset system)
- Gap clip T-316 (`CaptionClip`) — blocks every preset in this cluster
- Gap clip T-322 (`LyricsClip`) — blocks the karaoke preset
- `skills/stageflip/concepts/captions/SKILL.md` — transcription + packing pipeline
- Compass canon: `docs/compass_artifact.md` § Caption and subtitle styles
