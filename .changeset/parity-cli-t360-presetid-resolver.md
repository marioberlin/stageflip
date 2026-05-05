---
'@stageflip/parity-cli': patch
---

T-360 — extend `ClipKindResolver` to take an optional `presetId` for
multi-preset-per-clipKind disambiguation.

`DEFAULT_CLIP_KIND_RESOLVER` now checks a per-preset override map
(`PRESET_ID_BINDINGS`) before falling back to the clipKind-only mapping.
T-359 / T-358 callers pass no `presetId` and continue to fall through
to the clipKind-only path; `createGenerateFixtureRenderer` now passes
`renderArgs.preset.frontmatter.id` as the second resolver arg so the
override map activates for `big-number-stat-impact` (the second
`bigNumber`-clipKind preset to land in cluster E).

The signature change is backward-compat — `presetId` is optional.
Resolvers ignoring the arg keep T-359 behavior; the new arg lets new
presets share a `clipKind` while parameterizing the same runtime clip
differently (e.g., `big-number-stat-impact` renders `87.4%` at heavy
weight vs. `f1-sector-purple-green`'s `21.412` at weight 700).
