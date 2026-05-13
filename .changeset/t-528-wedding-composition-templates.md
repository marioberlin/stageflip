---
'@stageflip/pack-wedding-events': patch
---

T-528 — Wedding & Events Pack: fills the **wedding-composition-templates**
placeholder landed in T-526 with two real substantive composition
templates (`wedding-ceremony-template` + `wedding-reception-template`)
— a single-task departure from the one-preset-per-task pattern, mirroring
T-527's three-themes-in-one-task shape. Both bind cluster-D
`titleSequence` + cluster-A `lowerThird` via `PRESET_ID_BINDINGS` Pattern
C cross-cluster register reuse — same model T-520 prestige-creator
(cluster-F), T-522 earnings-call (cluster-finance), and T-523
investor-deck (cluster-finance) established. wedding-ceremony-template
is a seven-shot ceremony arc (title slide → procession → vows → rings
→ pronouncement → recessional → thank-you card); wedding-reception-template
is a six-shot reception arc (title slide → welcome → toasts → first-dance
→ cake-cutting → send-off). Both run a theme-agnostic visual register
(champagne-ivory `#FFFAF0` canvas + black text + soft-rose `#E5C0C7`
accent + GT Sectra BYO / Cormorant Garamond OFL typography) so the
composition reads correctly when the deploy-time wiring overlays any of
T-527's three theme variants (rustic / modern / classic). Manifest's
`contributes.presets` grows from 6 → 7 entries (three substantive theme
variants + two substantive composition templates + two remaining
placeholders for T-529 wedding-transitions + T-530 audio-bed-library).
The wedding-composition-templates-placeholder.md is deleted. No version
bump (T-530 closes the pack at v0.2.0).
