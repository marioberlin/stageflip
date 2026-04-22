---
'@stageflip/runtimes-frame-runtime-bridge': minor
'@stageflip/cdp-host-bundle': minor
---

T-131f.1 — bridge standalones not covered by T-131b. Audit-driven
catch-up after T-131c confirmation: `reference/.../clips/registry.ts`
has 32 clips total; T-131b family covers 14, T-131d.1 covers 2,
deferred T-131d.2/.3/.4 + T-131e cover 7. The remaining 9 split into
this PR's 4 standalones plus T-131f.2 (5 dashboards) and T-131f.3
(financial-statement composite).

Clips landed:
- `code-block` — own minimal language tokeniser (typescript /
  javascript / python / bash / json) + line-by-line stagger reveal.
  Intentionally fixed editor look (One-Dark-derived); no themeSlots.
- `image-gallery` — crossfade slideshow with optional captions; last
  image stays visible past end of cycle.
- `timeline-milestones` — horizontal axis with sweeping progress dot
  + per-milestone spring "pop"; labels alternate above / below the
  axis for readability.
- `audio-visualizer` — simulated bar / wave / circular visualization
  driven by deterministic sin/cos. **No-audio path only**: real-audio
  reactive variant (T-131f.4) defers because reference imports
  Remotion's `<Audio>` component, which is forbidden per CLAUDE.md §3.

`ALL_BRIDGE_CLIPS` now exposes 20 clips (b.1 + b.2 + b.3 + d.1 + f.1).
cdp-host-bundle picks them up automatically through the existing
barrel registration; the runtimes test verifies all 20 kinds resolve.
Parity fixtures land for each. KNOWN_KINDS allowlist extended.
