---
'@stageflip/parity-cli': patch
---

T-336 — Add `cricket-scorebug` preset binding (Cluster B 8th; first production consumer of T-332a's `'cricket'` style branch).

`PRESET_ID_BINDINGS['cricket-scorebug']` → `cricketScorebugBinding` → `score-bug` primitive on `frame-runtime`. New `CRICKET_SCOREBUG_PROPS` export ships the canonical IND vs AUS mid-innings cricket panel snapshot (battingTeam IND `#0066B3` 247/4 in 42.3 overs; bowlingTeam AUS `#FFCD00`; runRate 5.85 + requiredRunRate 6.42; batsmen Kohli on-strike 87/92 + Rahul 34/41; bowler Cummins 2-58; partnership 64 (78); top-center anchor; dark `#0E0E12` base; IBM Plex Sans 600 OFL fallback). `DEFAULT_CLIP_KIND_RESOLVER 'scoreBug'` arm UNCHANGED (T-358 `scoreBugDotsBinding` → outcome-row). All 18 prior `PRESET_ID_BINDINGS` entries UNCHANGED. Closes the T-332a primitive's production-consumer matrix to all 4 styles (`'football'` / `'racing'` / `'cricket'` / `'tennis'`) exercised. T-358 cricket-ball-by-ball-dots stays the clipKind-default `scoreBug` slot — composes externally above/below the dot row at the host level.
