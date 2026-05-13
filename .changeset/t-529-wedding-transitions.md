---
'@stageflip/pack-wedding-events': patch
---

T-529 — Wedding & Events Pack: fills the **wedding-transitions**
placeholder landed in T-526 with four real substantive presets — two
between-shot transitions (`petal-cross-fade-transition` 800 ms
cross-fade with soft-rose petal-overlay motif for tender-moment
bridges; `lace-wipe-transition` 1200 ms diagonal NW-SE wipe with
soft-rose lace-band edge mask for formal-section bridges) and two
standalone bumper cards (`wedding-bumper-card` 3-second full-frame
mid-section pivot card with `'Reception'` / `'Toasts'` / etc.
headline + soft-rose lace-trim divider; `wedding-final-card`
5-second full-frame outro thank-you card with `'Thank You'` headline
+ soft-rose punctuation dot + couple-signature tagline). The two
bumpers bind cluster-D `titleSequence` via `PRESET_ID_BINDINGS`
Pattern C cross-cluster register reuse (same model T-520
prestige-creator / T-522 earnings-call / T-523 investor-deck / T-528
wedding-ceremony + wedding-reception established); the two transitions
forward-reference a candidate `transition` clipKind that does NOT yet
exist in the workspace today — T-529 reserves the preset slots with
documented compass posture; the primitive-level wiring is downstream
under a candidate `T-529z`-family follow-up. All four presets run a
theme-agnostic visual register (champagne-ivory `#FFFAF0` canvas +
black text + soft-rose `#E5C0C7` accent + GT Sectra BYO / Cormorant
Garamond OFL typography) so they thread correctly when the
deploy-time wiring overlays any of T-527's three theme variants
(rustic / modern / classic). Manifest's `contributes.presets` grows
from 7 → 10 entries (three substantive theme variants + two
substantive composition templates + four substantive transition /
bumper presets + one remaining placeholder for T-530
audio-bed-library). The wedding-transitions-placeholder.md is
deleted. No version bump (T-530 closes the pack at v0.2.0).
