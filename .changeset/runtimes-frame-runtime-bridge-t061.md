---
"@stageflip/runtimes-frame-runtime-bridge": minor
---

Initial frame-runtime bridge (T-061). Adapts
`@stageflip/frame-runtime` to the `ClipRuntime` contract from T-060.

Exports:

- `defineFrameClip<P>({ kind, component, fontRequirements? })` — wraps
  a React component that uses `useCurrentFrame` / `useVideoConfig`
  into a `ClipDefinition<unknown>`. The produced render gates on the
  clip window, remaps `frame` to `frame - clipFrom` (local time
  starting at 0), and exposes `clipDurationInFrames` as
  `useVideoConfig().durationInFrames`.
- `createFrameRuntimeBridge(clips?)` — builds the `ClipRuntime`
  (`id: 'frame-runtime'`, `tier: 'live'`). Duplicate kinds throw.
  Register with `registerRuntime(bridge)` at app boot.
