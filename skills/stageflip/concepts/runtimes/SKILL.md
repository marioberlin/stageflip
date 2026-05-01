---
title: Runtime Tiers
id: skills/stageflip/concepts/runtimes
tier: concept
status: substantive
last_updated: 2026-04-29
owner_task: T-309a
related:
  - skills/stageflip/concepts/clip-elements/SKILL.md
  - skills/stageflip/concepts/storage-contract/SKILL.md
  - skills/stageflip/concepts/rate-limits/SKILL.md
---

# Runtime Tiers

A clip is a unit of motion that the renderer dispatches to a registered
runtime. StageFlip ships **three runtime tiers** so each clip kind picks the
fastest path that still produces correct output.

| Tier | Where it runs | When to use | Reference |
|---|---|---|---|
| **Frame-deterministic** | JS, in-browser preview + CDP export | Math-driven motion (interpolate, spring, easing); same frame number → same pixels | `@stageflip/frame-runtime` |
| **Interactive** | Live JS engine in a sandbox | Frontier clips that mount real DOM/WebGL — `liveMount` + `staticFallback` per ADR-005 | `@stageflip/runtimes/interactive` |
| **Bake** | Offline worker (Blender 4.2 LTS) | Heavy 3D scenes, ray-tracing, photoreal materials that cannot run live | `@stageflip/runtimes/blender` (T-265) |

Per ADR-003, every `ClipDefinition` declares which tiers it supports. The
renderer-core dispatcher picks the highest-quality available output that
fits the export budget.

## Bake tier (T-265)

A bake-tier clip ships its scene + parameters to a Blender worker, which
renders frames offline and uploads them to a content-addressed cache:

```
bakes/{inputsHash}/frame-{N}.png   (architecture-locked path,
                                    docs/architecture.md:330)
bakes/{inputsHash}/manifest.json   (frameCount, fps, region, completedAt)
```

The cache key — `inputsHash` — is the **whole game**. Same `{scene,
duration}` → same hash → cache hit; any input change → new hash → re-bake.
Wrong canonicalization here means cache poisoning, missed cache hits, or
duplicate bakes for the same intent. Pinned in `inputs-hash.test.ts`:

- Field order in objects is normalized (sorted-key JSON canonicalization).
- Field types are NOT coerced: `1` and `"1"` produce different hashes.
- Arrays preserve order (semantic).
- `bigint`, non-finite numbers, and circular structures are rejected.

### Lifecycle

1. **Author** creates a `BlenderClip` element with `scene + duration`.
   Editor computes `inputsHash` and pins it in the document.
2. **Submit** — caller invokes the `submitBakeJob` Cloud Function. Handler
   verifies `requireAuth`, debits 10 tokens from the org's rate-limit
   bucket (bake is ~10x more expensive than a normal request), recomputes
   the hash, and either short-circuits (cache hit) or enqueues a BullMQ job
   on `stageflip:bakes`.
3. **Render** — a `services/blender-worker` container consumes from
   `stageflip:bakes`, opens the scene template, applies parameters, and
   renders `[0, ceil(durationMs/1000 * fps))` frames via Cycles in
   deterministic mode (`use_persistent_data = True`, fixed seed,
   `use_denoising = False`, pinned sample count). The worker is **idempotent
   on `manifest.json`**: if it sees the manifest at the output path, it
   short-circuits successfully — required because BullMQ delivery is
   at-least-once and a duplicate-delivery race must not produce two
   parallel bakes.
4. **Fetch** — clients poll `getBakedFrames(inputsHash, { region })`. The
   call returns one of `'ready' | 'pending' | 'failed'` based on whether
   `manifest.json`, neither marker, or `bake_failed.json` is present.

### Region routing

Bake outputs respect `org.region` per T-271. The submit handler reads the
caller's region from their org doc; the worker writes to either the US
(`stageflip-assets`) or EU (`stageflip-eu-assets`) bucket. The cache key
is region-namespaced **only by bucket** — the path
`bakes/{inputsHash}/...` is the same in both regions.

### GPU / CPU dual-path (D-T265-7)

