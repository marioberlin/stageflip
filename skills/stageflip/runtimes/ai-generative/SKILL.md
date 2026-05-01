---
title: AI Generative Runtime
id: skills/stageflip/runtimes/ai-generative
tier: runtime
status: substantive
last_updated: 2026-05-01
owner_task: T-396
related:
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/runtimes/ai-chat/SKILL.md
  - skills/stageflip/runtimes/live-data/SKILL.md
  - skills/stageflip/runtimes/web-embed/SKILL.md
  - skills/stageflip/concepts/runtimes/SKILL.md
  - skills/stageflip/concepts/clip-elements/SKILL.md
  - skills/stageflip/concepts/auth/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
---

# AI Generative Runtime

`@stageflip/runtimes-interactive/clips/ai-generative` ships the
**fifth and final** γ-live family. Standalone interactive-tier clip
— no §3 runtime to reuse, no frame-source dependency, no convergence
test. At mount time the factory feeds `liveMount.props.prompt` to a
host-injected `AiGenerativeProvider`, awaits the generated artifact
(a `Blob` + `contentType`), and renders it into a single `<img>`
element under the supplied root.

`liveMount` lands here (T-395). `staticFallback` (curated example
output rendered as `ImageElement`) ships in T-396 — both halves of
`family: 'ai-generative'` are now structurally complete. **All five
γ-live family pairs ship; Phase 13 γ-live coverage is closed.**

**v1 is image-only.** Audio / video / 3D modalities are deferred to
a future task (the schema has no `modality` field; adding one when
a second modality lands is a non-breaking change). ADR-006 (Phase 14)
covers the authoring-time asset-generation counterpart (frozen
files); T-395/T-396 are the playback-time counterpart.

## When to reach for it

- A presentation that wants a fresh visual at mount time —
  generated cover art for a slide, illustration for a topic,
  per-prompt example for a demo.
- An interactive teaching surface that demonstrates generative-AI
  output for a chosen prompt.
- Any presentation where the artifact MUST regenerate on demand
  (host-driven `regenerate()`).

## When NOT

- Frozen / pre-baked assets. Use Phase 14 (ADR-006) authoring-time
  generation — the result lands in storage and is consumed by
  ordinary `MediaElement` schema slots. Generative-at-mount-time
  costs tokens / API quota every time the slide is shown.
