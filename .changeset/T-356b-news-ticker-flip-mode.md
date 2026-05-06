---
"@stageflip/runtimes-frame-runtime-bridge": patch
---

T-356b — `news-ticker-bar` primitive adds `mode: 'scroll' | 'flip'` + `flipDurationMs` props.

`'scroll'` (default; backward-compat) is the original continuous-marquee behaviour. `'flip'` is the post-2018 ESPN BottomLine canon: two rows stacked vertically, each row shows one ticker entry; pair advances every `flipDurationMs` ms (default 4500). v1 ships steady-state pair only — within-window flip animation is a v2 follow-up (`T-356c`).

Schema: `mode?: z.enum(['scroll', 'flip'])`, `flipDurationMs?: z.number().positive()`. Both optional; defaults preserve existing behaviour. Existing bloomberg-ticker golden unchanged (no new props passed).

Unblocks Cluster B preset T-339a `espn-bottomline-flipper`.
