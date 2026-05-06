---
'@stageflip/runtimes-frame-runtime-bridge': patch
---

T-183z — `LowerThird` primitive supports `noFlag` / `subtitleColor` /
`font` props.

Bundles the three documented cosmetic divergences flagged by every
Cluster A preset shipped this session (T-323 cnn-classic / T-325
bbc-reith-dark / T-326 al-jazeera-orange — D-T323-3/-5/-13,
D-T325-12 a/b/c, D-T326-12 a/b/c). All three new props are additive
optional axes; defaults preserve existing behavior so no
parity-golden bytes change.

- `noFlag: boolean` — hides the 6 px-wide accent strip on the left
  edge. Unblocks T-329 netflix-doc-lt and T-330 apple-tv-lt
  minimalist registers.
- `subtitleColor: string` — overrides the hard-bound accent-as-
  subtitle-color on the title subline (independent talent-line color).
- `font: { family, weight? }` — overrides the hard-coded
  `'Plus Jakarta Sans, sans-serif'` family with an optional uniform
  weight applied to both name and title elements (when `weight`
  absent, the primitive's defaults — 700 for name, 500 for title —
  are preserved).

Schema is `.strict()`; new props are all optional. Existing test
contracts (entrance / hold / exit timing, theme slots, registry
shape) preserved — 15 new vitest cases on top of the existing 10
(25 pass total).
