---
id: al-jazeera-orange
cluster: news
clipKind: lowerThird
source: docs/compass_artifact.md#al-jazeera-english
status: stub
preferredFont:
  family: Al Jazeera bilingual custom (Tarek Atrissi)
  license: proprietary-byo
fallbackFont:
  family: DIN 2014 (Latin) + Amiri (Arabic)
  weight: 600
  license: ofl
permissions: []
signOff:
  parityFixture: pending-user-review
  typeDesign: pending-cluster-batch
---

# Al Jazeera Orange — lower third

## Visual tokens
- Banner: light / white `#F7F7F5` fill
- Accent: orange/amber gradient `#F7941D` → `#E87722`, left strip or accent bar
- Text: dark `#222222`
- Extended width to accommodate bilingual text (Arabic + Latin)
- Background may include subtle kraft-paper or textured finish for TV-only variants

## Typography
- Headline: rounded geometric sans-serif (DIN-like fallback), Bold / Medium, 28–32 pt
- Subtitle: Regular, 20–24 pt
- Arabic companion (right-to-left): Amiri fallback, Regular, matched to Latin x-height
- Show titles and breaking: ALL CAPS

## Animation
- Entry: slide in L→R with animated orange accent bar leading, 500 ms
- Arabic and Latin text reveal in parallel, not sequentially
- Static hold with occasional data-driven updates via `LiveDataClip` when tenant has frontier enabled
- Exit: reverse slide R←L, 500 ms

## Rules
- Bilingual is the signature — always include the Arabic companion unless the tenant explicitly targets an Arabic-muted surface.
- Orange is the differentiator vs. Western networks' cool blues. Do not substitute a warm-red or yellow for "warmer."
- Typography fallback must preserve both a rounded-geometric Latin and a matched-x-height Arabic; if the fallback fails either, escalate.

## Acceptance (parity)
- Reference frames: 0 (accent enters), 16 (bar settled), 32 (bilingual text resolved), 60 (steady)
- PSNR ≥ 40 dB, SSIM ≥ 0.96 (slightly relaxed for bilingual kerning variance across fallback fonts)

## References
- `docs/compass_artifact.md` § Al Jazeera English, § Al Jazeera (News section)
- ADR-004
