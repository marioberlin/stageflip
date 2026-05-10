---
title: Tools — Cluster C Compose Bundle
id: skills/stageflip/tools/cluster-c-compose
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-347
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Cluster C Compose Bundle

Cluster C (Weather) composer tools — preset-binding factories for weather alerts / forecast maps / storm tracks / temperature maps across the 6 ratified Cluster C presets (T-347).

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/cluster-c-compose/`.

Registration: see `@stageflip/engine`'s `registerClusterCComposeBundle` (or equivalent) export.

## Tools

### `compose_weather_alert`

Compose a Cluster C (Weather) alert routing plan. Returns `presetId: 'nhc-cone-of-uncertainty'` (NHC × hurricane / tropical-storm warning) or `presetId: 'twc-immersive-mixed-reality'` (TWC × severe-thunderstorm / tornado watch+warning; routes to the static-fallback `imrStaticFallback` primitive per the T-347h binding override). Plus opaque pass-through `props`. Color palettes are public-interest STANDARDS — composer does NOT accept palette overrides; primitives reject them too. NHC cone disclaimer 'Impacts extend beyond the cone' is enforced by the primitive (default text); composer does NOT inject.

- `condition` (`string`) — enum: `hurricane` / `tropical-storm` / `severe-thunderstorm` / `tornado` / `winter-storm` / `flood` / `heat` / `wildfire-smoke`
- `regions` (`array`) — Region names / codes (1–80 chars each); 1–50 entries.
- `severity` (`string`) — enum: `advisory` / `watch` / `warning`
- `brand` (`string`) — enum: `nhc` / `twc` / `nws`
- `headline` (`string`) _(optional)_

### `compose_forecast_map`

Compose a Cluster C (Weather) forecast-map routing plan. Returns `presetId` of `bbc-mark-allen-clouds` (BBC; rotating 3D globe), `doppler-dbz-standard` (Doppler / NEXRAD / NWS radar; canonical reflectivity dBZ palette), `twc-retrocast-8bit` (TWC + `register: 'retrocast'`; WeatherStar 4000 nostalgia), or `twc-immersive-mixed-reality` (TWC multi-day; routes to static-fallback IMR primitive). For TWC short-range (`days <= 1`), `register` MUST be supplied to disambiguate `radar` vs `multi-day`. Plus opaque pass-through `props`. Color palettes are public-interest STANDARDS — composer does NOT accept palette overrides.

- `regions` (`array`) — Region names / codes (1–80 chars each); 1–50 entries.
- `days` (`number`) — Forecast horizon in days; 0 = current/instantaneous (radar nowcast), 14 = two-week outlook.
- `brand` (`string`) — enum: `bbc` / `twc` / `doppler` / `nws` / `nexrad`
- `register` (`string`) _(optional)_ — enum: `radar` / `retrocast` / `multi-day` / `globe` — Sub-mode disambiguator. REQUIRED for TWC short-range (days <= 1) to pick `radar` vs `multi-day`. Optional for other brands; `retrocast` selects the WeatherStar 4000 register for TWC; `globe` is reserved for future BBC variants.

### `compose_storm_track`

Compose a Cluster C (Weather) storm-track routing plan. Returns `presetId: 'nhc-cone-of-uncertainty'` (the only Cluster C `stormTracker` consumer; brand ∈ {nhc, noaa}). Plus opaque pass-through `props`. NHC cone disclaimer 'Impacts extend beyond the cone' is enforced by the primitive (default text per cluster SKILL §"Cluster conventions"); the composer is composer-transparent — when caller omits `disclaimerText`, the output `props` does NOT include the key, and the primitive default flows through unchanged. When caller supplies `disclaimerText`, it forwards verbatim (legitimate translation / regional override use case).

- `storm` (`object`) — Storm identity — `{ name: string (1–80 chars), advisoryNumber?: positive int }`.
- `path` (`array`) _(optional)_ — Optional forecast track points: `{ lat: -90..90, lon: -180..180, intensity?: D|S|H|M, timestamp?: string }`. 1–20 entries.
- `brand` (`string`) — enum: `nhc` / `noaa`
- `disclaimerText` (`string`) _(optional)_ — Optional disclaimer override (max 120 chars). When omitted, the primitive's canonical NHC default 'Impacts extend beyond the cone' is used. Use only for legitimate translation / regional override.

### `compose_temperature_map`

Compose a Cluster C (Weather) temperature-map routing plan. Returns `presetId: 'heat-map-cool-to-warm'` (Meriam-38-class temperature gradient; brand ∈ {meriam, esri, nws-meriam}). Plus opaque pass-through `props`. The temperature gradient (purple → blue → green → yellow → red → maroon) is a public-interest STANDARD per cluster SKILL §"Cluster conventions" — composer does NOT accept palette overrides; primitives reject them too.

- `regions` (`array`) — Region names / codes (1–80 chars each); 1–50 entries.
- `unit` (`string`) — enum: `F` / `C`
- `brand` (`string`) — enum: `meriam` / `esri` / `nws-meriam`


## Invariants

- Every handler declares `bundle: 'cluster-c-compose'`.
- Tool count 4 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-347
