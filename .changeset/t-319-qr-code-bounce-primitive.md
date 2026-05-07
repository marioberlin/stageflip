---
'@stageflip/runtimes-frame-runtime-bridge': patch
---

T-319 — `qr-code-bounce` runtime-clip primitive.

Single-register Cluster G primitive serving the Coinbase Super Bowl
DVD-screensaver QR canon: a square QR-code rectangle traversing a
pure-black canvas with reflective-rebound bounce physics + uniform
rainbow hue cycling across all dark modules. NO platform / register
enum (single Zod `object().strict()` schema — QR is platform-
agnostic), NO font surface (per D-T319-8 — QR has zero text content),
NO phase enum (always-moving / always-cycling). Required props:
`qrMatrix` (square 7×7..177×177 array of `'0'`/`'1'` row strings —
`'1'` = dark module; `.refine()` enforces equal-length rows + square
shape) and `bounce` (`startPosition: { x, y }` + `startVelocity:
{ vx, vy }` px/frame). Optional: `sizePercent` (5..80, default 22),
`colorCycle.palette: 'rainbow'` (sealed in v1) + `colorCycle.
cycleFrames` (default `ceil(fps * 7)` — 7 s mid-range of 6–8 s
canon), `background` (default `'#000000'` zero-brand canon dominates
theme), `lightModuleColor` (default `'#FFFFFF'`, NOT theme-bound to
preserve dark-on-light scannability). Closed-form bounce physics:
`x_t = fold(x0 + vx * t, 2 * (W - rectW))` with reflective edge
rebounds preserving angle of incidence; integer-pixel positions
(`Math.round` at final render). Uniform HSL hue rotation:
`hue(f) = (f % cycleFrames) / cycleFrames * 360`, fixed `s=100%` /
`l=50%`, integer-channel RGB. Frame-deterministic — no `Date.now` /
`Math.random` / `crypto.randomUUID` / `setTimeout` / `setInterval` /
`requestAnimationFrame`. NO SVG instance-IDs in v1. Theme-slot
fallback (`background` → `palette.background` only). Pre-rendered
QR matrix in v1 (live URL→matrix encoding deferred to T-319a;
branded variant with logo overlay T-319b; custom palettes T-319c).
Bridge clip count 54 → 55. Unblocks T-372 (`coinbase-dvd-qr`,
primary v1 consumer). With T-319 merged, all three Cluster G
blocking primitives (T-317 `subscribe-button`, T-318 `follow-
prompt`, T-319 `qr-code-bounce`) are shipped and Cluster G closes.
