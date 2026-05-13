---
'@stageflip/pack-sports-networks': patch
---

T-512 — Sports Networks Pack: fills the **NBA Pro register** placeholder
landed in T-511 with a real substantive preset (`nba-pro-register`).
Cluster B `scoreBug` clip (`'football'` style branch); NBA logo red
`#C8102E` home box + NBA logo deep blue `#17408B` away box on a dark
`#1A1A1A` base bar; UPPERCASE 3-letter team codes (`LAL` / `BOS`),
tabular score digits + `Q3` quarter token; bottom-center anchor matching
the T-334 / T-335 scoring-strip norm; BYO NBA Sans family + Inter
Display 700 OFL fallback honored at render time (`score-bug` primitive
honors `props.font` unlike the hard-coded-family `lower-third`).
Manifest's `contributes.presets[0]` updated; pack version unchanged
(0.1.0) per T-515 GA bump. NFL Pro (T-513) / MLB (T-514) / F1 Pro
(T-515) still placeholders.
