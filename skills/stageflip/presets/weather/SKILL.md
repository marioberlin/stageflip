---
title: Cluster C — Weather
id: skills/stageflip/presets/weather
tier: cluster
status: substantive
last_updated: 2026-04-25
owner_task: T-347
related:
  - skills/stageflip/presets/data/SKILL.md
---

# Cluster C — Weather

Weather-graphics register: TWC IMR, TWC RetroCast, BBC Mark Allen clouds, NHC hurricane cone, Doppler dBZ, temperature heat maps. The rare cluster where color palettes have near-universal literacy.

## When to invoke

Invoke any `compose_*` tool in this cluster when the brief cites:

- Weather broadcast, forecast, severe-weather alert
- Climate journalism, data-driven weather segments
- Disaster response (hurricane, flood, wildfire, heat wave)
- Agricultural or insurance communications citing weather conditions

Do **not** invoke for general-purpose data visualization — that's Cluster E.

## Presets

- [`twc-immersive-mixed-reality`](twc-immersive-mixed-reality.md) — fullScreen, Emmy-winning Unreal IMR register, photo-real storm objects
- [`twc-retrocast-8bit`](twc-retrocast-8bit.md) — fullScreen, WeatherStar 4000 nostalgia, 8-bit pixel font
- [`bbc-mark-allen-clouds`](bbc-mark-allen-clouds.md) — weatherMap, rotating 3D globe, fluffy-cloud icon set
- [`nhc-cone-of-uncertainty`](nhc-cone-of-uncertainty.md) — stormTracker, coastal-warning color palette, 5-day cone
- [`doppler-dbz-standard`](doppler-dbz-standard.md) — weatherMap, reflectivity dBZ palette, radar sweep
- [`heat-map-cool-to-warm`](heat-map-cool-to-warm.md) — weatherMap, temperature gradient, Meriam 38-class palette

## Semantic tools

- `compose_weather_alert(condition, regions, severity, brand)` — picks warning preset by severity tier
- `compose_forecast_map(regions, days, brand)` — picks forecast register (BBC, TWC, Doppler)
- `compose_storm_track(storm, path, brand)` — picks stormTracker preset (NHC cone canonical)
- `compose_temperature_map(regions, unit, brand)` — heat-map preset

## Cluster conventions (from the compass canon)

- **Color palettes are standard, not brand.** The Doppler dBZ progression (blue → green → yellow → orange → red → magenta) and the temperature gradient (purple → blue → green → yellow → red → maroon) are public-interest standards. Do not brand them; audiences have decades of literacy.
- **NHC cone misinterpretation is the canonical UX failure.** Viewers assume "outside the cone = safe," which is wrong. Every cone preset must carry the disclaimer "impacts extend beyond the cone." This is non-negotiable.
- **Retrocast register is nostalgia, not throwaway.** TWC launched "RetroCast Now" in 2025 as a first-class register. Treat it as we treat broadcast CNN — same rigor.
- **Symbol sets are long-lived.** Mark Allen's 1975 BBC clouds survived 30+ years and multiple technology shifts. When compositing with a BBC-register weather map, use the canonical symbol set; don't substitute.
- **Severity is not color alone.** Tornado warnings, hurricane warnings, and storm-surge warnings all overlap on red. Always include text labels + icon + color together.

## Escalation

If the brief cites a weather register not in the cluster (e.g., Japanese NHK weather, Deutsche Welle weather), escalate. Regional weather broadcasts have distinct conventions (JMA map projections, etc.) that we don't currently carry.

If real-time data is needed (live radar stream, current storm position), confirm the tenant has enabled `LiveDataClip` per ADR-005.

## Type-design — no cluster-wide batch review

This cluster uses only license-cleared or public-domain fonts at the cluster level. Individual presets that cite bespoke type (e.g., a specific TWC modernization typeface) escalate one-off for type-design review rather than a batch.

## Related

- ADR-004 (preset system)
- `skills/stageflip/presets/data/SKILL.md` — cluster E, pairs with weather for climate-data visualizations
- Compass canon: `docs/compass_artifact.md` § Weather graphics
