---
'@stageflip/runtimes-frame-runtime-bridge': patch
---

T-322a — LyricsClip rendering bugs (karaoke-wipe width, line overflow,
line 3 missing, glow halo) (unblocks T-367).

Surgical render-fix patch on `lyrics.tsx`. Four independent bugs found
during T-367 (`karaoke-progressive-wipe`) parity review at frame 105
(mid-line2, 40% wipe progress, three-line stack):

1. **Karaoke-wipe `<rect>` width.** Was `width={karaokeProgress * 100}`
   — SVG reads unitless numbers as user-space px, so a 0.40-progress
   wipe rendered 40 px wide instead of 40% of the line region. Now
   `width={\`${karaokeProgress * 100}%\`}` and `height="100%"` for
   symmetry (D-T322a-1).
2. **Line overflow at default font.** A 25-char line at the prior
   `DEFAULT_FONT.size: 96` ran ~1250 px wide and clipped a 1024-px
   position region under `whiteSpace: 'nowrap'`. Reduced to 64 — same
   line ~800 px, fits the region (D-T322a-2).
3. **Line 3 missing in 3-line stacks.** `computeLineEntrance` derives
   `entranceStartFrame` from each line's `startMs`; for a future-
   startMs preview line, `interpolate` clamped left → opacity 0 →
   "missing." Now bypassed for `entry.role !== 'active'`; only the
   active line plays the entrance (D-T322a-3).
4. **Glow halo invisible.** The `<filter>` emitted only
   `<feGaussianBlur>` + `<feFlood>`, with no compositing. Added the
   standard SVG glow recipe — `<feComposite operator="in">` joins the
   flood to the blurred alpha, `<feMerge>` lays the colored blur under
   the source graphic (D-T322a-4).

Stable line-index-derived clipPath / filter IDs unchanged. Schema,
theme slots, registry, and `ALL_BRIDGE_CLIPS` count (49) unchanged.
T-322's existing render contracts (other styles, casing, entrance
timing for active line, theme slots) preserved — five new vitest
regression cases on top of the existing 19 (24 pass total). Same
pattern as T-316a → T-365 retry; T-367 retries unchanged after this
lands.
