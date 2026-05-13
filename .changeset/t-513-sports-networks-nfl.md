---
'@stageflip/pack-sports-networks': patch
---

T-513 — Sports Networks Pack: fills the **NFL Pro register** placeholder
landed in T-511 with a real substantive preset (`nfl-pro-register`).
Cluster B `scoreBug` clip (`'football'` style branch); NFL logo deep blue
`#013369` home box + NFL logo red `#D50A0A` away box on a dark `#1A1A1A`
base bar; UPPERCASE 3-letter team codes (`DAL` / `NYG`); `Q3` quarter
token + NFL-specific `3rd & 4` down-and-distance row (wires the
`'football'` branch's optional `down` prop the NBA register left empty);
bottom-center anchor matching the T-334 / T-335 / T-512 scoring-strip
norm; BYO NFL Sans family + Inter Display 700 OFL fallback honored at
render time. Manifest's `contributes.presets[1]` updated; pack version
unchanged (0.1.0) per T-515 GA bump. MLB (T-514) / F1 Pro (T-515) still
placeholders.
