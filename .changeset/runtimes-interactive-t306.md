---
"@stageflip/runtimes-interactive": minor
---

T-306: interactive runtime tier — `@stageflip/runtimes-interactive`.

Initial release. Ships the host package for Phase γ frontier clips
(voice, AI chat, live data, web embed, AI generative, shaders,
three-scene) per ADR-003 §D1. The package is browser-side runtime: it
mounts `liveMount` for HTML / live-presentation / display-interactive /
on-device-player export targets and routes to `staticFallback` when a
permission or tenant-policy gate denies the live path.

Public surface:

- `InteractiveMountHarness.mount(clip, root, signal)` — programmatic
  mount / unmount / dispose. Orchestrates tenant-policy → permission shim
  → registry resolve → factory invocation. `signal.abort` triggers
  idempotent `dispose()`.
- `PermissionShim` — mount-time gate per ADR-003 §D4. `mic` →
  `getUserMedia({audio:true})`. `camera` → `getUserMedia({video:true})`.
  `network` → no-op. Tenant-policy short-circuits BEFORE any browser
  prompt. Per-(session, family) grant cache.
- `interactiveClipRegistry` — module-level singleton. Phase γ clip
  packages register their `ClipFactory` at import time:
  `interactiveClipRegistry.register('shader', shaderFactory)`.
  Re-registration throws `InteractiveClipFamilyAlreadyRegisteredError`.
- `renderStaticFallback(elements, root)` — React 19 root render of the
  canonical-element fallback array.
- `contractTestSuite(factory)` (subpath: `/contract-tests`) — Vitest
  `describe` block every Phase γ family imports + runs against its own
  factory.

`scripts/check-determinism.ts` is amended to exclude
`packages/runtimes/interactive/**` per ADR-003 §D5. The exemption is
narrow — `packages/frame-runtime/`, `packages/runtimes/*/src/clips/**`
(other tiers), and `packages/renderer-core/src/clips/**` remain in scope.
T-309 will add the shader sub-rule that re-applies determinism inside
this tier (uniform-updaters must use `frame` only).
