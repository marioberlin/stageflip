---
'@stageflip/app-slide': minor
'@stageflip/editor-shell': minor
---

T-134 — StageFlip.Slide branding pass. Abyssal Clarity preserved.

- `apps/stageflip-slide/src/app/globals.css` gains the full Abyssal
  Clarity design-token set as CSS custom properties (`--ac-bg`,
  `--ac-surface-low`, `--ac-primary-gradient`, `--ac-accent`,
  `--ac-border-subtle`, `--ac-radius-*`, `--ac-font-*`, etc.). Existing
  inline-hex-using components are left untouched; future edits should
  swap the literals for `var(--ac-*)` references.
- `<Logo>` component (new) — brand + mode wordmark with a 24×24 SVG
  mark using the primary gradient. Renders in the editor header above
  the document title.
- `layout.tsx` metadata is now the full product string.
- New i18n keys: `slide.tagline`, `slide.productName`.

Zero changes to behavior — tests unchanged, just more surface covered.
