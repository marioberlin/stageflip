---
'@stageflip/runtimes-frame-runtime-bridge': minor
'@stageflip/cdp-host-bundle': minor
---

T-131b.1 — light tranche of the frame-runtime-bridge port:
`counter`, `kinetic-text`, `typewriter`, `logo-intro`, `chart-build`.
Each clip is a fresh implementation against `@stageflip/frame-runtime`
(zero Remotion imports per CLAUDE.md §3) and ships with a Zod
`propsSchema` + `themeSlots` map that binds default colour props to
`palette.primary` / `palette.foreground` / `palette.accent` /
`palette.background` roles. `defineFrameClip` now forwards `propsSchema`
+ `themeSlots` onto the produced ClipDefinition (mirrors T-131a's
`defineCssClip` change). New `ALL_BRIDGE_CLIPS` barrel constant lets
downstream registrations append future tranches without touching the
call site. cdp-host-bundle now wires the 5 clips into the live runtime
registry; parity fixtures land for each.