The worker tries GPU rendering first when `CUDA_VISIBLE_DEVICES` is set;
on CUDA failure, it retries on CPU and emits a `bake.cpu_fallback` warning.
CPU is ~10x slower but produces identical output thanks to Cycles'
deterministic mode.

### Determinism contract

Same `inputsHash` → byte-identical frames. This is pinned by:

- `bpy.context.scene.cycles.use_persistent_data = True`
- `cycles.seed = 0`
- `cycles.use_denoising = False`
- `cycles.samples = 64`

If you change any of these defaults, the cache is silently invalidated for
existing hashes. Bump the canonicalization rule explicitly and document the
migration.

## Render farm deployment (T-266)

The bake worker runs somewhere — local dev uses a child process; production
uses a GPU-cloud vendor. T-266 ships **`@stageflip/render-farm`**, an
adapter abstraction that decouples the bake worker from the vendor choice:

```ts
import { getRenderFarmAdapter } from '@stageflip/render-farm';
const adapter = getRenderFarmAdapter(process.env);
const { jobId } = await adapter.submitJob({
  bakeId, image, resources: { cpu, memoryGB, gpu: 'cuda' }, env: { ... },
});
```

The `RenderFarmAdapter` contract (`packages/render-farm/src/contract.ts`)
defines `submitJob`, `cancelJob`, `getJobStatus`, optional `streamLogs`, and
`capabilities` (which features are real vs stubs). All methods emit OTel
spans tagged with `vendor`, `jobId`, `state`, `duration_ms`.

### Adapters shipped in T-266

- **`InMemoryRenderFarmAdapter`** — runs the worker as a child process via
  `node:child_process`. Used for local dev + tests + the parity harness.
  Capabilities: `cpu-only`, streaming logs, `maxConcurrentJobs: 4`.
- **`KubernetesRenderFarmAdapter` stub** — class skeleton with all methods
  throwing `NotImplementedError`. `capabilities.maxConcurrentJobs: 0`
  signals "not deployed". A vendor implementation lands when first prod
  load demands it.

### Vendor selection

Production env sets `STAGEFLIP_RENDER_FARM_ADAPTER=k8s` (or a future vendor
key). The selector throws on unknown values — silent fallback to
`in-memory` would mis-route prod bake load.

Current vendor: **none** (in-memory only). Future options + cost/throughput
tradeoffs: see `docs/ops/render-farm-vendors.md`. v1 recommendation is
self-hosted K8s on GKE Autopilot; the adapter pattern means we can swap.

### State-marker protocol

The in-memory adapter drives lifecycle transitions by parsing two stdout
markers from the worker:

```
STAGEFLIP_RENDER_FARM_STARTED bakeId=<id>
STAGEFLIP_RENDER_FARM_FINISHED bakeId=<id> status=<succeeded|failed> [error=<msg>]
```

The worker emits these around `processBakeJob`. Real K8s adapters ignore
them (they read pod state from the Kubernetes API) — the markers are only
load-bearing for the in-memory path.

## Interactive runtime tier (T-306)

The interactive tier is the host for **frontier clips** — voice, AI chat,
live data, web embeds, AI generative, shaders, three-scene — that
structurally cannot live under the §3 determinism rule (mic streams, live
LLM round-trips, `requestAnimationFrame`-driven WebGL, etc.). Per
ADR-003 §D5, `packages/runtimes/interactive/**` is OUT of scope for
`pnpm check-determinism`'s broad rule. T-309 ships a shader sub-rule that
re-applies determinism inside the tier (uniform-updater functions must
accept `frame` only); see "Shader sub-rule (T-309)" below.

Every interactive clip declares **both paths** (ADR-003 §D2):

- `staticFallback: CanonicalElement[]` — frame-runtime renders this for
  parity-safe export targets (MP4, image-sequence, PPTX-flat,
  display-pre-rendered). Subject to PSNR + SSIM parity.
- `liveMount: { component, props, permissions }` — the interactive tier
  mounts this for HTML / live-presentation / display-interactive /
  on-device-player. Not subject to parity.

T-305 ships the schema; T-306 ships the runtime tier package
(`@stageflip/runtimes-interactive`). T-308 will add `check-preset-integrity`
to enforce that no clip declares only `liveMount`.

