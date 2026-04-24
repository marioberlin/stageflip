---
title: Cluster A — News & breaking
id: skills/stageflip/presets/news
tier: cluster
status: substantive
last_updated: 2026-04-25
owner_task: T-331
related:
  - docs/decisions/ADR-004-preset-system.md
  - skills/stageflip/agents/type-design-consultant/SKILL.md
  - skills/stageflip/clips/catalog/SKILL.md
---

# Cluster A — News & breaking

Presets drawn from broadcast-news register: CNN, BBC, Al Jazeera, Fox News, MSNBC, Netflix documentaries, Apple TV+. Authority, urgency, clarity.

## When to invoke

Invoke any `compose_*` tool in this cluster when the brief cites:

- Breaking news, developing story, ongoing coverage
- Political event, election, press conference
- Corporate communications in broadcast register (earnings, crisis, leadership change)
- Journalistic explainer (documentary register)

Do **not** invoke for social-first content — that's Cluster F (captions) or Cluster G (CTAs). Do **not** invoke for weather or sports — see clusters C and B respectively.

## Presets

- [`cnn-classic`](cnn-classic.md) — lowerThird, white banner + red flag, CNN Sans-fallback
- [`cnn-breaking`](cnn-breaking.md) — breakingBanner, red block wipe, most-urgent register
- [`bbc-reith-dark`](bbc-reith-dark.md) — lowerThird, dark semi-transparent, Reith Serif/Sans pairing
- [`al-jazeera-orange`](al-jazeera-orange.md) — lowerThird, bilingual Arabic/Latin, gold accent
- [`fox-news-alert`](fox-news-alert.md) — breakingBanner, vertical-slide motion, Prussian blue + red
- [`msnbc-big-board`](msnbc-big-board.md) — fullScreen interactive data register
- [`netflix-doc-lt`](netflix-doc-lt.md) — lowerThird, no background, typographic minimalism
- [`apple-tv-lt`](apple-tv-lt.md) — lowerThird, thin-weight uppercase, wide tracking

## Semantic tools

- `compose_breaking_news(message, severity, brand)` — picks breaking-register preset from the tenant's brand registry
- `compose_ongoing_update(message, brand)` — picks non-urgent register (flipper-style, not wipe)
- `compose_guest_intro(name, title, brand)` — picks lowerThird preset matching brand register
- `compose_documentary_title_card(title, subtitle, brand)` — picks documentary register (Netflix / Apple TV+)

## Cluster conventions (from the compass canon)

- **Red = urgent.** Never use red accent for a neutral update or ongoing coverage. If the brief doesn't justify urgency, route to a flipper-register preset.
- **Register is load-bearing.** Block-wipe is CNN-register; vertical-slide is Fox-register; flipper is BBC-register; no-background is streaming-doc register. Do not mix registers inside one composition.
- **Ticker format: flipper beats scroll.** Comprehension wins over information density (BBC 2019 rebrand canon). Use scroll only if the preset explicitly prescribes it.
- **Bespoke fonts are proprietary.** Every preset ships a license-cleared fallback; the bespoke font is BYO. See the type-design-consultant batch review linked from each preset.
- **Single end-cap color identifies the brand.** CNN red, BBC red, Al Jazeera orange, Fox Prussian blue — never paint the full banner in the brand color; use the end cap or accent strip.
- **Dark-on-light vs. light-on-dark.** BBC 2019 proved dark-on-light is legible on more backgrounds than the reverse. Default to dark-on-light unless the preset explicitly prescribes otherwise (e.g., Fox, Al Jazeera).

## Escalation

If the brief requests a register not covered by a preset (e.g., "Sky News register" — not in this cluster), escalate to the Orchestrator with the closest preset + the missing constraint. Do **not** improvise a new register inline by mixing tokens from two presets.

If the tenant's brand registry has no matching register for a compose-call, fall back to the documentary register (Netflix / Apple TV+) — it's the most neutral in this cluster.

## Type-design batch review

All presets in this cluster cite bespoke fonts. The batch review at `reviews/type-design-consultant-cluster-a.md` approves every fallback choice; preset PRs link to it. See ADR-004 §D4.

## Related

- ADR-004 (preset system)
- `skills/stageflip/agents/type-design-consultant/SKILL.md`
- Compass canon: `docs/compass_artifact.md` §§ Lower thirds, News and breaking news graphics
