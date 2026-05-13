---
'@stageflip/pack-finance': patch
---

T-522 — Earnings & Investor Pack: first substantive preset — the
**earnings-call composition template** (`earnings-call-template`)
replacing the T-521 placeholder slot. UNLIKE the cluster-A / cluster-B /
cluster-F register presets (Sky News / NBA Pro / MKBHD / Vox / LTT)
which key a single brand to a single clipKind for a strip-style
lower-third register, this preset is a **composition template** for a
specific financial-communication USE CASE — the post-earnings
results-announcement video CEOs / IR teams publish after the quarterly
call concludes. **First cluster-finance consumer of BOTH `titleSequence`
AND `lowerThird` primitives** (cross-cluster register reuse — the
cluster-D prestige-TV title compositor T-321 + the cluster-A
broadcaster-strip primitive T-183 rebound from cluster-finance via
`PRESET_ID_BINDINGS['earnings-call-template']` per Pattern C; no new
clipKind, no structural extension to the document or binding model,
just a new cluster-finance preset binding two existing primitives in a
five-shot composition). Five-shot sequence: titleSequence cover slide
+ four lowerThird sub-shots (KPI revenue / CEO commentary / Q&A clip /
forward-guidance footer). Deep institutional-blue `#0F172A` (slate-900)
full-bleed canvas across every shot; Mixed Case serif headline (48 px
cover / 36 px sub-shots; bespoke GT Sectra proprietary-byo + Cormorant
Garamond OFL fallback shared with T-348 / T-349 / T-520); Plus Jakarta
Sans body metrics (28 px KPI / 22 px speaker-tag); forward-guidance
green `#10B981` for positive numerical deltas + brick red `#DC2626` for
negative numerical deltas, with strict SEC Reg FD discipline — color
signaling stays EXCLUSIVELY inside the numerical-metric slot, NEVER on
narrative content. Leisurely pacing per shot (600 ms fade-in
EASE_OUT_QUART → 4400 ms mid-hold → 500 ms fade-out EASE_IN_QUART;
total ~5.5 s/shot) — faster than T-520 prestige-creator (~6.4 s) but
slower than T-517 MKBHD-pro (~3.8 s). No atmospheric companion clips
(clean financial-communication canvas distinguishes the cluster-finance
register from cluster-D prestige-TV registers structurally and visually).
signOff.parityFixture: pending-user-review. Manifest version stays at
0.1.0 (T-525 closes the pack and bumps to 0.2.0 GA). T-523 / T-524 /
T-525 placeholders unchanged.
