---
title: Clip Element Catalogue
id: skills/stageflip/concepts/clip-elements
tier: concept
status: substantive
last_updated: 2026-04-28
owner_task: T-305
related:
  - skills/stageflip/concepts/runtimes/SKILL.md
  - skills/stageflip/concepts/schema/SKILL.md
---

# Clip Element Catalogue

`Element` is the discriminated union of every shape a slide / video / display
can carry. Three element types specifically carry **motion**:

- `clip` — the generic motion element. Names a registered runtime + a clip
  kind from that runtime's registry. Frame-deterministic and interactive
  runtimes both register clips this way.
- `blender-clip` — the bake-tier element (T-265). Names a built-in scene
  template (`fluid-sim`, `product-render`, `particle-burst`) plus a
  parameter bag, plus a pinned `inputsHash` that addresses the cache.
- `interactive-clip` — the interactive-tier element (T-305). Declares BOTH
  a deterministic `staticFallback` and a live `liveMount`; export pipelines
  route per `resolveClipPath(target, clip)` per ADR-003 §D3.

Every other element type (`text`, `image`, `video`, `audio`, `shape`,
`group`, `chart`, `table`, `embed`, `code`) is structural / static.

## `BlenderClip`

```ts
{
  type: 'blender-clip',
  scene: { template: string, params: Record<string, unknown> },
  duration: { durationMs: number, fps: number },
  inputsHash: string  // sha256 over canonical(scene + duration)
  // ...elementBase fields (id, transform, visible, locked, animations)
}
```

`inputsHash` is the cache key into `bakes/{inputsHash}/frame-{N}.png` per
`docs/architecture.md:330`. The hash is verifiable: given the descriptor,
`computeInputsHash({ scene, duration })` returns the same hash. The submit
handler rejects mismatched hashes with `code: 'inputs-hash-mismatch'`.

See `skills/stageflip/concepts/runtimes/SKILL.md` §"Bake tier (T-265)" for
the full lifecycle.

### Authoring rule

When you add a `BlenderClip` to a document, compute `inputsHash` once and
pin it in the schema. Re-renders with the same hash skip the bake; any
input change produces a new hash and a fresh render.

### Built-in templates (T-265)

| `template` | Purpose | Required params |
|---|---|---|
| `fluid-sim` | Liquid simulations | `viscosity`, `domainSize`, `color` |
| `product-render` | 360° product showcase | `objectAsset` (required), `rotationDegPerSec`, `background` |
| `particle-burst` | Confetti / spark effects | `count`, `color`, `burstStrength` |

Per-template JSON Schemas live in
`services/blender-worker/templates/<name>/params.schema.json`. The set is
closed in v1; adding a template is a follow-up task.

## `InteractiveClip` family (T-305)

Per ADR-003 §D2, the interactive runtime tier is the boundary where the
`§3` determinism rules deliberately do not apply. Every clip in this tier
declares both paths:

```ts
{
  type: 'interactive-clip',
  family: 'shader' | 'three-scene' | 'voice' | 'ai-chat'
        | 'live-data' | 'web-embed' | 'ai-generative',
  staticFallback: Element[],          // non-empty per ADR-003 §D2 invariant
  liveMount: {
    component: { module: '<pkg>#<ClassName>', version?: string },
    props: Record<string, unknown>,   // typed per family in Phase γ
    permissions: ('mic' | 'network' | 'camera')[],
  },
  posterFrame?: number,
  // ...elementBase fields
}
```

The seven frontier families enumerated by ADR-005 §D1:

| Family | Live capability | Static fallback |
|---|---|---|
| `shader` | GLSL fragment shader (frame-deterministic via `uFrame`) | rasterized canonical frame |
| `three-scene` | Three.js scene (seeded PRNG + `tick(frame)`) | rendered still |
| `voice` | Web Audio + MediaRecorder (`mic`) | waveform poster |
| `ai-chat` | Scoped LLM round-trip (`network`) | captured transcript |
| `live-data` | Endpoint fetch + chart (`network`) | last cached value |
| `web-embed` | Sandboxed iframe (`network`) | poster screenshot |
| `ai-generative` | Playback-time prompt → content (`network`) | curated example output |

### Family discriminator (Phase γ)

