---
'@stageflip/runtimes-frame-runtime-bridge': patch
---

T-316a — `caption` `resolveColor` honors `muteOpacity` for non-tagged
past/future words.

Previously `resolveColor` only applied `muteOpacity` when a word was
explicitly tagged `emphasis: 'mute'`; non-tagged past/future visible
words fell through to the foreground branch and rendered at opacity
`1.0`, defeating the bundle-level opacity-karaoke register described in
D-T316-2 (e.g. `ali-abdaal` ships `muteOpacity: 0.6`). Adds a third
branch between the highlight/active branch and the foreground fallback:
when `resolved.muteOpacity < 1`, return the foreground color at that
opacity. Active-word and explicit per-word `mute` paths are unchanged;
the active branch precedes the new branch so the active word never
picks up dim. Bundles shipping `muteOpacity: 1` (`hormozi`, `mrbeast`,
`tiktok`, `netflix`, `karaoke-wipe`) hit an unreachable branch — output
byte-identical.

Unblocks T-365 `ali-abdaal-opacity-karaoke` retry. No clip-count or
registry change; no schema change.
