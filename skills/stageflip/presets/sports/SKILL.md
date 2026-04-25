---
title: Cluster B — Sports
id: skills/stageflip/presets/sports
tier: cluster
status: substantive
last_updated: 2026-04-25
owner_task: T-340
related:
  - skills/stageflip/agents/type-design-consultant/SKILL.md
  - skills/stageflip/presets/data/SKILL.md
---

# Cluster B — Sports

Live-sports register: F1 timing tower, Premier League, Fox NFL, NBC SNF, cricket, Wimbledon, Masters, UEFA Champions League. The densest data-per-pixel cluster. Deep interaction with cluster E (data visualizations).

## When to invoke

Invoke any `compose_*` tool in this cluster when the brief cites:

- Live sports event, score update, match report
- Player introduction, team matchup, standings
- Post-match highlights, replay call-out, injury report, power ranking
- Sports-adjacent corporate comms (sponsor activations, league partnerships)

Do **not** invoke for fitness / lifestyle / creator sports content — that's Cluster F (captions) with a sports topic, not this register.

## Presets

- [`f1-timing-tower`](f1-timing-tower.md) — scoreBug vertical, 20 rows, team-color stripe, sector-color palette
- [`premier-league-field-of-play`](premier-league-field-of-play.md) — scoreBug, PL purple + green, DixonBaxi motion system
- [`fox-nfl-no-chrome`](fox-nfl-no-chrome.md) — scoreBug bottom-center, no container, team-color background boxes
- [`nbc-snf-possession-illuminated`](nbc-snf-possession-illuminated.md) — scoreBug horizontal, side-illuminated by possession
- [`cricket-scorebug`](cricket-scorebug.md) — top scoreBug, ball-by-ball dots, dismissal flash
- [`wimbledon-green-purple`](wimbledon-green-purple.md) — scoreBug bottom-left, restrained, Gotham-fallback
- [`masters-red-under-par`](masters-red-under-par.md) — standings + leaderboard, red-under-par canon
- [`uefa-starball-refraction`](uefa-starball-refraction.md) — fullScreen, refraction palette, premium register
- [`espn-bottomline-flipper`](espn-bottomline-flipper.md) — newsTicker, persistent two-line flipper, ESPN Red + yellow score highlights

## Semantic tools

- `compose_sports_score(home, away, period, sport, brand)` — picks scoreBug preset by sport + brand
- `compose_player_intro(player, team, stats, brand)` — picks playerIntro preset matching brand
- `compose_var_call(decision, sport, brand)` — routes to `VARBanner` (gap clip T-320); PL / UCL register only
- `compose_standings_table(teams, sport, brand)` — picks standings preset

## Cluster conventions (from the compass canon)

- **Team color stripes > reading text.** F1, Premier League, and others use color to identify — the text is redundancy. Every preset must preserve the brand's color-identification system; don't collapse to monochrome.
- **Tabular numerals are mandatory.** Sports runs on numbers. Every preset's typography must declare `numericStyle: tabular`. If a fallback doesn't support tabular, escalate.
- **Sector colors are universal shorthand.** Purple = session best, green = personal best, yellow = slower. This comes from F1 but is recognized globally. If a non-F1 preset uses time deltas, adopt the same scheme.
- **Possession / directionality deserves a physical metaphor.** NBC SNF's possession-illumination and directional `<< 1st and 10 <<` chevrons communicate without requiring reading. Prefer this pattern over text labels.
- **AR overlays are a cluster H concern.** If the brief requests live AR overlays (Sky Sports formations, Hawk-Eye VAR 3D skeletons, Olympic swim lanes), route to cluster H.
- **Register separation.** Fox's no-chrome and NBC's dark-bar are incompatible visual languages; never mix inside a composition.

## Escalation

If the sport doesn't match any preset (e.g., rugby, MMA, esports), escalate. Do not improvise by adapting the cricket or NFL register to a new sport — each sport's information architecture is distinct.

If the brief requests live data (live score streams, telemetry), confirm the tenant has enabled the frontier `LiveDataClip` per ADR-005 feature flag. Otherwise, compose a static snapshot preset.

## Type-design batch review

All presets in this cluster cite bespoke fonts (Formula1 Display, Premier Sans, Sky Sports Sans, Champions, Gotham). Batch review at `reviews/type-design-consultant-cluster-b.md`.

## Related

- ADR-004, ADR-005 (frontier clips for live-data compositions)
- `skills/stageflip/presets/data/SKILL.md` (cluster E — pairs with B for stat overlays)
- `skills/stageflip/presets/ar/SKILL.md` (cluster H — AR sports overlays)
- Compass canon: `docs/compass_artifact.md` §§ Sports graphics, Dynamic sports results and live data