### Public surface

```ts
import {
  InteractiveMountHarness,
  PermissionShim,
  interactiveClipRegistry,
  staticFallbackGeneratorRegistry,
  contractTestSuite,         // from /contract-tests subpath
} from '@stageflip/runtimes-interactive';
```

- **`InteractiveMountHarness.mount(clip, root, signal)`** — programmatic
  mount/unmount/dispose.
- **`PermissionShim`** — mount-time permission gate.
- **`interactiveClipRegistry`** — module-level singleton; Phase γ clip
  packages call `register('shader', shaderFactory)` at import time.
- **`staticFallbackGeneratorRegistry`** (T-388a) — parallel module-level
  singleton holding per-family default-poster generators. See
  §"Dual-registry pattern" below.
- **`contractTestSuite(factory)`** — Vitest `describe` block every Phase γ
  family runs against its own factory.

#### Dual-registry pattern (T-388a)

Each γ-live family that ships a default poster registers TWO things at
module-load time, both as side-effect imports of `clips/<family>/index.ts`:

```ts
// packages/runtimes/interactive/src/clips/voice/index.ts
interactiveClipRegistry.register('voice', voiceClipFactory);
staticFallbackGeneratorRegistry.register('voice', voiceStaticFallbackGenerator);
```

The harness consults BOTH registries when mounting:

- `interactiveClipRegistry.resolve(clip.family)` returns the live-mount
  factory or `undefined` (in which case the harness throws
  `InteractiveClipNotRegisteredError` on the grant path).
- `staticFallbackGeneratorRegistry.resolve(clip.family)` returns the
  default-poster generator or `undefined`. On the static path:
  - generator + `staticFallback.length === 0` → render the generator's
    Element[] output;
  - generator + `staticFallback.length  > 0` → render the AUTHORED
    Element[]; the generator is still invoked with `reason: 'authored'`
    so per-family telemetry fires (D-T388a-3) but its return is ignored;
  - no generator + `staticFallback.length  > 0` → render the AUTHORED
    Element[];
  - no generator + `staticFallback.length === 0` → render an empty
    array (the schema's non-empty refine prevents this in practice).

Two specific registries beat one generic `Registry<K, V>` — per
CLAUDE.md "three similar lines beat a premature abstraction", two
registries don't earn extraction. Future γ-live families (T-389
ai-chat, T-391 live-data, T-393 web-embed, T-395 ai-generative)
register their own generator (or none) without touching the harness.

T-388a replaces the family-hardcoded `if (clip.family !== 'voice')`
branch the T-388 / PR #280 mount-harness shipped as a known workaround.
The literal does not appear in `mount-harness.ts` post-T-388a (CI grep
assertion in `mount-harness.test.ts`).

### Mount flow + security model

The harness orchestrates four steps in this exact order; getting them
wrong breaks the security model.

```
harness.mount(clip, root, signal):
  1. permissionShim.mount(clip)
       a. tenantPolicy.canMount(family)        # ADR-003 §D4 step 1 + ADR-005 §D3
            → false: emit 'tenant-denied'; route to staticFallback
       b. for permission in liveMount.permissions:
            mic    → getUserMedia({audio:true})
            camera → getUserMedia({video:true})
            network → no-op (assumed granted)
            → denied: emit 'permission-denied'; route to staticFallback
       c. cache successful grants per-(session, family); skip re-prompt
  2. registry.resolve(family) || throw InteractiveClipNotRegisteredError
  3. factory(MountContext)
  4. signal.abort → MountHandle.dispose() (idempotent)
```

**Critical invariants:**

- Tenant-policy gate runs BEFORE any `getUserMedia` call. A
  feature-flagged-off tenant must never see a permission dialog.
- Idempotent `dispose()` — both manual and `signal.abort`-driven paths
  converge on the same cleanup; double-dispose is a no-op.
- On any denial, the harness renders `staticFallback` via
  `renderStaticFallback` (React 19 root API). The export pipeline (per
  ADR-003 §D3) continues to function — the live mount degrades, the
  document still ships. Static-path Element[] selection routes through
  `staticFallbackGeneratorRegistry` per T-388a — see §"Dual-registry
  pattern" above.
