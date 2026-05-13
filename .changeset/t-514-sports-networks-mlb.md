---
'@stageflip/pack-sports-networks': patch
---

T-514 — Sports Networks Pack: fills the **MLB register** placeholder
landed in T-511 with a real substantive preset (`mlb-register`).
Cluster B `scoreBug` clip (reuses `'football'` style branch; no
`'baseball'` style branch exists in the primitive); MLB logo deep blue
`#002D72` home box + MLB logo red `#D50032` away box on a dark `#1A1A1A`
base bar; UPPERCASE 2-3-letter team codes (`NYY` / `BOS`); `9TH` inning
ordinal + MLB-specific `TOP 7` inning-half token (repurposes the
`'football'` branch's optional `down` prop — `z.string().optional()`
accepts the arbitrary string); bottom-center anchor matching the T-334
/ T-335 / T-512 / T-513 scoring-strip norm; BYO MLB Tuscan family +
Inter Display 700 OFL fallback honored at render time. Diamond/bases
indicator + silhouette-batter logo glyph documented as Trade-offs
(deferred to T-332b primitive-level follow-ups). Manifest's
`contributes.presets[2]` updated; pack version unchanged (0.1.0) per
T-515 GA bump. F1 Pro (T-515) still placeholder.
