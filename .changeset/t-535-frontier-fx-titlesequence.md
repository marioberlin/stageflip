---
'@stageflip/pack-frontier-fx': minor
---

T-535 — Frontier Effects Pack: twelfth through sixteenth substantive
contributions — **five premium TitleSequence templates** binding the
existing T-321 `titleSequence` clip primitive via cross-cluster
register reuse (cluster-I preset binding cluster-D primitive — same
Pattern C used by T-520 prestige-creator), replacing the T-531
`titlesequence-premium-placeholder` slot. Each preset ships a distinct
cinematic title-card register + design spec (palette / typography /
animation pacing / atmospheric overlays) — the underlying titleSequence
primitive is unchanged; T-535 reserves the preset ids + design specs +
binding wiring only. The five presets are:
`titlesequence-noir-cinema` (mid-century film-noir register; deep-black
`#0A0A0A` canvas + gold-leaf `#D4AF37` headline + fine film-grain
atmospheric overlay via the T-348 `overlays?` ClipKindBinding
structural extension; slow contemplative pacing 1200 / 5000 / 1000 ms;
Chinatown / L.A. Confidential / The Big Sleep canon),
`titlesequence-scifi-glow` (sci-fi futurism register; deep-blue
`#0F172A` canvas + cyan `#22D3EE` glow headline with chromatic-
aberration RGB-channel-split shadows + horizontal CRT-scanline overlay
via the T-348 `overlays?` extension; Plus Jakarta Sans grotesque
typography; quick pacing 600 / 4000 / 500 ms; Tron Legacy / Blade
Runner 2049 / Westworld / Devs canon; slightly looser parity thresholds
PSNR ≥ 38 dB / SSIM ≥ 0.97 to accommodate the high-frequency
atmospheric texture), `titlesequence-action-bold` (action / sports-
highlight register; pure-black `#000000` canvas + white extra-bold
weight-900 headline + red `#DC2626` slab bars framing the headline plate
with red tagline beneath; UPPERCASE casing-transform; tightest
letterSpacing `-0.02`; fastest pacing 400 / 3000 / 300 ms with 6-frame
shake-on-entrance; Top Gun Maverick / John Wick / NFL Films canon),
`titlesequence-doc-minimal` (documentary / interview cold-open register;
INVERTED pure-white `#FFFFFF` canvas + black Inter Light-300 headline +
black UPPERCASE wide-tracked tagline; NO accent color, NO decoration,
NO overlays — the minimalism IS the register; PBS Frontline / CBS 60
Minutes / Errol Morris canon), and `titlesequence-trailer-cinematic`
(movie-trailer register; pure-black canvas with 2.35:1 letterbox bars
composed via the T-348 `overlays?` extension + warm cream `#F5F1E8`
heavy-display-serif headline at 84 px / fontWeight 800 + burgundy
`#7F1D1D` UPPERCASE wide-tracked tagline; SLOWEST pacing of the five
~9.2 s total cycle with a 500 ms held-black entrance; Christopher Nolan
/ Denis Villeneuve / Paul Thomas Anderson / A24 trailer canon).

All five declare cluster `cluster-i` and bind `clipKind: titleSequence`
(the T-321 primitive shipped in P13 cluster-D). Reference frame for
parity varies across the five presets to match their pacing envelopes
(frame 60 action-bold, frame 90 sci-fi-glow, frame 120 noir-cinema /
doc-minimal, frame 150 trailer-cinematic). Manifest's
`contributes.presets` count grows from 12 to **16** (5 shaders + 1 3D +
5 reactions + 5 titlesequences). **Manifest version bumped 0.1.0 →
0.2.0** — T-535 carries the v0.2.0 GA bump that closes the Frontier
Effects launch pack AND closes P16 γ entirely (all 30 tasks
T-506..T-535 merged after this). Pack archive directory moved
`packs/stageflip/frontier-fx/0.1.0/` → `packs/stageflip/frontier-fx/
0.2.0/`. Description + keywords updated to mention all 16 substantive
presets + closing-pack v0.2.0 marker; `cinematic` + `title-sequence`
added to keywords.
