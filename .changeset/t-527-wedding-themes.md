---
'@stageflip/pack-wedding-events': patch
---

T-527 — Wedding & Events Pack: fills the **rustic-theme** placeholder
landed in T-526 with three real substantive theme variants
(`rustic-theme` + `modern-theme` + `classic-theme`) — a single-task
departure from the one-preset-per-task pattern that captures the
wedding-events vertical's canonical theme triptych. All three reuse
the T-183 `LowerThird` primitive (wedding-events cluster has no clip
primitives yet — same cross-cluster-reuse pattern as T-516 + T-526).
Rustic uses warm taupe `#8B7355` + cream + burgundy with 800/600 ms
slow-intimate pacing; modern uses off-white `#FAFAFA` + dark slate +
muted sage with 600/400 ms clean-editorial pacing; classic uses ivory
`#FFFAF0` + champagne gold + black with 1000/800 ms ceremonious
pacing. Manifest's `contributes.presets` grows from 4 → 6 entries
(three substantive theme variants + three remaining placeholders for
T-528 / T-529 / T-530). The rustic-theme-placeholder.md is deleted.
No version bump (T-530 closes the pack at v0.2.0).
