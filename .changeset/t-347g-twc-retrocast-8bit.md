---
'@stageflip/runtimes-frame-runtime-bridge': patch
'@stageflip/parity-cli': patch
---

T-347g — `weatherStar4000Panel` primitive + preset `twc-retrocast-8bit` substantive (Cluster C 5/6).

Combined primitive carve-out + preset implementation. The existing `magic-wall-panel` primitive does NOT fit the WeatherStar 4000 / 5000 era TWC RetroCast register (period-authentic L-bar sidebar + 8-bit pixel font + pixel-precision rendering). T-347g introduces a dedicated primitive `weatherStar4000Panel` and binds the preset to it via `PRESET_ID_BINDINGS` (preset's `clipKind: fullScreen` stays unchanged; binding overrides `clipName: 'weatherStar4000Panel'` per T-328 / T-339 precedent).

**New primitive `weatherStar4000Panel`**:

- Single-style v1 (no `discriminatedUnion`); single-object schema mirrors qr-code-bounce / grain precedent
- Pixel-precision non-negotiable: integer-only sizes, 8-px-step font sizing, `image-rendering: pixelated`, no anti-aliasing softeners
- Canonical palettes (NOT theme-able): `WEATHER_STAR_BLUE_GRADIENT` (#000066 / #000099 deep-blue), `WEATHER_STAR_ORANGE_GOLD` (#FF9900 / #DAA520 accent bars), `WEATHER_STAR_FOREGROUND_WHITE_GOLD` (#FFFFFF / #DAA520)
- Closed-form integer ticker scroll (no `useEffect`); sealed `scrollSpeedPxPerFrame: 1 | 2 | 4` integer-pixel-only enum per stub line 38
- Optional L-bar sidebar (default true; signature pre-2019 element)
- Optional CRT scan-line overlay (subtle 4% per stub line 41)
- 8-bit pixel font: Press Start 2P fallback (OFL Google Fonts); `snapTo8px` helper exported
- Theme slots: `background` + `foreground`; palettes themselves NOT theme-bound

**Preset `twc-retrocast-8bit`** binding: ATLANTA / Partly Cloudy / 78°F gold + 4 metadata rows (HUMIDITY / WIND / PRESSURE / DEW POINT) + 8-city ticker (BIRMINGHAM / CHARLESTON / CHARLOTTE / COLUMBIA / JACKSONVILLE / NASHVILLE / NEW ORLEANS / TAMPA) at speed 2 px/frame + L-bar + CRT scan-lines. Frame 60 single-frame static; PSNR ≥ 44 / SSIM ≥ 0.99 tight thresholds (pixel-perfect register has very low variance per stub line 51).

`ALL_BRIDGE_CLIPS` length: 60 → 61. Updates 12 sibling clip tests + cdp-host-bundle runtime tests + skills-sync `LIVE_RUNTIME_MANIFEST` + frame-runtime-bridge SKILL.md.

v1 carve-outs deferred:
- T-347g-music-cue (period-authentic smooth-jazz / muzak audio cue per stub line 47)
- T-347g-multi-city (multi-city panel transitions with hard-cut sequencing per stub line 40)
- T-347g-ticker-cycle (multi-frame ticker animation; v1 single-frame static suffices via `frameOffset` pinning)

Per CLAUDE.md §13 (F-30) verification posture: this PR's preset golden + PO ratification is the verification step (option 2 — reference preset signed off via parity-fixture flow). Single consumer means a single PO ratification closes the §13 obligation.

Cluster C: 4/6 → 5/6 ELIGIBLE (after T-347c, T-347d, T-347e, T-347g all merge; T-347f nhc-cone is in-flight separately).