`liveMount.props` is `Record<string, unknown>` at the contract layer
(T-305). Phase γ tasks narrow per-family with strict-shaped Zod schemas,
dispatched by `family`:

| Family | Schema | Owning task |
|---|---|---|
| `shader` | `shaderClipPropsSchema` (`fragmentShader`, `width`, `height`, `initialUniforms`, `posterFrame`) | T-383 |
| `three-scene` | `threeSceneClipPropsSchema` (`setupRef`, `width`, `height`, `setupProps`, `posterFrame`, `prngSeed`) | T-384 |
| `voice` | `voiceClipPropsSchema` (`mimeType`, `maxDurationMs`, `partialTranscripts`, `language`, `posterFrame`) | T-387 |
| `ai-chat` | `aiChatClipPropsSchema` (`systemPrompt`, `provider`, `model`, `maxTokens`, `temperature`, `multiTurn`, `posterFrame`) | T-389 |
| `live-data` | `liveDataClipPropsSchema` (`endpoint`, `method`, `headers`, `body`, `parseMode`, `refreshTrigger`, `posterFrame`) | T-391 |
| `web-embed` | `webEmbedClipPropsSchema` (`url`, `sandbox`, `allowedOrigins`, `width`, `height`, `posterFrame`) | T-393 |
| `ai-generative` | TBD | T-395+ |

The `posterFrame` field convention introduced by `shader` and
`three-scene` is reused by `voice` for `staticFallback` waveform-poster
sampling (T-388). Future families re-use the same convention; the
field is not lifted into a shared schema (D-T387-11).

The `three-scene` family introduces a new pattern: `setupRef` is a
`<package>#<Symbol>` reference resolved via dynamic `import()` at mount
time. This is the first preset-side use of `componentRefSchema` for a
non-React-component import — three.js scenes are imperative JavaScript
and cannot be serialised inline the way GLSL fragment shaders can. The
regex still requires a PascalCase symbol after `#`.

`check-preset-integrity` invariant 8 dispatches on `family`: when
`family === 'shader'` is declared in raw frontmatter, `liveMount.props`
must parse against `shaderClipPropsSchema` or the gate fails.
Invariant 9 covers `three-scene`; invariant 10 covers `voice` (T-387);
invariant 11 covers `ai-chat` (T-389); invariant 12 covers `live-data`
(T-391); invariant 13 covers `web-embed` (T-393). New families
register an additional dispatch case in the same invariant series —
no new gate per family.

### Static + live duality

The duality is **load-bearing**. ADR-003 §D2 forbids bare-`liveMount` clips:
the `staticFallback.min(1)` Zod refine in `interactiveClipSchema` rejects
them at the type level; `check-preset-integrity` (T-308) re-asserts at CI
time. The static fallback is rendered by frame-runtime for parity-safe
exports; the live mount is the frontier surface.

### Export-matrix routing (ADR-003 §D3)

`resolveClipPath(target: ExportTarget, clip: InteractiveClip)` returns
`'static' | 'live'`:

| Target | Path |
|---|---|
| `mp4` / `image-sequence` / `pptx-flat` / `display-pre-rendered` | `static` |
| `html-slides` / `live-presentation` / `display-interactive` / `on-device-player` | `live` |

The matrix is pinned in `packages/schema/src/clips/export-targets.ts` and
covered by a test that iterates every target. Adding a target is an ADR-003
§D3 amendment plus a coordinated change to every per-target exporter.

### Cross-links

- ADR-003 §D2/§D3/§D4 — the contract this schema enforces.
- ADR-005 §D1 — the seven frontier families.
- T-306 — `packages/runtimes/interactive/` (the runtime tier; T-305 is the
  schema/contract layer it consumes).
- `skills/stageflip/concepts/runtimes/SKILL.md` — runtime-tier overview.

## Cross-links

- `packages/schema/src/elements/blender-clip.ts` — Zod schema.
- `packages/schema/src/clips/interactive.ts` — Zod schema.
- `packages/schema/src/clips/export-targets.ts` — export matrix +
  `resolveClipPath`.
- `packages/schema/src/elements/index.ts` — discriminated union.
- `services/blender-worker/templates/` — built-in scene templates.