- Permission cache is session-scoped (instance lifetime). A page reload
  resets it; the user's browser-level permission state persists
  independently.

### Determinism posture

By ADR-003 §D5, code under `packages/runtimes/interactive/**` may use
`Date.now`, `performance.now`, `Math.random`, `setTimeout`,
`setInterval`, `requestAnimationFrame`, `fetch`, `MediaRecorder`,
`getUserMedia`, `Worker`, etc. The exemption is enforced via
`scripts/check-determinism.ts` `EXCLUDED_PREFIXES` — narrow to only this
path; existing scope on `packages/frame-runtime/`,
`packages/runtimes/blender/**/clips/**`, and `packages/renderer-core/clips/**`
remains untouched.

#### Shader sub-rule (T-309 / T-309a)

The interactive tier's broad exemption is **narrowed** for shader and
Three.js scene clips. Per ADR-003 §D5 + ADR-005 §D2, uniform-updater
functions for `ShaderClip` and `ThreeSceneClip` are frame-deterministic
by construction: they must not read `Date.now`, `performance.now`,
`Math.random`, `setTimeout` / `setInterval`, or
`requestAnimationFrame` / `cancelAnimationFrame`.

`scripts/check-determinism.ts` enforces this via an AST pass that
inspects three declaration shapes on opt-in:

1. **Top-level functions and arrow-bound exports** on path-matched files
   (`packages/runtimes/interactive/src/clips/shader/**`,
   `packages/runtimes/interactive/src/clips/three-scene/**`).
2. **Methods on top-level classes** on path-matched files — both
   instance and static. Constructors are excluded (they run once at
   mount, not per frame). T-309a (Phase 13) added this scope so factory
   helpers colocated with uniform updaters can stay in the same file
   without tripping the rule.
3. **Decorator-tagged functions and methods** carrying the
   `@uniformUpdater` JSDoc tag, anywhere in the repo:

   ```ts
   /** @uniformUpdater */
   export function uTime(frame: number): number {
     return frame * 0.001;
   }
   ```

   Use the decorator when a uniform-updater lives outside the named
   clip directories (e.g., a future `webgl` family) and you still want
   the rule to apply.

T-309a also **dropped** the original "missing-frame parameter" check.
Functions / methods that don't take `frame` and don't call any
forbidden API are deterministic by definition; flagging them was
defensive over-reach. The forbidden-API check alone is sufficient (and
is already redundant with the `UniformsForFrame<P>` typecheck the
schema enforces upstream).

The escape-hatch comment `// determinism-safe: <reason>` exempts a
single line as on the broad rule. Reach for it only when the API is
demonstrably non-determinism-affecting (e.g., debug telemetry behind a
flag); link an ADR in the comment body.

The output line is:

```
check-determinism [shader sub-rule]: PASS (N uniform-updaters detected)
```

`N` counts every inspected top-level function, every inspected class
method, and every decorator-tagged function or method. T-383 ships the
first non-trivial targets:
`packages/runtimes/interactive/src/clips/shader/uniforms.ts` exports
`defaultShaderUniforms(frame, ctx)` — a `@uniformUpdater`-tagged
function — and `factory.ts` exposes `ShaderClipFactoryBuilder.build` /
`.mount` as static methods (now inspected per T-309a). See
`runtimes/shader/SKILL.md` §"Frontier-tier ShaderClip" for the full
factory + frame-source contract.

T-384 ships the second γ-core family (`three-scene`) under
`packages/runtimes/interactive/src/clips/three-scene/`. Its factory uses
clean TOP-LEVEL FUNCTIONS — the static-class workaround is unnecessary
under T-309a's tightened sub-rule. The directory adds a seeded PRNG
(`createSeededPRNG`) and a mount-scoped rAF shim (`installRAFShim`)
required by ADR-005 §D2; both are sub-rule-clean (no forbidden-API
calls; assignment to `window.requestAnimationFrame` is not a call). See
`runtimes/three/SKILL.md` §"Frontier-tier ThreeSceneClip" for the full
contract.

### γ-live families — second pattern (T-387)

T-387 ships `VoiceClip` — the **first γ-live family** and the second
γ pattern. Voice families differ structurally from γ-core (shader,
three-scene):

