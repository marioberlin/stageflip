---
'@stageflip/parity-cli': patch
---

T-338 — preset(sports) masters-red-under-par substantive (Cluster B 6th; first standings PRESET_ID_BINDINGS override)

Sixth Cluster B preset; second `standings` clipKind consumer via
`PRESET_ID_BINDINGS['masters-red-under-par']` (Pattern C — first
`standings`-keyed override after T-357 olympic-medal-tracker holds the
clipKind-default slot). Canonical Masters mid-round leaderboard:
Scheffler / McIlroy / Schauffele / Spieth / Bryson 5-row top-5 stack
with numeric score-to-par + thru-hole encoding; Augusta National green
`#006747` accent on the rank column (theme-slot mapping); dark broadcast
base `#0E0E12`; white text; Inter 600 OFL fallback for proprietary CBS
Sports custom face. Per-cell red/black/green canonical color semantic
deferred (primitive supports column-level color only); position-change
row-slide + birdie-flash + score count-up + full-screen scroll all
deferred. New exported `MASTERS_PROPS` constant + `mastersRedUnderParBinding`
+ 17th `PRESET_ID_BINDINGS` entry. `DEFAULT_CLIP_KIND_RESOLVER` + all 16
prior bindings UNCHANGED.
