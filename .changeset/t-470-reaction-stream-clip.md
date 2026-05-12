---
'@stageflip/schema': minor
'@stageflip/runtimes-audience': minor
'@stageflip/app-audience-join': minor
'@stageflip/rir': patch
'@stageflip/export-pptx': patch
---

T-470 — `ReactionStreamClip` family. Tenth audience-clip variant on
disk; the SECOND marquee differentiator (per ADR-010 §D1 + §D7):
emoji particle storm rendered via the T-383 ShaderClip primitive —
a category that Slido / Mentimeter / Poll Everywhere / Vevox /
Wooclap structurally cannot reach.

Voters tap emoji buttons (one per `clip.props.palette` entry); the
server aggregates per-emoji `count` + `recentBurst`; the renderer
drives a fragment shader that emits per-emoji coloured particles
whose density scales with `recentBurst / 10` (the per-voter 10 Hz
override per ADR-009 §D3 line 231). NO client-side disable —
multi-tap is permitted; server-side rate-limit bounds spam.

Schema-side `reaction-stream` variant ships `{ prompt, palette
(1..12 `{ emojiId, glyph }` entries), sessionId? }`. The upper
palette bound matches the fragment shader's compile-time loop bound
(`REACTION_STREAM_MAX_PALETTE = 12`). `ELEMENT_TYPES` bumped 22 → 23.

Audience runtime ships:
- a new pure helper `computeReactionStreamUniforms(emojiCounts,
  palette, localFrame, fps): ReactionStreamUniforms` that produces a
  byte-identical `Float32Array` density buffer for identical inputs
  (the determinism perimeter — PRIMARY §13 evidence);
- the `REACTION_STREAM_FRAGMENT` GLSL source declaring
  `precision highp float;` (T-065 invariant) and using compile-time
  constant loop bounds (GLSL ES 1.0 requirement);
- a static-fallback render path that mounts `<ShaderClipHost>` from
  `@stageflip/runtimes-shader` configured with the fragment + the
  computed uniforms;
- a three-state factory (live / staticFallback / empty-live-mount)
  matching T-461..T-469;
- module-load auto-registration into `audienceClipRegistry`,
  `staticFallbackRenderer`, and `audienceRuntime`.

Voter UI: row of emoji buttons (`apps/audience-join` ships
`<ReactionStreamVoterInput>`); each button emits `{ kind:
'reaction-stream', emojiId }`. Voter dispatcher registry size 9 → 10.

§13 (structural-extension end-to-end verification): option 1 —
`render-e2e.test.ts` drives the static-fallback with the spec
snapshot (3 emoji, 94 reactions) and asserts on observable DOM
(`<canvas>` present + non-zero dims; prompt + total label),
validates the fragment shader against the T-065 explicit-precision
gate, and re-asserts the uniform-determinism property at the
integration boundary. The WebGL pixel-bucket assertion is
best-effort (skipped + documented when WebGL is unavailable, e.g.
happy-dom); the byte-identical uniform buffer is the primary §13
evidence per the spec.

Cross-package switches updated:
- `packages/rir/src/compile/index.ts` — RIR lowering case
  (`runtime: 'audience'`, `clipName: 'reaction-stream'`).
- `packages/export-pptx/src/parts/{slide,template-elements}.ts` —
  fallthrough into the existing unsupported-element loss-flag path
  pending a downstream renderer task.

CI gates green: typecheck, lint, test, check-licenses,
check-remotion-imports, check-determinism, check-skill-drift,
check-audience-permissions reports "10 audience clips inspected",
gen:tool-skills:check, skills-sync.

Out of scope: per-emoji texture asset loading (palette glyphs are
rendered in-shader via deterministic colour assignment; texture
upload deferred), editor-side palette picker UI (authoring flow),
voter→canvas emoji-flight animation, 3D scene reactions, other clip
families (T-471), Cluster I parity fixtures (T-476), native provider
(T-478), vendor adapters (none per ADR-010 §D7).