- No §3 runtime to reuse — voice / ai-chat / live-data / web-embed /
  ai-generative live entirely inside the interactive tier.
- Event-driven, not frame-driven — no `frameSource` dependency.
- No convergence test — `liveMount` has no rendered output to converge
  on against a `staticFallback` poster.
- Permission-bound — voice uses `mic`; the others use `network`.

The `clips/voice/**` and `clips/ai-chat/**` directories are
**outside the shader sub-rule scope** (path-matched at
`clips/{shader,three-scene}/**` only). The broad `check-determinism`
exemption for `packages/runtimes/interactive/**` applies; voice
naturally uses `Date.now()` / `performance.now()` for recording
duration + transcript timestamps; ai-chat does the same for turn
timestamps + `durationMs` telemetry. See `runtimes/voice/SKILL.md`
and `runtimes/ai-chat/SKILL.md` for the full contracts.

T-389 ships `AiChatClip` — the **second γ-live family**. Wraps
`@stageflip/llm-abstraction`'s provider-neutral `LLMProvider` to
expose a per-slide scoped chat. `liveMount` is shipped at T-389;
`staticFallback` (captured transcript) lands at T-390. The clip
declares `permissions: ['network']` (no-op grant in v1 per ADR-003
§D6) and emits `ai-chat-clip.{mount,turn,dispose}.*` telemetry whose
text-derived attributes are integers only (`userMessageLength`,
`tokenCount`) — neither user-message body nor assistant-completion
body appears in attributes.

T-391 ships `LiveDataClip` — the **third γ-live family**. Wraps a
host-injected `Fetcher` callable to fetch a single response from a
configured endpoint at mount time. `liveMount` is shipped at T-391;
`staticFallback` (cached snapshot rendered as text) lands at T-392.
Chart-aware rendering for both halves is gated on T-406 (Chart family,
γ-supporting); ADR-005 §D1 footnote `^liveData-v1` documents the v1
(text-only) vs end-state (chart) split. The clip declares
`permissions: ['network']` (no-op grant in v1) and emits
`live-data-clip.{mount,fetch,dispose}.*` telemetry whose body-derived
attributes are integers only (`bodyByteLength`) — the response body
NEVER appears in attributes. The clip directory is **structurally**
prevented from calling `globalThis.fetch` / `XMLHttpRequest` /
`navigator.sendBeacon` (T-391 AC #26 grep-pinned + the existing
`check-determinism` gate); the host-injected `Fetcher` is the only
path. Same posture AiChat uses for `LLMProvider`.

