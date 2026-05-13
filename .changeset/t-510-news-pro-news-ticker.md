---
'@stageflip/pack-news-pro': minor
---

T-510 — News Pro Pack: **closes the pack contributions** by adding the
fourth + final preset, the **Premium News Ticker** (`premium-news-ticker`).
Cluster A `newsTicker` clip; binds T-356b's `mode: 'flip'` flipper register
on the `news-ticker-bar` primitive (second production consumer of
`mode: 'flip'` after T-339a espn-bottomline-flipper). Companion ticker for
the three premium register lower-thirds (Sky T-507, ITV T-508, RAI T-509);
sits at the bottom edge of frame on a `#1A1A1A` dark band; ~5 s cadence
(`flipDurationMs: 5000`); BBC-red `#BB1919` brand-color right cap
(configurable per-deployment); Mixed Case headline body per
European-broadcaster register (NOT UPPERCASE — US-tabloid registers are
deferred to a future T-510a carve-out). Plus Jakarta Sans OFL (matches the
primitive's render-time hard-coded family). Locks in flipper-not-scroll
per the BBC humanist canon documented in `bbc-reith-dark.md` "Rules" §
(comprehension > density). Manifest version bumped 0.1.0 → 0.2.0 (minor;
additive feature — fourth preset closes the pack). Bug-fix: `build-pack.ts`
default outDir is now derived from `MANIFEST_SKELETON.version` instead of
a hard-coded `0.1.0/` literal, so the default output directory tracks the
manifest version automatically on each version bump.