- Streaming partial results (DALL-E preview-frame). T-395 is
  request/response only; streaming is a future task with its own
  seam (closer to T-389's `LLMChatProvider.streamTurn`).
- Authenticated providers whose credentials must be in the schema.
  Auth is the host's responsibility — the host's `Generator`
  adapter injects credentials at request time (ADR-005 §D7).

## Architecture

The factory is event-driven; nothing here ticks on a frame. The
mount-harness security model still applies:

```
harness.mount(aiGenerativeClip, root, signal):
  1. permissionShim.mount(clip)         # 'network' → no-op grant in v1
       → tenant-denied: render staticFallback (T-396 once on main)
  2. registry.resolve('ai-generative')  # registered at subpath import time
  3. factory(MountContext)              # builds <img> + handle
  4. signal.abort → handle.dispose()    # idempotent teardown
```

The factory returns an `AiGenerativeClipMountHandle`:

```ts
interface AiGenerativeClipMountHandle extends MountHandle {
  regenerate(): Promise<void>;
  getResult(): { blob: Blob; contentType: string } | undefined;
  onResult(handler: (e: ResultEvent) => void): () => void;
  onError(handler: (e: ErrorEvent) => void): () => void;
}
```

The mount-time generation is deferred via `queueMicrotask` so callers
can subscribe `onResult` / `onError` after the factory's promise
resolves but before the generation settles. Without the deferral the
very first resolution races subscriber attachment. Same pattern as
T-391 / T-394.

`regenerate()` aborts any in-flight generation, then runs a fresh
`generateOnce` via the provider. Returns when the generation settles.

### Visual surface

A single `<img>` element, no React tree (same posture as T-393
WebEmbed). On generation resolve, the factory sets `img.src` to
`URL.createObjectURL(blob)`:

```html
<img
  data-stageflip-ai-generative-clip="true"
  width="1024"
  height="1024"
  src="blob:..."
/>
```

Sized via `width` / `height` attributes (props overrides, then clip
transform fallback). Hosts that want overlay UI compose at the
application layer.

### Schema (`aiGenerativeClipPropsSchema`)

```ts
aiGenerativeClipPropsSchema = z.object({
  prompt: z.string().min(1),                        // baked-in, per-clip identity
  provider: z.string().min(1),                      // 'openai' | 'stability' | tenant-supplied
  model: z.string().min(1),                         // 'dall-e-3' | 'stable-diffusion-xl' | ...
  negativePrompt: z.string().optional(),            // provider-specific support
  seed: z.number().int().optional(),                // provider-specific support
  width: z.number().int().positive().optional(),    // defaults to clip transform
  height: z.number().int().positive().optional(),
  posterFrame: z.number().int().nonnegative().default(0),
}).strict();
```

**No `modality` field in v1.** A single-value enum has no purpose.
Adding the field later (e.g.
`z.enum(['image', 'audio', ...]).default('image')`) is a non-breaking
change for existing fixtures.

`prompt` is the clip's identity — empty rejects. `provider` accepts
any non-empty string so tenant-supplied adapters extend without a
schema bump. `negativePrompt` and `seed` are forwarded verbatim;
providers that don't honour them ignore them. `width` / `height` are
optional positive integers; default to the clip transform's
dimensions (some providers require specific values like DALL-E's
256/512/1024 squares — the host's adapter is responsible for
validation/quantisation). `posterFrame` follows the convention
established by all six prior families; T-396 consumes it.

### Permissions (`['network']`)

The clip declares `permissions: ['network']`. The shim treats
`network` as a no-op grant in v1 (ADR-003 §D6 follow-up adds tenant
allowlists later). **Pre-prompt is OFF by default** for `network`-
only clips — same posture as AiChat / LiveData / WebEmbed — the
no-op grant short-circuits without a user-visible browser dialog so
a pre-prompt would be redundant. Hosts CAN opt in via
`MountContext.permissionPrePrompt: true` if they want to gate
generation behind an in-app explanation modal.

### `componentRef.module` resolution

```
@stageflip/runtimes-interactive/clips/ai-generative#AiGenerativeClip
```

The subpath export points at
`packages/runtimes/interactive/src/clips/ai-generative/index.ts`,
whose import side-effect registers `aiGenerativeClipFactory` against
`interactiveClipRegistry`. T-395 does NOT register a static-fallback
generator — T-396 lands that registration alongside
`defaultAiGenerativeStaticFallback`.

## AiGenerativeProvider seam

```ts
interface AiGenerativeProvider {
  generateOnce(args: {
    prompt: string;
    negativePrompt?: string;
    model: string;
    width?: number;
    height?: number;
    seed?: number;
    signal: AbortSignal;
  }): Promise<{ blob: Blob; contentType: string }>;
}
```

T-395 ships two implementations:

1. **`HostInjectedAiGenerativeProvider({ generator })`** — wraps a
   host-supplied `Generator` callable. The host's adapter is the
   seam where provider SDKs (OpenAI / Stability / Replicate) /
   API tokens / tenant moderation live. The clip directory **NEVER**
   references `globalThis.fetch` directly per CLAUDE.md §3 (T-395
   AC #26 grep-pinned). Same posture AiChat (T-389) / LiveData
   (T-391) use.
2. **`InMemoryAiGenerativeProvider({ scripted })`** — resolves a
   scripted `Record<prompt, ScriptedResult>`. Used by tests;
   production code never instantiates. Honours an already-aborted
   signal with an `AbortError`-named Error.

A `@stageflip/ai-generative-abstraction` package mirroring
`@stageflip/llm-abstraction` is a **future asset-gen task** —
Phase 14 ADR-006 covers the pattern. T-395 ships only the seam.

### Why no default real provider?

CLAUDE.md §3 forbids `fetch()` / `XMLHttpRequest` /
`navigator.sendBeacon` inside `packages/runtimes/**/src/clips/**`.
The host-injected `Generator` pattern is the cleanest way to honour
this: the clip code never touches the global; the host (or an
upstream abstraction package) does. This mirrors AiChat's posture
exactly.

### contentType pass-through

Real generative SDKs sometimes return non-`image/*` content types
(DALL-E may return `application/octet-stream`; Stable Diffusion
APIs vary). The factory does NOT validate `contentType.startsWith
('image/')` — it passes the value through to telemetry and to
`URL.createObjectURL(blob)`. If the browser cannot render the
artifact as an image, it shows a broken-image icon. The
`contentType` attribute on `generate.resolved` lets observability
detect this. Hosts that need stricter behaviour wrap their
`Generator` with validation (the documented escalation option (c) —
per-provider adapter coercion in the host).

## Resource cleanup contract (D-T395-7)

`MountHandle.dispose()` MUST tear down — in this order:

1. `AbortController.abort()` on the active per-generation
   controller (if a generation is in flight). The provider's
   `signal`-aware path surfaces the rejection.
2. **`URL.revokeObjectURL` on the active blob URL.** The blob URL
   is a hidden GC root not handled by ordinary DOM teardown —
   without revocation the browser holds the blob indefinitely
   (~200KB per regenerate × N clips × M slides = unbounded growth).
   This is the architectural floor for T-395; AC #15 pins both
   `createObjectURL` and `revokeObjectURL` calls so a future
   refactor that drops one fails loudly.
3. Drop the resolved-result reference (`state.latestResult =
   undefined`).
4. Unsubscribe all `onResult` and `onError` handlers.
5. Detach the `<img>` element from the root
   (`img.parentNode.removeChild(img)`).
6. Emit `ai-generative-clip.dispose`.

`signal.abort` triggers the SAME path. `dispose` is idempotent —
calling twice (or N times) is a no-op (the second-call exit short-
circuits at `state.disposed`).

A leaked generation costs the host's API quota — measurable cost.
A leaked blob URL leaks browser memory. Both are pinned in tests.

## Telemetry (privacy posture — D-T395-8)

The factory emits via `MountContext.emitTelemetry`:

| Event | Attributes |
|---|---|
| `ai-generative-clip.mount.start` | `family`, `provider`, `model`, `promptLength` integer |
| `ai-generative-clip.mount.success` | `family` |
| `ai-generative-clip.mount.failure` | `family`, `reason: 'invalid-props' \| 'generator-unavailable' \| 'permission-denied'`, `issues?` |
| `ai-generative-clip.generate.started` | `family`, `requestId`, `promptLength` integer |
| `ai-generative-clip.generate.resolved` | `family`, `requestId`, `durationMs`, `blobByteLength` integer, `contentType` |
| `ai-generative-clip.generate.error` | `family`, `requestId`, `errorKind: 'generate-error' \| 'aborted'` |
| `ai-generative-clip.dispose` | `family` |

**Prompt body, negativePrompt body, and generated blob bytes NEVER
appear in telemetry attributes.** The privacy posture is a per-event
invariant: text-derived attributes are integers only
(`promptLength`); blob-derived attributes are integers only
(`blobByteLength`). Pinned via three grep tests in
`factory.test.ts` (resolved path, mount.start path, generate.error
path) — AC #18.

`provider`, `model`, and `contentType` ARE included — they are
configuration / response metadata, not user content. `errorKind`
is a fixed enum.

## Determinism contract

AI generative is **event-driven**, not frame-driven. There is no
convergence test (D-T395-6) and no `frameSource` dependency. The
interactive tier's broad `check-determinism` exemption (ADR-003 §D5)
applies; the shader sub-rule does NOT (path-matched at
`clips/{shader,three-scene}/**` only). The factory uses
`Date.now()` / `performance.now()` for `durationMs` measurements —
wall-clock by definition.

The clip directory is **structurally** prevented from calling
`globalThis.fetch` / `XMLHttpRequest` / `navigator.sendBeacon`: the
factory test grep-walks every non-test file in `clips/ai-generative/`
and fails if any match (AC #26). This is the stronger guarantee that
backstops `check-determinism`.

## Hard rules

The clip directory must contain **no** direct `fetch` /
`XMLHttpRequest` / `navigator.sendBeacon`. Production generation
goes through the host-injected `Generator`. Pinned by T-395 AC #26
plus the existing `check-determinism` gate.

Prompt body, `negativePrompt` body, and generated blob bytes MUST
NOT appear in telemetry attributes. `promptLength` and
`blobByteLength` integers only.

`URL.createObjectURL` MUST be paired with `URL.revokeObjectURL` on
dispose. A leaked blob URL holds the blob in browser memory
indefinitely.

## Bundle + size

The package adds:

- `clips/ai-generative/types.ts` — public types, no runtime cost.
- `clips/ai-generative/ai-generative-provider.ts` — interface +
  two thin classes (`HostInjectedAiGenerativeProvider` is
  essentially a callable wrapper; `InMemoryAiGenerativeProvider`
  is a small Promise wrapper).
- `clips/ai-generative/factory.ts` — the factory + the
  generation-lifecycle state machine + blob-URL discipline.
- `clips/ai-generative/index.ts` — subpath entry, side-effect
  register, re-exports.

`size-limit` budgets are enforced by the existing CI gate.

## Static fallback (T-396)

When the harness routes to the static path AND the clip's authored
`staticFallback` is empty, `aiGenerativeStaticFallbackGenerator`
substitutes a deterministic Element[] derived from the clip's
`liveMount.props`:

- A single `ImageElement` filling the clip's bounds with `src =
  curatedExample.src` (a `data:` URL baked at authoring time).
- When `curatedExample` is absent, a single placeholder
  `TextElement` (empty text, `id:
  'ai-generative-static-fallback-placeholder'`) is emitted instead.
  The host overrides via app-level i18n.

### Schema addition (`curatedExample?`)

T-396 extends `aiGenerativeClipPropsSchema` with an optional
`curatedExample` field:

```ts
curatedExample: z.object({
  src: z.string().refine(s => s.startsWith('data:'), ...),
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']).optional(),
}).strict().optional()
```

**v1 accepts ONLY `data:` URLs** (the refine enforces this).
`http(s):` URLs are deferred per the out-of-scope deferral —
accepting external URLs would push the fetch question to the
frame-runtime export path, which `check-determinism` forbids inside
`clips/**`. Same posture as T-394 D-T394-1 (web-embed posterImage).

Backward-compatible: T-395 fixtures without the field continue to
validate. The schema-level `AssetRef` regex (`^asset:<id>$`) does
not accept data URLs; the generator casts `src as
ImageElement['src']` to bypass it (same posture as T-388 / T-394).

### Layout

The ImageElement fills the canvas exactly: `transform = { x: 0,
y: 0, width, height, rotation: 0, opacity: 1 }`. No overflow guard
needed — there's only one element either way.

### Determinism

Pure transformation. No `Math.random` / `Date.now` /
`performance.now`. The example URL is passed through verbatim into
the ImageElement; no parsing, no fetching. Same posture as T-388 /
T-390 / T-392 / T-394.

### Telemetry (privacy posture — D-T396-4)

| Event | Attributes |
|---|---|
| `ai-generative-clip.static-fallback.rendered` | `family`, `reason`, `width`, `height`, `hasExample` boolean, `exampleSrcLength` integer |

**The example URL string NEVER appears in telemetry attributes.**
`exampleSrcLength` is `curatedExample.src.length` (or `0` when
absent) — a 50KB inline data URL would balloon every telemetry
event, so the integer length is what telemetry consumers get.
Pinned via grep on captured event payloads in the static-fallback
test (AC #11).

The `reason` is forwarded verbatim from the harness — `'authored' |
'permission-denied' | 'tenant-denied' | 'export-static'`.

### Registration (T-388a)

`packages/runtimes/interactive/src/clips/ai-generative/index.ts`
now side-effect-registers two things at subpath import time:

```ts
interactiveClipRegistry.register('ai-generative', aiGenerativeClipFactory);  // T-395
staticFallbackGeneratorRegistry.register('ai-generative', aiGenerativeStaticFallbackGenerator);  // T-396
```

The harness's family-agnostic dispatch (T-388a) picks up the
registration without further changes.

## Cross-references

- T-389 / T-390 — sister AiChatClip pair. Closest in shape (same
  prompt-bearing schema; same host-injected provider seam; same
  prompt-body privacy posture).
- T-391 / T-392 — sister LiveDataClip pair. Closest in transport
  shape (request/response with `signal`); AiGenerative differs by
  having binary `Blob` output instead of text.
- T-393 / T-394 — sister WebEmbedClip pair. Closest in static-
  fallback shape (T-396 reuses T-394's data-URL ImageElement
  pattern verbatim, modulo the field name).
- T-388 / T-388a — voice static-fallback (the data-URL ImageElement
  cast pattern T-396 reuses) and the static-fallback generator
  registry T-396 registers against.
- ADR-005 §D7 — credential scoping; the provider's auth is the
  host's responsibility, not the clip's.
- ADR-006 (Phase 14) — authoring-time asset generation; the
  frontier-vs-asset-gen split per `docs/implementation-plan.md`
  Phase 14 header.