T-393 ships `WebEmbedClip` — the **fourth γ-live family**. Mounts a
sandboxed `<iframe>` whose `src` is a clip-supplied URL; exposes
`reload` / `postMessage` / origin-filtered `onMessage` via a typed
`MountHandle`. **No provider seam** — the browser's `<iframe>` element
IS the runtime; the factory just creates and disposes the DOM.
`liveMount` ships at T-393; `staticFallback` (poster-frame screenshot
as `ImageElement`) lands at T-394. The clip declares
`permissions: ['network']` (no-op grant in v1) and emits
`web-embed-clip.{mount,message,reload,dispose}.*` telemetry whose
body-derived attributes are integers only (`byteLength`) — postMessage
payload bodies NEVER in attributes. `message.dropped` reasons
distinguish `'source-mismatch'` (rogue nested-iframe forging an origin)
from `'origin-not-allowed'` (wrong origin) for security observability.
The clip directory is structurally prevented from calling
`globalThis.fetch` / `XMLHttpRequest` / `navigator.sendBeacon`
(T-393 AC #25 grep-pinned); the iframe's network is the browser's,
running in a separate document and out of scope for the clip's
determinism.

T-395 ships `AiGenerativeClip` — the **fifth and final γ-live family**.
At mount time the factory feeds `liveMount.props.prompt` to a host-
injected `AiGenerativeProvider`, awaits the generated artifact (a
`Blob` + `contentType`), and renders it into a single `<img>` element
under `ctx.root` via `URL.createObjectURL(blob)`. `liveMount` ships at
T-395; `staticFallback` (curated example output as `ImageElement`)
lands at T-396. v1 is image-only; audio/video/3D modalities are
deferred (the schema has no `modality` field — adding one is a non-
breaking change). ADR-006 (Phase 14) covers the authoring-time
asset-generation counterpart (frozen files); T-395/T-396 are the
playback-time counterpart. The clip declares `permissions: ['network']`
(no-op grant in v1) and emits
`ai-generative-clip.{mount,generate,dispose}.*` telemetry whose text
and binary-derived attributes are integers only (`promptLength`,
`blobByteLength`) — prompt body, negativePrompt body, and generated
blob bytes NEVER appear in attributes. The disposal contract is
load-bearing: `URL.createObjectURL` is a hidden GC root not handled
by ordinary DOM teardown, so `dispose()` MUST call
`URL.revokeObjectURL` (~200KB per regenerate × N clips × M slides =
unbounded growth otherwise). Pinned by T-395 D-T395-7 / AC #15
(spies on both `createObjectURL` and `revokeObjectURL` so a future
refactor that drops one fails loudly).

#### Pattern-evaluation outcome (D-T387-11 → D-T389-10 → D-T391-10 → D-T393-10 → D-T395-10)

T-383 / T-384 / T-387 / T-389 / T-391 / T-393 / T-395 share four
conventions (per-family schema file, subpath export, side-effect
registration, telemetry-event naming). **None of these is "three
similar lines of meaningful logic"** — they are conventions enforced
by the spec template, not duplicated implementations.

Per CLAUDE.md "three similar lines beat a premature abstraction":
**no shared abstraction is extracted at T-387, T-389, T-391, T-393,
or T-395.** T-391 D-T391-10 ruled out `ProviderSeam<T>` extraction
at the third application. T-393 D-T393-10 reaffirmed the ruling at
the fourth application. T-395 D-T395-10 reaffirms again at the
**fifth and final** γ-live application — and strengthens it: the
five shapes now span "no seam" through four different shapes
including a binary-output variant. A generic `ProviderSeam<T>` over
five shapes including "no seam at all" is incoherent.

1. **`ProviderSeam<T>` ruled out across five shapes.** Compare:
   - `TranscriptionProvider.start({ stream, language, partial, onTranscript })` —
     streaming with a single discriminated-union callback
     (`onTranscript: (event: TranscriptEvent) => void` over
     `{ kind: 'partial' | 'final' | 'error', ... }`); cancellation via
     the factory's `MediaGraph.dispose`, no `signal` in the public args.
   - `LLMChatProvider.streamTurn({ ..., onToken, signal })` — streaming
     with one callback + many input fields + `AbortSignal`.
   - `LiveDataProvider.fetchOnce({ url, method, headers, body, signal })` —
     request/response, no callbacks, **text-shaped** Promise output.
   - **No seam** for `WebEmbedClip` — the browser's `<iframe>` is the
     transport.
   - `AiGenerativeProvider.generateOnce({ prompt, ..., signal })` —
     request/response, no callbacks, **binary-Blob-shaped** Promise
     output.
   Four of five shapes share a host-injection convention (test-double
   pattern; "host supplies the client") but no extractable
   abstraction. The fifth (web-embed) doesn't even have a client to
   inject. The "binary vs text output" axis is the most recent
   concrete difference — distinguishes T-395 from T-391 in a way
   that matters for downstream consumers (parsing, `<img src>` vs
   `<output>` rendering, blob-URL revocation requirements).
   **Future seams follow the convention without inheriting a generic
   shape; future families with no upstream client (like web-embed)
   follow the no-seam pattern.**
2. **γ-live factory skeleton** — the state machine + dispose +
   abort wiring is structurally similar across γ-live factories,
   but uses different primitives (MediaRecorder vs. LLM stream vs.
   one-shot fetch vs. iframe DOM vs. blob-bearing generation).
   Inlining stays shorter than abstracting; five applications have
   not produced duplication of *logic*, only shape.

**Phase 13 γ-live family coverage is now closed at five families.**
Future asset-generation families ship under Phase 14 / ADR-006 with
their own seam pattern documented separately.

### Permission flow UX (T-385)

T-385 ships the user-facing layer wrapping `PermissionShim`. It lives
under `@stageflip/runtimes-interactive/permission-flow` (subpath
export):

```ts
import {
  usePermissionFlow,
  PermissionDenialBanner,
  PermissionPrePromptModal,
} from '@stageflip/runtimes-interactive/permission-flow';
// or via the root entry:
import { usePermissionFlow } from '@stageflip/runtimes-interactive';
```

- **`usePermissionFlow(clip, { shim, prePrompt?, emitTelemetry? })`**
  drives a state machine
  (`idle → pre-prompt? → requesting → granted | denied`). Returns
  `{ state, start, confirmPrePrompt, cancelPrePrompt, retry }`.
  Retry from `permission-denied` clears the failed permission's
  cache entry on the shim and re-runs the flow; retry from
  `tenant-denied` is a no-op (tenant policy is not user-overridable).
- **`<PermissionDenialBanner>`** and **`<PermissionPrePromptModal>`**
  are the default visual surfaces. Both accept all user-facing text
  as required `messages` props — no English defaults — so apps own
  localisation per CLAUDE.md §10. Both forward `data-testid`.
- **`PermissionShim.clearCacheEntry(family, permission)`** is the
  production-callable per-key cache invalidation primitive. The
  existing `clearCache()` test seam is preserved.
- **`MountContext.permissionPrePrompt?: boolean`** is the per-mount
  opt-in. Default off (T-306 baseline). Backward-compatible with
  pre-existing T-306 / T-383 / T-384 consumers.
- **`InteractiveMountHarness.mount(clip, root, signal, { permissionPrePrompt? })`**
  accepts an optional 4th argument; existing 3-arg callers continue
  to type-check. When the flag is on AND the harness has a
  `permissionPrePromptHandler` registered, the harness yields a
  pre-prompt cycle BEFORE the shim's permission probe. Cancelling
  routes the mount to `staticFallback` with reason
  `'pre-prompt-cancelled'`.

Telemetry events emitted by `usePermissionFlow` (in addition to the
shim's existing `tenant-denied` / `permission-denied` channel):

```
permission.pre-prompt.shown      { family, permission }
permission.pre-prompt.confirmed  { family, permission }
permission.pre-prompt.cancelled  { family, permission }
permission.dialog.shown          { family, permission }
permission.retry.clicked         { family, permission, attemptNumber }
permission.retry.granted         { family, permission, attemptNumber }
permission.retry.denied          { family, permission, attemptNumber }
```

The pre-prompt mode is OFF by default. T-385 unblocks the five
γ-live clip families with non-empty permissions: `VoiceClip` (T-387,
mic), `AiChatClip` (T-389), `LiveDataClip` (T-391), `WebEmbedClip`
(T-393), `AiGenerativeClip` (T-395) — all `network` except VoiceClip.
Those clip skills may *recommend* `prePrompt: true` but the host
application owns the choice. See `concepts/auth/SKILL.md`
§"Permission flow UX (T-385)" for the full surface description.

### Browser-bundle posture

The package is browser-side runtime. It MUST NOT import `fs`, `path`, or
`child_process`. Its dependencies are `@stageflip/schema` (browser-safe
surface), and `react` / `react-dom` as peer deps. `pnpm size-limit` is the
canary for accidental Node-only imports.

## Cross-links

- `packages/runtimes/blender/` — submit + fetch + queue + inputs-hash.
- `packages/runtimes/interactive/` — interactive runtime tier (T-306).
- `services/blender-worker/` — Docker image, BullMQ consumer, render.py.
- `firebase/functions/src/bake/` — Cloud Function adapter.
- `packages/render-farm/` — adapter contract + in-memory + K8s stub (T-266).
- `docs/ops/render-farm-vendors.md` — vendor evaluation + recommendation.
- `docs/decisions/ADR-003-interactive-runtime-tier.md` — three-tier model.
- `packages/schema/src/clips/interactive.ts` — `InteractiveClip` schema (T-305).
- `packages/schema/src/clips/export-targets.ts` — export matrix (T-305).
- `docs/architecture.md:330` — bake path layout.
- `docs/architecture.md:339-341` — BullMQ queue names.
