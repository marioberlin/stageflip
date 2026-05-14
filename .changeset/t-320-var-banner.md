---
'@stageflip/runtimes-frame-runtime-bridge': minor
---

Add `var-banner` clip primitive: sports VAR/refereeing-decision overlay (T-320).

Two-stage entrance: pending "VAR CHECK" register with animated dot-loader for the first `pendingDurationFrames` (default 30) frames, then horizontal slide-in of the canon-bound decision label per a sealed `decision` enum (`'goal-confirmed' | 'goal-disallowed' | 'penalty-awarded' | 'no-foul'`). Each decision auto-derives its register colour (overridable via `accentColor`). Frame-deterministic. Unblocks Cluster B sports presets needing the VAR sub-type.
