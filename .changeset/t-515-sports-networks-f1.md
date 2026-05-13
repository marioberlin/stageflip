---
'@stageflip/pack-sports-networks': minor
---

T-515 — Sports Networks Pack: **closes the pack contributions** by
filling the fourth + final register placeholder with a real substantive
F1 Pro register (`f1-pro-register`) AND adding the AR-formations bundle
integration as a fifth preset (`f1-ar-grid-lineup`). Cluster B
`scoreBug` clip reuses the existing `'racing'` style branch (the
network-neutral 5-driver top-of-tower register; complement to T-332's
20-driver deep timing-tower); F1 brand red `#E10600` modern logo red
accent + carbon-modern dark `#15151E` base + white text foreground;
UPPERCASE 3-letter FIA driver codes (`HAM` / `VER` / `NOR` / `LEC` /
`SAI`); broadcast-canon 3-decimal gap times (`LEADER` / `+0.124`...);
top-left tower anchor matching T-332 F1 Timing Tower; 300 ms slide-in /
200 ms slide-out matching F1's faster broadcast pace; BYO Formula1
Display Bold proprietary family + Barlow Condensed 700 OFL fallback.
F1 AR Grid Lineup preset (`f1-ar-grid-lineup`) binds the T-375a
`arOverlay` primitive (second production consumer after T-375
sky-sports-ar-formations) — v1 ships **static-fallback rendering ONLY**
per D-T375a-2 (live 3D 20-car grid rendering gated on Track A finale
T-397+; T-515a-live-mount carve-out wires the integration once T-397+
lands). Manifest's `contributes.presets[3]` updated +
`contributes.presets[4]` appended; version bumped 0.1.0 → 0.2.0 (minor;
additive feature — fills the F1 Pro register placeholder + adds the AR
grid-lineup integration). Pack archive will move from
`packs/stageflip/sports-networks/0.1.0/` → `0.2.0/` on orchestrator
rebuild via the version-derived outDir from T-510's build-pack fix.
After this PR the Sports Networks pack is feature-complete at GA.
