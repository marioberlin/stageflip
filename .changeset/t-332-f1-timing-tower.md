---
'@stageflip/parity-cli': patch
---

T-332 — Add `f1-timing-tower` preset binding (Cluster B 7th; first production consumer of T-332a's `'racing'` style branch).

`PRESET_ID_BINDINGS['f1-timing-tower']` → `f1TimingTowerBinding` → `score-bug` primitive on `frame-runtime`. New `F1_TIMING_TOWER_PROPS` export ships the canonical 2024 mid-session F1 timing tower snapshot (20 rows, top-10 with full sector / tire data, bottom-10 minimal). `DEFAULT_CLIP_KIND_RESOLVER 'scoreBug'` arm UNCHANGED (T-358 cricket scoreBugDotsBinding). All 17 prior `PRESET_ID_BINDINGS` entries UNCHANGED. Closes the T-332a primitive's production-consumer matrix to all 4 styles (`'football'` / `'racing'` / `'cricket'` / `'tennis'`) exercised.
