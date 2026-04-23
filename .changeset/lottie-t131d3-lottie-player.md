---
'@stageflip/runtimes-lottie': minor
---

T-131d.3 — `lottie-player` clip, prop-driven Lottie playback.

- Accepts `animationData` (object or JSON string) as a render-time
  prop, not at define time. Reuses `LottieClipHost` so the
  determinism posture (`autoplay:false` + `goToAndStop(ms, false)`)
  is identical to `lottie-logo`.
- URL fetching is deliberately not supported inside the clip — the
  reference clip's `fetch()` path violates our determinism scope for
  `packages/runtimes/**/src/clips/**`. Deck authors resolve URLs
  outside the clip and hand the decoded JSON in.
- Falls back to an animated placeholder (three concentric pulsing
  rings) when no data is provided. Ring scale/opacity are pure
  functions of the clip-local frame — no wall-clock APIs.
- `themeSlots`: `backgroundColor` → `palette.background`.
- Hand-rolled `ClipDefinition` rather than extending `defineLottieClip`
  (which bakes `animationData` at define time).
- `LottieClipHost` now exported for advanced consumers.
- Adds `zod@3.25.76` as a runtime dependency (for `propsSchema`).

Registered in `cdp-host-bundle`; clip-count test + `KNOWN_KINDS` +
parity fixture all updated.

Closes T-131d.3.
