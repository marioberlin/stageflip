---
"@stageflip/runtimes-gsap": minor
---

Initial gsap runtime (T-063). First runtime that wraps a non-React
animation library.

Exports:

- `defineGsapClip<P>({ kind, render, build, fontRequirements? })` —
  adapts a GSAP-driven clip. `render(props)` returns the DOM; the
  host mounts it inside a container div. `build(props, timeline,
  container)` runs once on mount with a **paused** `gsap.core.Timeline`;
  clip authors configure tweens there. The host seeks the timeline
  to `localFrame / fps` on every render — never calls `play()`, so
  the GSAP ticker never advances our animations.
- `createGsapRuntime(clips?)` — builds the `ClipRuntime` (`id: 'gsap'`,
  `tier: 'live'`). Duplicate kinds throw.
- `motionTextGsap` — canonical demo clip (kind `motion-text-gsap`).
  Slide-up (default) or fade entrance configurable via props; used as
  the T-067 parity fixture seed.

Determinism: clip code under `src/clips/**` is scanned by
`check-determinism`; GSAP is consumed exclusively via seek on a
paused timeline, matching the deterministic-export posture required
by Invariant I-2.

License: GSAP ships a URL-form license; an entry in
`REVIEWED_OK` (scripts/check-licenses.ts) pairs with the existing
Business Green procurement. See `docs/dependencies.md` §4 Audit 5
addendum for the follow-up flagged for Phase 10 publish gating.
