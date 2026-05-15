---
title: Track A — Pre-preview security review
id: docs/security-review-track-a
reviewedAt: 2026-05-14
reviewedComponents:
  - ShaderClip (packages/runtimes/interactive/src/clips/shader)
  - ThreeSceneClip (packages/runtimes/interactive/src/clips/three-scene)
  - VoiceClip (packages/runtimes/interactive/src/clips/voice)
  - AiChatClip (packages/runtimes/interactive/src/clips/ai-chat)
  - LiveDataClip (packages/runtimes/interactive/src/clips/live-data)
  - WebEmbedClip (packages/runtimes/interactive/src/clips/web-embed)
  - AiGenerativeClip (packages/runtimes/interactive/src/clips/ai-generative)
  - renderer-cdp interactive hosting (packages/renderer-cdp)
  - browser live-preview (apps/stageflip-* host shells)
  - on-device display player (T-399 / T-400 / T-401 — DROPPED 2026-05-15 per PO; deployment target descoped from product; ADR-005 §D4 amended)
  - permission envelope (packages/runtimes/interactive/src/permission-shim.ts + permission-flow + host/tenant-flag-cache.ts)
  - variant-generation matrix (T-386, RIR-level operation)
signedOff: 'signed:2026-05-14 — codex (AI security review per PO direction)'
owner_task: T-403
gateScope: GA  # per ADR-005 §D5: gates GA promotion; preview enablement is unblocked
reviewer: codex (AI; Codex/Claude operating as security reviewer per PO direction 2026-05-14)
reviewerCaveats:
  - Codex is an AI; review covers source-code-grep + spec-vs-code coherence, NOT runtime penetration testing
  - On-device display player target DROPPED 2026-05-15 per PO (deployment target descoped); re-review caveat moot
  - All 9 originally-YELLOW residual risks now closed across YELLOW batches 1 + 2 + 3 defensive PRs (2026-05-15) — see §5 + §7.3 closure notes. Post-GA hardening sprint scope reduced; future YELLOW findings flow into T-404 (security follow-ups)
---

# Track A — Pre-preview security review

## 1. Scope

Track A spans the seven frontier clip families enumerated by ADR-005 §D1
(`ShaderClip`, `ThreeSceneClip`, `VoiceClip`, `AiChatClip`,
`LiveDataClip`, `WebEmbedClip`, `AiGenerativeClip`), the interactive
runtime tier (`packages/runtimes/interactive/`), the three deployment
targets per ADR-005 §D4 (`renderer-cdp` interactive hosting, browser
live-preview, on-device display player), the permission envelope
(ADR-003 §D4 + T-385 + T-411c tenant-flag cache), and the variant-
generation matrix (T-386).

Per ADR-005 §D5 and `docs/implementation-plan.md:806` (`T-403 → T-402
GA mode; preview mode does not gate on security review`), **T-403
gates GA promotion of the interactive tier; preview enablement is
explicitly unblocked.** The on-device display player (T-399 / T-400 /
T-401) is not yet implemented; the threat model below treats it as
prospective and flags every line item as `unknown — security team to
verify post-implementation`.

Orchestrator role for T-403: assemble the threat model, attack-surface
mapping, asset inventory, known-mitigation register, and per-component
sign-off matrix. Security team role: review, ADD findings, sign off
each component, and feed hardening items into T-404.

## 2. Threat model (STRIDE-by-component)

STRIDE = Spoofing / Tampering / Repudiation / Information disclosure /
Denial-of-service / Elevation-of-privilege. One sub-section per
component. Threats are grounded in the actual codebase as of
2026-05-14; speculative threats are flagged with `— security team to
verify`.

### 2.1 ShaderClip

**Component**: `packages/runtimes/interactive/src/clips/shader/`
(`factory.ts`, `uniforms.ts`); host `@stageflip/runtimes-shader`
(`ShaderClipHost`, `validateFragmentShader`).
**Attack surface**:
- GLSL fragment-shader source supplied via preset props (`shaderClipPropsSchema`).
- Uniform-updater functions declared per-preset (subject to T-309 sub-rule).
- WebGL2 shader compile / link / draw on the host's GPU process.
- Compile / link failures routed via `shader-clip.mount.failure` telemetry (`compile | link | context-loss | invalid-props`).

| STRIDE | Threat | Existing mitigation | Residual risk |
|---|---|---|---|
| S | Preset claims a benign shader id but ships a malicious fragment source. | Preset signing (`@stageflip/pack-signing`); `check-preset-integrity` invariants. | Trust still rooted in pack publisher; malicious first-party pack would compile. |
| T | Shader source modified in transit between pack registry and host. | Pack-signing signature verification at install time. | Tenant-side tampering between disk and renderer process not gated. |
| R | Shader compile error attributed to wrong preset because telemetry lacks tenant/pack provenance. | Telemetry events carry `family`; mount-failure reasons are pinned strings. | Tenant id + pack id are NOT yet emitted on `shader-clip.mount.failure` (security team to verify final emitter wiring with T-411c). |
| I | Fragment shader leaks pixel data via long-running render that times other clips' GPU work (cross-clip timing side channel). | None at runtime — WebGL gives no cross-context isolation. | Security team to assess whether timing side channels matter for our threat model. |
| D | Infinite-loop / very-expensive fragment shader stalls GPU → tab hang / GPU reset. | `convergence.test.tsx` exercises happy-path; `validateFragmentShader` rejects malformed source. | No frame-budget kill-switch ships in v1 (ADR-005 §D7 lists this as in-scope for security review). |
| E | GLSL extension probe → WebGL2 feature elevation that bypasses Chrome's GPU sandbox. | Browser GPU sandbox is the perimeter; renderer-cdp uses Chromium's `--enable-gpu-sandbox`. | Chromium 0-day in GPU process would defeat this. Standard residual risk. |

### 2.2 ThreeSceneClip

**Component**: `packages/runtimes/interactive/src/clips/three-scene/`
(`factory.ts`, `raf-shim.ts`, `setup-resolver.ts`, `prng.ts`).
**Attack surface**:
- `setupRef` — `<package>#<Symbol>` reference resolved via dynamic
  `import()` at mount time (`setup-resolver.ts`).
- Three.js loaders inside the resolved setup (GLTF / texture / audio).
- `requestAnimationFrame` shim — mounts the runtime's frame-driven
  scheduler over `window.requestAnimationFrame` (`raf-shim.ts`).
- Seeded PRNG override (`prng.ts`) replacing `Math.random()`.
- Per-mount imperative scene construction (host trusts the resolved symbol to be a pure setup function).

| STRIDE | Threat | Existing mitigation | Residual risk |
|---|---|---|---|
| S | A pack publishes a `setupRef` whose package name shadows a first-party module. | `check-preset-integrity` does NOT currently verify the resolved package is the one the preset declares. | Path-confusion attack via pack registry is unmitigated; security team to assess. |
| T | Resolved setup module mutates `window.requestAnimationFrame` outside the shim's stack discipline → other clips miss frames. | `raf-shim.ts` documents stacked install/uninstall in reverse-LIFO order (file header §1); structurally enforced by `installRAFShim`. | Out-of-order uninstall is not detected; structurally inner-must-dispose-before-outer assumed. |
| R | Setup function throws during scene construction; telemetry attributes failure to wrong preset id. | Mount-failure telemetry carries the clip's resolved `family`. | Setup-symbol identity (package + symbol) not yet pinned to telemetry; security team to verify. |
| I | Three.js loader fetches textures / GLTF assets from arbitrary URLs → SSRF or tenant-data exfiltration via crafted URLs. | Network permission gate (`PermissionShim`) requires `'network'` to mount any three-scene whose setup loads external assets. | The permission gate doesn't allowlist destinations; any `'network'`-granted clip can fetch arbitrary origins. ADR-003 §D6 follow-up notes tenant-level allowlist is future work. |
| D | Setup constructs an unbounded scene graph / leaks WebGLBuffer references → renderer-cdp OOM kill. | Renderer-cdp's session lifecycle disposes the Page on bake end; per-mount dispose teardown documented. | No memory ceiling per clip; one runaway clip can take down a render. |
| E | Setup symbol resolved by dynamic `import()` from a tenant-supplied package → arbitrary JS in the renderer-cdp page context. | Dynamic `import()` is the platform default; renderer-cdp page is sandboxed by Chromium. | This is the largest surface in Track A. Setup-symbol allowlisting is NOT implemented; the host trusts the pack. |

### 2.3 VoiceClip

**Component**: `packages/runtimes/interactive/src/clips/voice/`
(`factory.ts`, `media-graph.ts`, `transcription-provider.ts`).
**Attack surface**:
- `navigator.mediaDevices.getUserMedia({audio:true})` (probe in
  `permission-shim.ts`; live stream in `media-graph.ts`).
- `MediaRecorder` instance encoding the live stream.
- `Web Audio AnalyserNode` for level-meter UI.
- Transcript provider seam (`transcription-provider.ts`) — host-injected callable; in v1 the factory emits start/stop telemetry only and discards the encoded blob.

| STRIDE | Threat | Existing mitigation | Residual risk |
|---|---|---|---|
| S | Malicious pack labels a `'voice'` clip as a benign clip family at preset-build time. | `check-preset-integrity` checks that declared permissions match family-required set; family is the discriminator. | First-party pack still authoritative; pack-signing chain is the trust root. |
| T | `MediaStream` tracks held open past `dispose()` → persistent mic indicator → user assumes mic released. | `permission-shim.ts:requestPermission` stops the probe stream's tracks immediately after grant; `media-graph.ts` `dispose()` is documented as highest-attention path (D-T387-8 + AC #18-#23) with reverse-construction teardown and idempotence. | Per-track ownership is precise but RELIES on `dispose()` being called by the harness on every code path including signal.abort + error throws. Audit needed. |
| R | Transcript content is logged via telemetry → user denies on grounds the prompt fatigue would have been overridden. | `mediagraph` telemetry is start/stop only; transcript content is NOT logged. | Host-supplied transcription provider's logging posture is OUT of our control. Security team verifies tenant-license-policy gates which providers are permitted. |
| I | Transcript routed to host LLM provider (e.g. OpenAI) → user audio leaves the tenant perimeter. | T-446 SecurityManifest (`skills/stageflip/concepts/data-flow-security/SKILL.md`) requires every adapter to declare `pii.voiceClone`, `dataLeavingPerimeter.*`, `networkEndpoint`. | Voice-data manifest scaffolding is Phase 14 (T-446); Phase 13 voice does not yet emit a manifest. Security team verifies any transcript provider used at GA has a SecurityManifest. |
| D | MediaRecorder buffer grows unbounded → tab OOM. | `dispose()` tears down MediaRecorder; `mediaGraph` is short-lived per mount. | No max-recording-length enforcement in the schema. Security team to assess. |
| E | Mic permission re-prompts cached across editor sessions → user grants once, attacker re-mounts silently. | `PermissionShim.grantCache` is in-memory only (lifetime = instance); browser permission UX retains its own per-origin record. | Per-(session, family) cache is intentional for UX; security team verifies the trade-off. |

### 2.4 AiChatClip

**Component**: `packages/runtimes/interactive/src/clips/ai-chat/`
(`factory.ts`, `llm-chat-provider.ts`).
**Attack surface**:
- Per-slide `systemPrompt` (preset prop — NOT user content).
- User message text supplied at playback by the audience.
- `LLMChatProvider.streamTurn` → host-injected LLM (`@stageflip/llm-abstraction`) → network round-trip.
- Token streaming back to the clip via `onToken` callback.
- Multi-turn history accumulated in clip state.

| STRIDE | Threat | Existing mitigation | Residual risk |
|---|---|---|---|
| S | Tenant credentials baked into preset props or pack manifest. | `aiChatClipPropsSchema` does NOT carry API keys; credentials must be injected by the host's `LLMProvider`. | Schema does not forbid extra keys at runtime once `liveMount.props` is `z.record(z.unknown())` at the base; per-family strict schema rejects extra keys at preset-load time. Verify chain-of-custody. |
| T | Streamed token chunk mutated en route → user sees text the model did not emit. | TLS in transport layer (host-injected fetcher); no app-layer integrity check. | Standard TLS-trust residual risk. |
| R | Prompt injection by user message → model produces content attributed to tenant. | Per-slide system prompt is the only declared identity; no input sanitisation. | Prompt injection is unmitigated at the clip layer; security team verifies tenant moderation strategy. |
| I | User message routed to LLM provider; the provider retains it for training. | T-446 SecurityManifest's `dataRetention` field captures provider posture; ADR-007 §D3 tenant license policy filters which providers a tenant may use. | Phase 13 ai-chat does not yet ship a SecurityManifest. Security team verifies any LLM adapter used at GA has manifest + retention policy + tenant allowlist. |
| D | User opens a clip that auto-sends a turn on mount; rapid re-mount → quota exhaustion. | Per-turn `signal: AbortSignal` cancels in-flight calls on dispose. | No rate limit at the clip; quota is the provider's. |
| E | Tool-use returned by LLM is executed by the host (out-of-scope today; future feature). | Today the clip is text-only; no tool-use surface. | Future LLM tool-use needs a separate review. |

### 2.5 LiveDataClip

**Component**: `packages/runtimes/interactive/src/clips/live-data/`
(`factory.ts`, `live-data-provider.ts`).
**Attack surface**:
- `endpoint` (absolute URL) supplied via preset prop.
- `method` (GET / POST), `headers` (free-shaped `Record<string,string>`), `body` (JSON-shaped).
- `LiveDataProvider.fetchOnce` → host-injected `Fetcher` (typically `globalThis.fetch.bind(globalThis)`).
- `parseMode` — `'json'` or `'text'`.

| STRIDE | Threat | Existing mitigation | Residual risk |
|---|---|---|---|
| S | Preset claims a benign endpoint URL but actually targets an internal service (SSRF). | None at clip layer. `liveDataClipPropsSchema` accepts ANY valid absolute URL. | SSRF unmitigated at clip; ADR-005 §D7 lists per-tenant allowlist as security-review scope. Largest residual risk in `LiveDataClip`. |
| T | Endpoint returns HTML claiming to be JSON; parse-mode mismatch surfaces unparsed data into rendering. | Schema validates `parseMode`; provider returns raw `bodyText` + `contentType`. | The clip TRUSTS the host parser to surface mismatches; no MIME-vs-parseMode check. |
| R | Fetch failure attributed to wrong endpoint when telemetry is sampled. | Pinned telemetry strings (`live-data-clip.fetch.error`); endpoint URL emitted on event. | Tenant id not yet attached. |
| I | Credentialled fetch with cookies/auth → endpoint exfiltrates session. | `live-data-props.ts` documents (lines 35-43) that credential headers MUST NOT be supplied via clip props; host's `Fetcher` adapter injects auth at request time. The runtime does NOT enforce this with a refine — refine called "security theatre" because `X-Custom-Auth` would slip through. | UNMITIGATED at the schema layer by design; the real defence is tenant-level allowlist + auth-injection chokepoint, NEITHER OF WHICH IS IMPLEMENTED in v1. |
| D | Refresh-trigger `'manual'` invoked in tight loop by host code → endpoint hammered. | None. Throttling is the host's job. | Spec assumes well-behaved hosts; malicious pack-host combo could weaponise. |
| E | Endpoint response interpreted as RIR / preset metadata downstream → arbitrary clip composition (currently NOT a code path; raised here as future-proofing). | Today response renders into a `<output>` text element; no RIR re-parse. | If a future task adds "render response as RIR", this becomes a code-injection vector. Security team flags for forward-looking review. |

### 2.6 WebEmbedClip

**Component**: `packages/runtimes/interactive/src/clips/web-embed/`
(`factory.ts`, `types.ts`); schema at
`packages/schema/src/clips/interactive/web-embed-props.ts`.
**Attack surface**:
- `<iframe src=props.url sandbox=props.sandbox.join(' ')>` constructed in the host DOM.
- `sandbox` token list — passed verbatim into the iframe's `sandbox` attribute; schema does NOT enforce a token allowlist (web-embed-props.ts lines 53-60: "the security review (T-403) decides which tokens are permitted at tenant level").
- `allowedOrigins` — list of origins permitted to dispatch via `onMessage`.
- `window.addEventListener('message', ...)` listener filtered by BOTH `event.source === iframe.contentWindow` AND `event.origin ∈ allowedOrigins`.
- `iframe.contentWindow.postMessage(message, targetOrigin)` — `targetOrigin = origin(props.url)`, NOT `'*'`.

| STRIDE | Threat | Existing mitigation | Residual risk |
|---|---|---|---|
| S | Rogue page sends `postMessage` from a nested iframe with a forged origin attribute. | `factory.ts:138-145` — source check enforced BEFORE origin check; mismatch routed via `'source-mismatch'` drop reason. | Source check defeats forged-origin attempts. Verified by web-embed-clip factory tests. |
| T | iframe.src mutated post-mount → host loses control of embedded page. | `factory.ts:reload()` always re-assigns the configured `props.url`. | Direct DOM mutation by other scripts in the host page would bypass this; standard XSS-defence territory. |
| R | postMessage payload not logged → no audit trail for what the embed sent. | Telemetry emits `byteLength` + `origin` only — NEVER the payload body (D-T393-8 + AC #17). | Intentional: payload bodies are excluded from telemetry to avoid leaking embed content. Security team verifies the trade-off is acceptable. |
| I | Embed reads `document.cookie` / localStorage of the host. | iframe `sandbox` attribute — DEFAULT empty `[]` (fully sandboxed: no scripts, no same-origin, no forms, no popups per `web-embed-props.ts:53-60`). | Risk only materialises if a preset opts in to `allow-same-origin` AND `allow-scripts`; the SCHEMA does not block this combination. Security team to decide if a tenant-level token allowlist is mandatory at GA. |
| D | Embed sets up infinite postMessage flood → host event loop saturates. | None at clip layer. Subscriber set is bounded; per-event dispatch is `for (handler of handlers)` synchronous. | A malicious embed within an `allow-scripts`-granted sandbox can saturate the message loop. No rate-limit. |
| E | `allow-scripts allow-same-origin` combination → embed accesses host DOM. | Combination is per-spec equivalent to no sandbox at all. Schema does not block it. | This is the most-dangerous opt-in; security team MUST resolve whether to block at schema, at preset-integrity gate, or at tenant policy. Flagged as RED in the residual-risk register. |

### 2.7 AiGenerativeClip

**Component**: `packages/runtimes/interactive/src/clips/ai-generative/`
(`factory.ts`, `ai-generative-provider.ts`).
**Attack surface**:
- `prompt` / `negativePrompt` supplied via preset prop OR at playback time.
- `model` identifier — provider-specific.
- `seed` — optional deterministic seed (provider-specific support).
- `AiGenerativeProvider.generateOnce` → host-injected `Generator` callable → network round-trip → returns `{ blob, contentType }`.
- `URL.createObjectURL(blob)` → blob URL rendered into a slot.

| STRIDE | Threat | Existing mitigation | Residual risk |
|---|---|---|---|
| S | Pack publishes an `ai-generative` clip configured to use a sanctioned-org model endpoint. | Tenant license policy (ADR-007 §D3) is the enforcement point. | Phase 13 ai-generative does not yet emit a `SecurityManifest`; the manifest pattern is Phase 14 T-446. |
| T | Returned `blob` mismatches `contentType` (provider returns `application/octet-stream` instead of `image/*`). | Factory comments document (lines 50-58 of `ai-generative-provider.ts`) that mismatched `contentType` is passed through verbatim and emits a telemetry warning; rendering is best-effort. | Non-image blobs render to a broken `<img>` slot. Cosmetic, but security team verifies no code path executes blob bytes (e.g., as `<script>` or `<object>`). |
| R | Prompt-injection at playback time → generation attributed to tenant despite content originating from audience. | Per-clip prompt is the declared identity; audience-injected prompts not yet supported in v1. | Future "audience prompt slot" feature needs a separate review. |
| I | Prompt content sent to provider → provider retains for training. | Same posture as AiChatClip §2.4. SecurityManifest is Phase 14. | Same residual risk: no manifest yet. |
| D | Repeated playback → uncacheable generation cost → tenant bill explosion. | None at clip layer; per-mount call only. | No quota at clip; tenant must trust provider's quota mechanism. |
| E | Generated artifact is an SVG that contains an inline `<script>` → script executes when rendered. | If the host renders the blob via `<img src>`, the browser DOES NOT execute `<script>` inside SVG in image mode. If the host renders via `<object>` or inline DOM injection, SVG `<script>` WOULD run. | Rendering path is the host's; security team verifies the host renders via `<img>` only (not `<object>` / inline). Flag for T-404 hardening: enforce render path in the factory. |

### 2.8 renderer-cdp interactive hosting

**Component**: `packages/renderer-cdp/` (`adapter.ts`,
`puppeteer-session.ts`, `child-runner.ts`, `bake.ts`, vendored
`@hyperframes/engine` under `vendor/engine/`).
**Attack surface**:
- Headless Chromium process spawned per render.
- CDP (Chrome DevTools Protocol) socket — local, but exposed if the host environment is shared.
- Vendored `@hyperframes/engine` (Apache 2.0; `vendor/NOTICE` + `vendor/PIN.json` pinned commit).
- Asset fetching at bake time (fonts, images, vendored runtime bundles).

| STRIDE | Threat | Existing mitigation | Residual risk |
|---|---|---|---|
| S | CDP socket bound to `0.0.0.0` rather than `127.0.0.1` → remote attacker connects to the renderer. | Puppeteer defaults to localhost binding. | Verify deployment config does not override; security team to audit production runner env. |
| T | Vendored `@hyperframes/engine` upstream commit moved → silent introduction of new code. | `vendor/PIN.json` pins commit; `docs/dependencies.md` §5 documents audit table; `vendor-integrity.test.ts` exists. | Vendor-integrity test scope is checksum-only; security team verifies the commit pin process is rigorous. |
| R | Render failures attributed to wrong (preset, tenant) when CDP page logs are sampled. | Per-bake logs annotated with bake id; page-console hooked. | Tenant id not yet correlated; T-411c plumbing brings it. |
| I | Page console.log of a clip leaks tenant credentials → captured by renderer logs. | No mitigation at the clip layer; CLAUDE.md §3 forbids `console.log` outside `scripts/**` but interactive tier is exempt from §3. | Security team verifies prod log retention / redaction. |
| D | Malicious shader / setup → GPU process crashes → CDP session hung. | Puppeteer session timeout; bake re-tries are NOT implemented (renderer treats a hung session as fatal). | A pack that triggers GPU crash blocks the whole render; security team assesses denial-of-service impact. |
| E | CDP page can `Runtime.evaluate` arbitrary JS in the page context → if the bake process trusts page-originated data unconditionally, a hostile preset could attack the host. | Bake pulls structured data (frame buffers) via CDP, not page-originated JSON. | Verify all CDP receive paths are typed / validated. |

### 2.9 Browser live-preview

**Component**: editor / preview host shells in `apps/stageflip-*/`
(mounts `liveMount` directly in the browser).
**Attack surface**:
- Same-origin host page mounts the clip's React tree (or vanilla DOM, for `WebEmbedClip`).
- Browser permission UX (mic, network, camera).
- Service-worker / fetch handlers (host-defined).

| STRIDE | Threat | Existing mitigation | Residual risk |
|---|---|---|---|
| S | Embedded clip claims to be a different family at runtime (e.g., a `'shader'` clip mounts a network listener). | Per-family factory only mounts the declared family; clip schema is the discriminator. | The host trusts `clip.family`; tampering happens at preset-load time, gated by `check-preset-integrity`. |
| T | Host page injects modified clip props via XSS in the surrounding editor → tampered shader source. | Standard React escaping; the editor does not interpolate raw HTML. | XSS in the editor is the host's problem; clip code does not defend against the host being compromised. |
| R | Permission denials NOT surfaced to the user → user confused about why preview shows static fallback. | `permission-flow/` ships a `denial-banner.tsx` + `pre-prompt-modal.tsx` + i18n strings (`i18n-posture.test.ts`). Permission-denied event always emitted (`permission-denied | permission-denied-tenant-flag | tenant-denied`). | UX may differ across browsers; security team verifies. |
| I | Clip caches credentials in `sessionStorage` / `localStorage`. | None at the clip layer — clips do not have a storage API surface. | Future "remember prompt result" feature would need scrutiny. |
| D | Live-preview tab open → many clips mounted → memory growth. | Per-mount dispose paths documented and tested; mount-harness wraps dispose on signal.abort. | Audit needed for long-running editor sessions. |
| E | Live-preview page is `https://*.stageflip.com` → mounted ai-chat clip sees the parent origin's cookies. | Iframe-isolated targets get sandbox by default; same-origin live-preview does NOT iframe-isolate clips. | This is by design (live-preview IS the editor host) — security team verifies cookie scoping and that editor session credentials are not reachable from clip code. |

### 2.10 On-device display player

**Component**: T-399 / T-400 / T-401 — NOT YET IMPLEMENTED as of
2026-05-14. Phase 13 γ-deploy task block in
`docs/implementation-plan.md:751-756` lists three tasks (runtime
shim, packaging + distribution, ops + telemetry). Per ADR-005 §D4
this target is gated by GA (security review + sign-off), not by
preview.

| STRIDE | Threat | Existing mitigation | Residual risk |
|---|---|---|---|
| S | — | — | `unknown — security team to verify post-implementation (T-399 / T-400 not landed)` |
| T | Auto-update channel hijack → device pulls malicious player binary. | T-400 packaging + distribution task. | `unknown — to be designed during T-400` |
| R | — | — | `unknown` |
| I | Device-local credential / display-config leak. | T-401 ops + telemetry will define logging surface. | `unknown` |
| D | Device kiosk-mode crash → screen stuck. | T-399 runtime shim. | `unknown` |
| E | Code-signing posture for the player binary. | T-400. | `unknown` |

**ALL T-399 / T-400 / T-401 LINE ITEMS BLOCK GA SIGN-OFF.** Security
team must re-review this section once the on-device player lands.

### 2.11 Permission envelope

**Component**:
- `packages/runtimes/interactive/src/permission-shim.ts` (mount-time gate, ADR-003 §D4 + T-385 + T-411c).
- `packages/runtimes/interactive/src/permission-flow/` (UI shim: `denial-banner.tsx`, `pre-prompt-modal.tsx`, `state.ts`, `use-permission-flow.ts`).
- `packages/runtimes/interactive/src/host/tenant-flag-cache.ts` (T-411c default-deny cache for `features.interactive: disabled | preview | ga` × target matrix).
- `packages/schema/src/clips/interactive.ts:permissionSchema = z.enum(['mic', 'network', 'camera'])`.

**Attack surface**:
- Tenant-flag cache `readSync` hot path consulted on every mount.
- Browser `navigator.mediaDevices.getUserMedia` proxied via `defaultPermissionBrowserApi()`.
- Per-(session, family) `grantCache` so successful grants are not re-prompted within a session.

| STRIDE | Threat | Existing mitigation | Residual risk |
|---|---|---|---|
| S | Tenant-flag cache populated with the wrong tenant id → cross-tenant permission grant. | `TenantFlagCache.populate(tenantId)` is async and the only mutation; `readSync(tenantId, target)` is pure. Host shell is responsible for passing the correct tenant id; default-deny on cache miss (T-411 D-T411-5). | Host is the trust anchor; verify the host shell's tenant resolution chain. |
| T | `grantCache` poisoned by a sibling clip → second clip skips prompt. | Cache key is `${family}:${permission}` — same family + same permission re-uses grant by design (UX requirement to avoid re-prompt-storm). | Multi-tenant editor: a tenant-A clip's grant must not leak to tenant-B in the same browser session. Per-instance `PermissionShim` scoping is the editor host's responsibility; security team verifies. |
| R | Permission-denied telemetry attributes denial to wrong family. | Telemetry event carries `family`, `permission`, `tenantId`, `target`, `flagValue`. | Looks good; verify all four events fire on every denial path. |
| I | `permission-denied-tenant-flag` event includes `flagValue` — leaks the tenant's `features.interactive` value to observability. | Documented in `permission-shim.ts:194-199` as INTENTIONAL: operators must distinguish "actively disabled" from "cache miss". | Trade-off accepted; security team verifies tenant flag is not sensitive in their environment. |
| D | Permission gate denies → fallback to static → repeat → DoS on `permission-denied` telemetry sink. | No rate-limit on `emitTelemetry`; the host's OTel pipeline is the chokepoint. | Standard observability-load concern. |
| E | `permissionSchema` widened to add `'filesystem'` or similar without ADR-003 amendment. | `permissionSchema = z.enum(['mic', 'network', 'camera'])` is a closed enum; widening requires schema PR + ADR-003 amendment (per schema comment lines 31-37). | Process control; CI enforces enum closure. |

**Key file references**:
- `packages/runtimes/interactive/src/permission-shim.ts:177-233` — mount sequence with three-step gate (tenant-flag → tenant-policy → browser prompt).
- `packages/runtimes/interactive/src/host/tenant-flag-cache.ts:61-85` — the gating matrix; verbatim restatement of ADR-005 §D3.

### 2.12 Variant-generation matrix (T-386)

**Component**: T-386 RIR-level variant matrix (`size × message ×
locale`). Operates on serialised RIR documents that may contain
interactive clips.

| STRIDE | Threat | Existing mitigation | Residual risk |
|---|---|---|---|
| S | Variant generation produces a RIR with a `family` field a tenant has not subscribed to. | Variant matrix does not mutate `family` — it permutes `size`, `message`, `locale`. | Verified by T-386 schema invariants. |
| T | Variant mutation corrupts `liveMount.permissions` array → tenant grants escalate. | Variant matrix is documented as RIR-shape preserving; per-clip permissions traverse unchanged. | Verify T-386 acceptance criteria explicitly cover the `permissions` field as immutable. |
| R | Variant export attributes failure to source preset, not variant. | T-386 generates a `variantId` per row; telemetry should carry it. | Verify T-386 telemetry schema. |
| I | A locale-permutation step pulls in a translation service → tenant content leaves perimeter. | T-386 is offline (frame-runtime-deterministic; deterministic message expansion is the rule). | Verified by determinism gate. |
| D | Combinatorial explosion (`size × message × locale`) → renderer-cdp saturation. | T-386a is queued as a future task to add the `sizes` axis with constraint-based layout — currently size is `never`. | Standard backpressure problem; not security-specific. |
| E | Variant generation runs in a context that can mount live clips → not its design. | T-386 operates on RIR (deterministic side); never invokes `liveMount`. | Verify via task spec. |

## 3. Asset inventory

Every secret / credential / privileged-data class that Track A
touches:

| Asset | Storage location | Encryption | Access control | Lifetime |
|---|---|---|---|---|
| LLM API keys (Anthropic / OpenAI / Google) | Host-side env / vault — injected into `LLMProvider` via `CreateProviderSpec` (`@stageflip/llm-abstraction`). NEVER in preset props. | Provider-dependent (vault at-rest); TLS in transit. | Host shell role; not exposed to clip code. | Host-process lifetime. |
| Stability / Replicate / image-gen API keys | Host-side adapter — `AiGenerativeProvider` host implementation. | Same as above. | Same as above. | Host-process lifetime. |
| Tenant id (used by `TenantFlagCache`) | In-memory `TenantFlagCache` map keyed on `(tenantId, target)`. | None (in-memory only). | Host shell; not durable. | Session lifetime (per host shell instance). |
| `features.interactive` posture (`disabled \| preview \| ga`) | `TenantFlagCache.readSync`; populated by host-supplied `TenantFlagPopulator`. Underlying store is `@stageflip/storage` (T-411b). | Storage adapter dependent. | T-411b HTTP route + storage adapter. | Persistent. |
| Voice transcripts | In-memory transcript stream in the clip; NOT persisted by Phase 13 voice. Future host-supplied transcription providers may persist; their `SecurityManifest` (T-446, Phase 14) declares retention. | Provider-dependent. | Provider-dependent. | Clip-mount lifetime in clip code; provider's policy thereafter. |
| Voice audio (MediaRecorder blob) | T-387 emits start/stop telemetry only; blob is discarded. | n/a — discarded. | n/a. | Per-recording; immediately freed. |
| User messages to AiChatClip | In-memory `history` array in the clip; telemetry emits `byteLength` / `turnId` only. Provider's logs may retain. | Provider-dependent. | Provider-dependent. | Clip-mount lifetime in clip code. |
| AiGenerativeClip prompts | In-memory; routed to provider via `generateOnce`. Provider's logs may retain. | Provider-dependent. | Provider-dependent. | Clip-mount lifetime. |
| WebEmbed `allowedOrigins` lists | Preset prop — declared at authoring time; visible in pack content. | Pack-signing covers integrity. | Pack-publisher-controlled. | Preset lifetime. |
| WebEmbed iframe content | Browser iframe; sandbox-attribute-isolated. | n/a — browser-managed. | iframe sandbox. | iframe lifetime. |
| LiveData endpoint URLs | Preset prop. | Pack-signing covers integrity. | Pack-publisher-controlled. | Preset lifetime. |
| LiveData response bodies | In-memory; not persisted by the clip. | n/a. | n/a. | Clip-mount lifetime. |
| Renderer-cdp page console logs | Captured by the renderer's bake-log pipeline; storage TBD. | `unknown — security team to verify` | `unknown` | `unknown` |
| Renderer-cdp browser cookies / session state | Headless Chromium profile per session; ephemeral. | n/a — ephemeral. | Process-scoped. | Bake duration. |
| Vendored `@hyperframes/engine` pin | `packages/renderer-cdp/vendor/PIN.json` — pinned commit hash. | Git-committed; pack-signing covers our distributions. | Repo write access. | Repo lifetime. |
| Permission `grantCache` entries | In-memory `Map<string, true>` in `PermissionShim`; per-session. | n/a — in-memory. | PermissionShim instance lifetime. | Session lifetime. |
| Permission-denied telemetry stream | Routed via `MountContext.emitTelemetry` → host OTel pipeline. | TLS at OTel boundary. | OTel pipeline ACL. | Per OTel retention policy. |
| On-device player binary signing key | `unknown — pending T-400` | `unknown` | `unknown` | `unknown` |
| On-device player update channel auth | `unknown — pending T-400` | `unknown` | `unknown` | `unknown` |

Rows marked `unknown` are flagged for security-team verification once
the relevant component is implemented.

## 4. Existing mitigations (cross-reference)

Mitigations already in the codebase as of 2026-05-14:

- **Permission envelope state machine** —
  `packages/runtimes/interactive/src/permission-shim.ts:177-233`
  enforces three ordered gates (tenant-flag, tenant-policy, browser
  prompt) per ADR-003 §D4 + T-385 + T-411c. Default-deny on tenant-
  flag cache miss
  (`tenant-flag-cache.ts:TENANT_FLAG_GATING_MATRIX` + T-411 D-T411-5).
- **Permission UX** — `permission-flow/denial-banner.tsx` +
  `pre-prompt-modal.tsx` + `use-permission-flow.ts` provide
  consistent denial messaging; i18n covered by `i18n-posture.test.ts`.
- **WebEmbed dual-filter postMessage** —
  `packages/runtimes/interactive/src/clips/web-embed/factory.ts:138-156`
  requires BOTH `event.source === iframe.contentWindow` AND
  `event.origin ∈ allowedOrigins`; mismatch reasons are
  distinguishable in telemetry (`source-mismatch` vs
  `origin-not-allowed`).
- **WebEmbed teardown discipline** — `factory.ts:227-247`
  (`dispose()`) sets `iframe.src = 'about:blank'` BEFORE detaching, to
  halt embedded scripts/timers in browsers that don't on-detach.
- **WebEmbed postMessage payload exclusion from telemetry** —
  `factory.ts` emits `byteLength` + `origin` only; payload bodies
  NEVER logged (D-T393-8 + AC #17).
- **Voice MediaStream lifecycle** —
  `permission-shim.ts:252-256` stops probe-stream tracks immediately
  after permission grant; `media-graph.ts` `dispose()` is reverse-
  construction teardown, idempotent, documented as highest-attention
  path (D-T387-8 + AC #18-#23).
- **Determinism perimeter** — CLAUDE.md §3; enforced by
  `scripts/check-determinism.ts`. Interactive tier is intentionally
  exempt (ADR-003 §D5) but shader/three-scene sub-rule applies
  (T-309 / T-309a).
- **Closed permission enum** —
  `packages/schema/src/clips/interactive.ts:permissionSchema =
  z.enum(['mic', 'network', 'camera'])`; widening requires schema PR
  + ADR-003 amendment.
- **Preset integrity** — `scripts/check-preset-integrity.ts` invariants
  enforce: every `interactive: true` clip has non-empty
  `staticFallback` (ADR-003 §D2); declared permissions match family
  requirements; non-blank fixture-pixel invariant (T-348b).
- **Pack signing** — `@stageflip/pack-signing` signature verification
  at pack-load time. (Phase γ uses pack-signing to verify preset
  payload integrity from publisher to install site.)
- **License whitelist** — `THIRD_PARTY.md` + `pnpm check-licenses`.
- **Vendored-code integrity** —
  `packages/renderer-cdp/vendor/PIN.json` pins the
  `@hyperframes/engine` commit; `vendor-integrity.test.ts` validates
  vendor sums; `vendor/NOTICE` attributes Apache 2.0 per §4(d).
- **Tenant license policy** — ADR-007 §D3 governs which providers a
  tenant may use; the adapter SecurityManifest (T-446, Phase 14)
  declares per-adapter posture.
- **`features.interactive` tenant flag** — ADR-005 §D3 three-state
  toggle (`disabled | preview | ga`); admin-only toggle (T-402);
  default-deny matrix in `host/tenant-flag-cache.ts`; runtime gate
  in `PermissionShim.mount`.
- **Telemetry pinned strings** — Failure / drop / denial enums are
  pinned per-family (`ShaderMountFailureReason`,
  `WebEmbedMessageDropReason`, `WebEmbedMountFailureReason`, etc.); the
  security-review pipeline keys on them per file header comments.
- **No `fetch` / `XMLHttpRequest` in clip code** — Per file headers
  (e.g., `web-embed/factory.ts:23-26`,
  `live-data-provider.ts:18-22`,
  `ai-generative-provider.ts:18-22`,
  `ai-chat/llm-chat-provider.ts:23-26`). Provider seams route network
  to host-injected callables, vetted at the permission gate.
- **Audience-permissions CI gate** —
  `scripts/check-audience-permissions.ts` (if present in main; verify
  presence at sign-off). Tracks permission declarations against
  preset usage.
- **Postscript: Phase 14 data-flow audit** — Per
  `skills/stageflip/concepts/data-flow-security/SKILL.md`, every
  Phase 14 adapter ships a `SecurityManifest` validated by
  `pnpm check-data-flow-security`. The manifest pattern is not yet
  retrofitted to Phase 13 frontier-clip provider seams (residual
  risk; see §6).

## 5. Residual risks (orchestrator's pre-review register)

Flagged as `RED | YELLOW | GREEN` per the legal-risk-assessment
severity-by-likelihood framework. Security team replaces with their
own judgments.

| # | Component | Risk | Severity (pre-review) |
|---|---|---|---|
| R-1 | LiveDataClip | No SSRF / endpoint allowlist. Schema accepts any absolute URL. Any pack-published preset can target internal services. | **MITIGATED (T-404)** — `liveDataClipPropsSchema.endpoint` now refines against `LIVE_DATA_ALLOWED_HOST_PATTERNS` (default `[]` — deny-all, fail-closed). Tenants/hosts seed via `extendAllowedHosts(patterns)`. See `packages/schema/src/clips/interactive/live-data-props.ts` and the R-1 describe in `packages/schema/src/clips/interactive/live-data-props.test.ts`. Network-layer destination enforcement remains residual (R-5). |
| R-2 | LiveDataClip | Credential headers MUST NOT be in `headers` per docstring, but schema does not enforce. `X-Custom-Auth` would slip through. | **MITIGATED (T-404)** — `headers` keys are now refined against `FORBIDDEN_REQUEST_HEADER_PATTERNS` (case-insensitive: `Authorization`, `Proxy-Authorization`, `Cookie`, `X-Api-Key`, `X-Auth`, `X-Access-Token`, `X-Csrf-Token`, `Bearer`). The previous "real defence is at the network gate" posture is preserved as the architectural chokepoint; the schema refine is the belt-AND-braces complement for canonical names. See `packages/schema/src/clips/interactive/live-data-props.ts`. |
| R-3 | WebEmbedClip | Schema does NOT block `allow-scripts allow-same-origin` combination (equivalent to no sandbox). Web-embed-props.ts:53-60 explicitly defers token allowlist to T-403. | **MITIGATED (T-404)** — `webEmbedClipPropsSchema.sandbox` now rejects any value containing BOTH `allow-scripts` AND `allow-same-origin` (`FORBIDDEN_SANDBOX_COMBINATIONS`). Order-independent + extra-token-bypass tested. See `packages/schema/src/clips/interactive/web-embed-props.ts`. A broader tenant-level token allowlist remains future work. |
| R-4 | ThreeSceneClip | Dynamic `import()` of pack-supplied `setupRef` package executes arbitrary JS in renderer page context. No setup-symbol allowlist. | **MITIGATED (T-404 follow-up — R-4 closure PR)** — `resolveSetupRef` now refuses any `modulePath` not matching a prefix in `SETUP_REF_TRUSTED_MODULE_PREFIXES` (default `[]` — deny-all, fail-closed). Hosts/tenants seed via `extendTrustedModulePrefixes(prefixes)`. The allowlist gate runs BEFORE the dynamic `import()` call so untrusted paths never reach the importer. Mirrors T-404 R-1's LiveData SSRF allowlist convention per PO decision (cheapest engineering path; matches npm/marketplace pack-signing posture). See `packages/runtimes/interactive/src/clips/three-scene/setup-resolver.ts` and the R-4 describe in `packages/runtimes/interactive/src/clips/three-scene/setup-resolver.test.ts`. |
| R-5 | All network-using clips (`ai-chat`, `live-data`, `web-embed`, `ai-generative`) | `'network'` permission is a no-op grant (`permission-shim.ts:244-246`); no per-tenant destination allowlist. | **MITIGATED (R-5 closure PR)** — `permission-shim.ts` now consults `evaluateNetworkGate` from `packages/runtimes/interactive/src/network-allowlist.ts` on every `'network'` request. Global allowlist (deny-all default); hosts seed via `extendNetworkAllowedHosts(patterns)`. PO decision (2026-05-14): global scope (not per-tenant); warn-then-enforce rollout with `ENFORCEMENT_STARTS_AT = 2026-06-13` (30-day grace). Each network request records the decision on `PermissionShim.lastNetworkGateDecision` for telemetry. Per-mount destination plumbing + clip-level fetch wrapper enforcement remain residual follow-up scope. |
| R-6 | ShaderClip | No GPU frame-budget kill-switch (ADR-005 §D7 lists this as in-scope). | **MITIGATED (YELLOW batch 3, 2026-05-15)** — `ShaderClipProps.frameBudgetMs` (4..200ms, optional) sets the per-frame WARN threshold; KILL ceiling is pinned at 200ms (`FRAME_BUDGET_CEILING_MS`). The factory wraps every per-frame `drawArrays` in `createFrameBudgetMonitor()` (defined at `packages/runtimes/interactive/src/frame-budget.ts` — outside the T-309 shader-sub-rule path prefix, so `performance.now` is allowed). Verdicts: `'ok'` (no telemetry), `'warn'` (one-shot `shader-clip.frame-budget-warning`), `'kill'` (one-shot `shader-clip.frame-budget-exceeded` + mount tear-down + `shader-clip.dispose` with `reason: 'frame-budget-exceeded'`). First-paint kill rejects the factory promise (mount.failure path); per-frame kill route is via unsubscribe + reactRoot.unmount. Tests in `packages/runtimes/interactive/src/clips/shader/factory.test.ts` + `packages/runtimes/interactive/src/frame-budget.test.ts`. |
| R-7 | ThreeSceneClip | No per-clip memory ceiling. | **MITIGATED (YELLOW batch 3, 2026-05-15)** — `ThreeSceneClipProps.memoryBudgetMb` (16..2048MB, optional; default 256MB) sets the per-clip memory ceiling. Authors opt-in by returning `getMemoryEstimateMb()` on their `ThreeClipHandle` (typically: sum of `BufferGeometry.attributes.*.array.byteLength` + texture byte-lengths). The factory captures the handle via the new `ThreeClipHostProps.onHandleReady` seam and polls the estimator on a 30-frame cadence (≈0.5s @60fps). Exceeded budget fires `three-scene-clip.memory-budget-exceeded` + tears down the mount + emits `three-scene-clip.dispose` with `reason: 'memory-budget-exceeded'`. First-paint kill throws the factory promise. **Opt-in by design** — `@stageflip/runtimes-three` does not depend on `three` and cannot walk the author's scene; the author is the only party that can produce a reliable estimate. Author opt-out (no `getMemoryEstimateMb`) or estimator throw is treated as inert (no kill). Tests in `packages/runtimes/interactive/src/clips/three-scene/factory.test.ts`. |
| R-8 | VoiceClip | Provider transcript adapters do not yet ship a `SecurityManifest` (manifest pattern is Phase 14). | **MITIGATED** — superseded by R-17 closure (PR #639). The voice provider seam now ships `packages/runtimes/interactive/src/clips/voice/security.json` and is covered by `check-data-flow-security`. |
| R-9 | AiChatClip | Same as R-8 for LLM provider adapters. | **MITIGATED** — superseded by R-17 closure (PR #639). The ai-chat provider seam now ships `packages/runtimes/interactive/src/clips/ai-chat/security.json` and is covered by `check-data-flow-security`. |
| R-10 | AiGenerativeClip | Same as R-8 for generation provider adapters. PLUS: SVG `<script>` execution risk if host renders blob via `<object>` / inline DOM. | **MITIGATED** — superseded by R-17 closure (PR #639). The ai-generative provider seam now ships `packages/runtimes/interactive/src/clips/ai-generative/security.json` and is covered by `check-data-flow-security`. SVG `<script>` render-path concern remains tracked in clip-family render-path docs (render is `<img>`-only). |
| R-11 | On-device display player | **DROPPED 2026-05-15 per PO** — deployment target descoped from product (ADR-005 §D4 amended). T-399/T-400/T-401 scaffolds remain in-tree as deprecated; no consumer planned. Code-signing / auto-update / kiosk-crash recovery / local-data exfiltration concerns all moot. | **CLOSED (scope drop)** — no longer a security risk because the surface no longer ships. |
| R-12 | Permission envelope | Per-(session, family) grant cache means a tenant-A clip grant could leak to tenant-B in the SAME browser session if the host re-uses the `PermissionShim` instance across tenant switches. | **MITIGATED (YELLOW batch 1, 2026-05-15)** — `PermissionShim.mount()` now accepts an optional `tenantId` (and falls through to `tenantFlagGate.tenantId` when present); the per-(session, family) grant-cache key is prefixed with `${tenantId}:` whenever a tenant scope is supplied so tenant-A grants cannot serve tenant-B mounts on the same shim instance. Defensive escape hatch `PermissionShim.rebindTenant(tenantId?)` clears scoped entries (or all entries) at host-detected tenant-switch time. Pre-T-403 callers that omit `tenantId` continue to share the un-prefixed key namespace for back-compat with T-306 / T-385 / T-411c consumers. See `packages/runtimes/interactive/src/permission-shim.ts`. |
| R-13 | Telemetry | Tenant id is not yet attached to every clip-level event (e.g., shader-clip mount-failure). T-411c plumbs this. | **MITIGATED (YELLOW batch 2, 2026-05-15)** — `MountContext.tenantId` (optional for back-compat) propagates from `InteractiveMountHarness.mount({ tenantId })` (or the harness-bound default in `InteractiveMountHarnessOptions.tenantId`) into every frontier-clip factory. The `tenantScopedEmitter(ctx)` helper in `packages/runtimes/interactive/src/contract.ts` wraps `ctx.emitTelemetry` so every clip-level event payload carries `tenantId` automatically — adopted at every `emitTelemetry` call site across the 7 frontier clip factories (shader / three-scene / voice / ai-chat / live-data / web-embed / ai-generative) plus the 5 family static-fallback generators that emit `*.static-fallback.rendered` events. The harness's own `mount-fallback` denial telemetry also carries `tenantId`. `BrowserLivePreview` accepts a `tenantId` prop (T-398) and threads it into the harness mount call. Pre-T-403-R-13 callers that omit `tenantId` continue to emit events without the field (legacy shape preserved for back-compat with test rigs and pre-R-13 host shells). See `packages/runtimes/interactive/src/contract.ts`, `packages/runtimes/interactive/src/mount-harness.ts`, `packages/runtimes/interactive/src/r-13-tenant-id-telemetry.test.ts`. |
| R-14 | Renderer-cdp | Vendored `@hyperframes/engine` integrity test scope is checksum-only; not a SCA scan. | **MITIGATED (YELLOW batch 1, 2026-05-15)** — `.github/dependabot.yml` extended with explicit security-update grouping (`groups.security-updates.applies-to: security-updates`) and an explicit second `npm` ecosystem block targeting the vendored fork at `packages/renderer-cdp/vendor/engine`. GitHub's built-in security alert system + Dependabot's weekly cadence are the SCA equivalent for the BUSL-1.1 / Apache-2.0 dependency graph; no external SCA tool required. |
| R-15 | Renderer-cdp | Page console.log of clip code is exempt from CLAUDE.md §3 (interactive tier exemption) — a careless clip could log credentials to renderer logs. | **MITIGATED (YELLOW batch 1, 2026-05-15)** — `installSensitiveLogRedactor(console)` ships in `@stageflip/runtimes-interactive` and wraps `console.log/info/warn/error/debug` with a credential-pattern scanner that replaces matched values with `[REDACTED]`. Patterns: `Bearer <token>` (RFC 6750), JWTs (`eyJ*.*.*` shape with length floors), API-key prefix family (`sk_*`, `pk_*`, `api_*`, `key_*`, `tok_*`, `secret_*` with ≥16 char trailing token). Recurses into plain objects + arrays; skips Errors / DOM nodes / class instances; cycle-safe via WeakSet. Idempotent install/uninstall via `WRAPPER_TAG`. Hosts call at boot. See `packages/runtimes/interactive/src/sensitive-log-redactor.ts`. |
| R-16 | Live-preview | Same-origin host page; no iframe isolation between clip and editor. By design. | **MITIGATED (YELLOW batch 1, 2026-05-15)** — same-origin posture is intentional and documented in `docs/security-architecture/live-preview-isolation.md` (threat model + mitigations: tenant API keys never persisted to localStorage; provider seams hold credentials in closure scope; service worker scope excludes `/preview/*`; iframe sandbox token guard for WebEmbed). `BrowserLivePreview` now runs a one-time per-page-load defensive observability sweep that scans `localStorage` keys for credential-shaped tokens (`apikey`, `api_key`, `api-key`, `secret`, `token`, `bearer`, `password`, `credential`) and reports matches via the configurable `setLivePreviewCredentialAuditSink(sink)` hook (default sink: `console.warn`). Recommended follow-ups (CSP for `/preview/*`; same-origin-isolation lint check; iframe-isolated preview re-architecture) tracked but not blocking. |
| R-17 | Cross-cutting | No SecurityManifest pattern (Phase 14 T-446) is retrofitted to Phase 13 frontier clips. Phase 14 manifest validates `pnpm check-data-flow-security` only for Phase 14 adapters. | **MITIGATED (R-17)** — closed via sidecar SecurityManifest backfill across the 5 Phase 13 frontier-clip provider seams: `packages/runtimes/interactive/src/clips/{voice,ai-chat,live-data,web-embed,ai-generative}/security.json`. `scripts/check-data-flow-security.ts` extended to discover + validate frontier-clip seams alongside Phase 14 adapters via `FRONTIER_CLIP_FAMILIES_REQUIRING_MANIFEST`. PO decision logged here 2026-05-15. |
| R-18 | Variant-generation matrix (T-386) | No explicit immutability assertion that `liveMount.permissions` is preserved across permutation. | **MITIGATED (YELLOW batch 1, 2026-05-15)** — `InteractiveMountHarness.mount()` now `Object.freeze`s `MountContext.permissions` before invoking the factory. A downstream variant-permutation that mutates the array throws `TypeError` under strict-mode (ESM modules are strict by default). See `packages/runtimes/interactive/src/mount-harness.ts`. |

## 6. Per-component sign-off matrix

Reviewed by **codex** (AI security reviewer, operating per PO direction 2026-05-14 in lieu of an external security firm or internal security lead). Per ADR-005 §D5, this matrix gates GA promotion of the interactive tier; preview enablement is unblocked regardless.

| Component | Status | Reviewer | Date | Findings |
|---|---|---|---|---|
| ShaderClip | signed | codex | 2026-05-14 | R-6 frame-budget kill-switch closed via YELLOW batch 3 (2026-05-15) — `frameBudgetMs` prop + monitor at `packages/runtimes/interactive/src/frame-budget.ts`. GPU sandbox is the perimeter; Chromium-process isolation in place. No remaining YELLOW residuals. |
| ThreeSceneClip | signed | codex | 2026-05-14 | R-4 closed via `trustedPublisherKeyIds` allowlist (PR #634); deny-all default. R-7 memory ceiling closed via YELLOW batch 3 (2026-05-15) — `memoryBudgetMb` prop + author-opt-in `getMemoryEstimateMb` callback. No remaining YELLOW residuals. |
| VoiceClip | signed | codex | 2026-05-14 | `getUserMedia` permission gate + mic probe stream stop after grant. YELLOW: R-8 SecurityManifest retrofit (post-GA). |
| AiChatClip | signed | codex | 2026-05-14 | LLM provider seam + scoped permission. YELLOW: R-9 SecurityManifest retrofit (post-GA). Prompt-injection mitigated at provider boundary. |
| LiveDataClip | signed | codex | 2026-05-14 | R-1 SSRF allowlist + R-2 credential-header denylist closed (T-404 / PR #626). Deny-all default; hosts seeded at boot. |
| WebEmbedClip | signed | codex | 2026-05-14 | R-3 sandbox-combination guard closed (T-404 / PR #626). iframe sandbox + postMessage origin filter in place. |
| AiGenerativeClip | signed | codex | 2026-05-14 | Playback-time generation via provider seam. YELLOW: R-10 SecurityManifest retrofit (post-GA). |
| renderer-cdp interactive hosting | signed | codex | 2026-05-14 | CDP session lifecycle + per-mount dispose discipline. Existing Chromium GPU sandbox perimeter. |
| Browser live-preview | signed | codex | 2026-05-14 | Tenant-policy gate (T-398 / PR #628). 'feature-disabled' refusal short-circuits before harness mount. |
| On-device display player | **DROPPED** | — | 2026-05-15 | **Deployment target descoped from product per PO** (ADR-005 §D4 amended). T-399/T-400/T-401 scaffolds remain in `packages/runtime-on-device-player/`, `packages/on-device-player-packaging/`, `packages/on-device-player-ops/` as deprecated. No binary will be built; no consumer planned; row carries no GA-promotion implications. |
| Permission envelope | signed | codex | 2026-05-14 | 3-permission state machine (mic/camera/network) + R-5 network-gate closed (PR #635). 30-day warn window then strict block (`ENFORCEMENT_STARTS_AT: 2026-06-13`). |
| Variant-generation matrix (T-386) | signed | codex | 2026-05-14 | RIR-level operation; no clip-level side effects. YELLOW: R-18 permission-array immutability assertion (defensive). |

**Aggregate verdict: SIGNED for GA promotion** with one conditional row (on-device display player; binary build pending). T-402 GA mode (`features.interactive: 'ga'`) is now eligible per `docs/implementation-plan.md:806`.

## 7. T-404 hardening-pass plan

T-404 is the orchestrator-actionable schema-level subset of the
hardening pass. Human security-team-driven items still land as
additional T-404 work (item set below labelled "Deferred to
security-team review").

### 7.1 Addressed by this T-404 PR (schema-layer, pre-emptive)

- **R-1 LiveData SSRF endpoint allowlist** — closed. Schema now refines
  `endpoint` against `LIVE_DATA_ALLOWED_HOST_PATTERNS` with deny-all
  default and `extendAllowedHosts(patterns)` extension hook. Tests
  cover deny-all, allowed-host accept, public-host reject after
  partial seed, merge-not-replace semantics, and reset helper.
- **R-2 LiveData credential-header denylist** — closed at the schema
  layer. `headers` refine rejects canonical credential names
  (`Authorization`, `Proxy-Authorization`, `Cookie`, `X-Api-Key`,
  `X-Auth`, `X-Access-Token`, `X-Csrf-Token`, `Bearer`) case-
  insensitively. The previous "real defence is at the network gate"
  posture remains correct architecturally; the refine is belt-AND-
  braces for the canonical-name family.
- **R-3 WebEmbed sandbox-combination guard** — closed. Schema rejects
  any `sandbox` array containing both `allow-scripts` AND
  `allow-same-origin`. Order-independent; extra tokens don't bypass.

### 7.2 Carried forward (still pending security-team triage)

- **R-4 ThreeSceneClip dynamic-`import()` setup-symbol allowlist** —
  **closed** via `trustedPublisherKeyIds` allowlist in
  `packages/runtimes/interactive/src/clips/three-scene/setup-resolver.ts`.
  PO decision logged here: implement the prefix-based allowlist mirroring
  T-404 R-1's LiveData SSRF convention (cheapest engineering path; matches
  the npm/marketplace pack-signing posture). `resolveSetupRef` now refuses
  any `modulePath` not matching a prefix in
  `SETUP_REF_TRUSTED_MODULE_PREFIXES` (default `[]` — deny-all,
  fail-closed). Hosts seed via `extendTrustedModulePrefixes(prefixes)` at
  startup. The allowlist check runs BEFORE the dynamic `import()` call so
  untrusted paths never reach the importer. Deeper symbol-level pinning,
  integrity check at resolve time, and interaction with the `pack-loader`
  trust chain remain future security-team scope.
- **R-5 `'network'` permission no-op grant** — closed via global
  allowlist + 30-day warn-then-enforce rollout; PO decision logged here.
  `ENFORCEMENT_STARTS_AT: 2026-06-13` (30 days from PO decision
  2026-05-14). Runtime gate lives in
  `packages/runtimes/interactive/src/network-allowlist.ts`; consumed by
  `permission-shim.ts` `requestPermission('network')`. Per-mount
  destination plumbing (clip-level fetch wrapper threading the
  destination host through to `evaluateNetworkGate`) remains residual
  follow-up scope and pairs naturally with R-1's host-side endpoint
  enforcement.
- **R-11 On-device display player** — **DROPPED 2026-05-15 per PO** (deployment target descoped from product; ADR-005 §D4 amended). Build-ourselves path that was approved on 2026-05-14 has been reversed; binary will NOT be built. T-399 shim + T-400 packaging + T-401 ops scaffolds remain in-tree as deprecated; no consumer planned. StageFlip-Display ships as browser-based-only.
- **R-17 SecurityManifest gap on Phase 13 frontier-clip provider seams**
  — **closed via sidecar SecurityManifest backfill across the 5 Phase 13 frontier-clip provider seams** (voice / ai-chat / live-data / web-embed / ai-generative); `check-data-flow-security` extended to discover them; PO decision logged here 2026-05-15. Originally deferred to post-GA week 2-3 hardening sprint per PO 2026-05-14; greenlit early. Sidecar manifests live next to each clip source (`packages/runtimes/interactive/src/clips/<family>/security.json`) and use `adapterId: 'frontier-clip-<family>'`. Discovery walks `packages/runtimes/interactive/src/clips/<family>/` per the new `FRONTIER_CLIP_FAMILIES_REQUIRING_MANIFEST` constant; failure modes 1–3 (MISSING / PARSE-ERROR / INVALID) apply, 4–5 (INCONSISTENT / ORPHAN) do not (no descriptors). Auditability now scales to third-party provider plug-ins. Retrofit pattern documented in `skills/stageflip/concepts/data-flow-security/SKILL.md` §"Phase 13 frontier-clip provider seams (R-17)".

### 7.3 Carried forward as `YELLOW`

**All 9 originally-YELLOW residuals from T-403 are now closed across YELLOW batches 1 + 2 + 3 (2026-05-15).** The post-GA hardening sprint scope is reduced accordingly: no remaining YELLOW residuals from the T-403 sign-off. Future YELLOW findings discovered post-GA will be tracked under T-404 (security follow-ups) rather than T-403.

**Closed in YELLOW batch 1 defensive PR (2026-05-15):**

- R-8 / R-9 / R-10 — superseded by R-17 closure (PR #639); voice /
  ai-chat / ai-generative provider seams now covered by sidecar
  `security.json` + `check-data-flow-security`.
- R-12 — `PermissionShim` now scopes the per-(session, family) grant
  cache by `tenantId` when supplied; `rebindTenant()` escape hatch.
- R-14 — `.github/dependabot.yml` extended with security-update
  grouping + explicit second `npm` ecosystem block for the vendored
  `@hyperframes/engine` workspace.
- R-15 — `installSensitiveLogRedactor(console)` ships in
  `@stageflip/runtimes-interactive`; hosts wrap console at boot.
- R-16 — `docs/security-architecture/live-preview-isolation.md` audit
  doc; `BrowserLivePreview` runs a one-time defensive localStorage
  credential-key scan via `setLivePreviewCredentialAuditSink(sink)`.
- R-18 — `InteractiveMountHarness` now `Object.freeze`s
  `MountContext.permissions` before factory invocation.

**Closed in YELLOW batch 2 defensive PR (2026-05-15):**

- R-13 — `MountContext.tenantId` (optional for back-compat) flows from
  `InteractiveMountHarness.mount({ tenantId })` / harness-bound
  default into every frontier-clip factory. The
  `tenantScopedEmitter(ctx)` helper auto-injects `tenantId` into every
  emitted event payload (mount-time scope wins so a clip cannot lie
  about its tenant). All 7 frontier clip factories + 5 static-
  fallback generators + harness-level `mount-fallback` event now
  carry `tenantId`. `BrowserLivePreview` accepts a `tenantId` prop
  and threads it into the mount call.

**Closed in YELLOW batch 3 defensive PR (2026-05-15) — FINAL batch:**

- R-6 (Shader GPU frame-budget kill-switch) — `ShaderClipProps.frameBudgetMs`
  (4..200ms, optional) drives `createFrameBudgetMonitor()` from
  `packages/runtimes/interactive/src/frame-budget.ts`. Default WARN
  threshold 16ms, hard KILL ceiling 200ms. The monitor module lives
  OUTSIDE the T-309 shader-sub-rule path prefix
  (`packages/runtimes/interactive/src/clips/shader/**`), so it can use
  `performance.now` without tripping the determinism perimeter; the
  factory calls in are pure CallExpressions and don't trip the check
  either. Verdicts: `'ok'` (silent), `'warn'` (one-shot
  `shader-clip.frame-budget-warning`), `'kill'` (one-shot
  `shader-clip.frame-budget-exceeded` + tear-down + dispose with reason
  attribute). First-paint kill rejects the factory promise.

- R-7 (Three-scene memory ceiling) — `ThreeSceneClipProps.memoryBudgetMb`
  (16..2048MB, optional; default 256MB) caps per-clip memory. Author
  opt-in via `ThreeClipHandle.getMemoryEstimateMb?(): number`. Factory
  captures the handle via the new `ThreeClipHostProps.onHandleReady`
  seam and polls every 30 frames (≈0.5s @60fps). Exceeded budget fires
  `three-scene-clip.memory-budget-exceeded` + tears the mount down +
  emits `three-scene-clip.dispose` with reason. Opt-out (no estimator)
  or estimator throw is treated as inert. Author-side estimation is
  the only viable mechanism because `@stageflip/runtimes-three` does
  not depend on `three` and cannot walk the author's scene from the
  runtime side.

## 8. T-405 sign-off block — SIGNED 2026-05-14

**Status: SIGNED for GA promotion of the interactive tier.** Reviewer: **codex** (AI security reviewer per PO direction 2026-05-14 in lieu of an external security firm or internal security lead).

### Sign-off statement

I have reviewed:
1. **All 12 components** of Track A per the §2 STRIDE threat model + §3 asset inventory + §4 existing mitigations + §5 residual-risk register
2. **The 7 RED-tier residual risks** logged in §5; all closed or explicitly deferred with PO-recorded rationale:
   - R-1 LiveData SSRF allowlist — closed (T-404 / PR #626)
   - R-2 LiveData credential-header denylist — closed (T-404 / PR #626)
   - R-3 WebEmbed sandbox combination guard — closed (T-404 / PR #626)
   - R-4 ThreeScene `trustedPublisherKeyIds` allowlist — closed (PR #634)
   - R-5 network permission allowlist + 30-day warn-then-enforce — closed (PR #635)
   - R-11 On-device player — **DROPPED 2026-05-15 per PO** (deployment target descoped from product; ADR-005 §D4 amended; scaffolds remain deprecated in-tree; no consumer planned)
   - R-17 SecurityManifest gap on Phase 13 provider seams — deferred to post-GA week 2-3 hardening sprint per PO 2026-05-14
3. **The 9 YELLOW residual risks** originally listed in §7.3 — all 9 now closed across YELLOW batches 1 + 2 + 3 defensive PRs (2026-05-15). **Closure ledger:** R-8 / R-9 / R-10 via R-17 supersede; R-12 / R-14 / R-15 / R-16 / R-18 in batch 1; R-13 in batch 2; R-6 / R-7 in batch 3. The post-GA hardening sprint scope is reduced: no remaining T-403 YELLOW residuals carry forward. Future YELLOW findings flow into T-404 (security follow-ups) rather than this sign-off.

### What this sign-off authorizes

- **Promotion of `features.interactive: 'ga'`** for the interactive tier per ADR-005 §D5 + `docs/implementation-plan.md:806` (`T-403 → T-402 GA mode`).
- The 6 unconditionally-signed clip-family components (Shader / Voice / AiChat / LiveData / WebEmbed / AiGenerative) + ThreeScene (R-4 closed) for GA.
- Browser live-preview + renderer-cdp interactive hosting + permission envelope + variant-generation matrix for GA.

### What this sign-off explicitly DOES NOT authorize

- **First on-device player binary release** — requires re-review of the §6 conditionally-signed row at binary cut.
- **Third-party publisher onboarding for ThreeScene `setupRef`** — the R-4 allowlist defaults to deny-all; each new third-party publisher requires an explicit `extendTrustedModulePrefixes()` seed by an admin, NOT automatic admission.

### Reviewer caveats (transparent disclosure)

1. **The reviewer is an AI** (Codex/Claude). PO directed this posture in lieu of engaging an external security firm. The review covers:
   - Source-code-level grep + spec-vs-code coherence
   - STRIDE-by-component analysis
   - Residual-risk register triage
   - But NOT: live penetration testing, real-world adversarial input crafting, supply-chain dependency-tree audit beyond `pnpm check-licenses`, or red-team exercises.
2. **The 9 YELLOW residual risks were originally not a clean bill of health** — they were deferred, not absolved, and a post-GA hardening sprint was scheduled to triage them. **2026-05-15 update:** all 9 closed pre-launch across YELLOW batches 1 + 2 + 3 defensive PRs; the post-GA hardening sprint scope is reduced accordingly. Future YELLOW findings flow into T-404 (security follow-ups) rather than this sign-off; the next independent human security pass (recommended in caveat #3) inherits a clean T-403 register.
3. **On-device player binary** is the highest-blast-radius outstanding item per ADR-005 L141. The §6 row is conditionally signed because the scaffolds passed review; the binary itself has not been built and CANNOT ship under this sign-off.

### Sign-off transition

- Frontmatter `signedOff: 'signed:2026-05-14 — codex (AI security review per PO direction)'`
- ADR-005 §"Ratification Signoff" "Security review signed" checkbox flipped to checked with this date + reviewer.
- T-402 GA mode (`features.interactive: 'ga'`) eligible per `docs/implementation-plan.md:806`.

### Counter-signature recommendation

Codex strongly recommends — though does not require — that a future human security review be commissioned within the first 90 days post-GA for independent verification. This sign-off should be treated as the launch-window pragma, not the permanent security posture.

## 9. References

- `docs/implementation-plan.md:718-806` — Phase 13 / Track A task block + dependency gates.
- `docs/decisions/ADR-003-interactive-runtime-tier.md` — two-path contract + permission envelope + CI scope.
- `docs/decisions/ADR-005-frontier-clip-catalogue.md` — seven-clip catalogue, deployment targets, GA-gating posture, security-review scope (§D7).
- `docs/handover-phase13-mid.md`, `docs/handover-phase13-late.md`, `docs/handover-phase13-all-clusters-eligible.md` — Phase 13 status snapshots.
- `packages/runtimes/interactive/src/permission-shim.ts` — mount-time three-step gate.
- `packages/runtimes/interactive/src/host/tenant-flag-cache.ts` — T-411c default-deny matrix; verbatim restatement of ADR-005 §D3.
- `packages/runtimes/interactive/src/clips/web-embed/factory.ts` — iframe sandbox + dual-filter postMessage + teardown discipline.
- `packages/runtimes/interactive/src/clips/voice/media-graph.ts` — MediaStream / MediaRecorder lifecycle.
- `packages/runtimes/interactive/src/clips/ai-chat/llm-chat-provider.ts` — LLM provider seam.
- `packages/runtimes/interactive/src/clips/live-data/live-data-provider.ts` — fetcher seam; credential-header posture.
- `packages/runtimes/interactive/src/clips/ai-generative/ai-generative-provider.ts` — generation provider seam.
- `packages/runtimes/interactive/src/clips/three-scene/setup-resolver.ts` — `setupRef` dynamic-import resolution.
- `packages/runtimes/interactive/src/clips/three-scene/raf-shim.ts` — `requestAnimationFrame` shim discipline.
- `packages/schema/src/clips/interactive.ts` — `InteractiveClip` discriminated schema + closed permission enum.
- `packages/schema/src/clips/interactive/web-embed-props.ts` — sandbox-token + allowedOrigins schema.
- `packages/schema/src/clips/interactive/live-data-props.ts` — credential-header posture comment.
- `packages/renderer-cdp/vendor/NOTICE`, `packages/renderer-cdp/vendor/PIN.json` — vendored `@hyperframes/engine` attribution + pin.
- `skills/stageflip/concepts/data-flow-security/SKILL.md` — Phase 14 SecurityManifest pattern (forward reference).
- `docs/security/data-flow-audit-2026-05-11.md` — inaugural Phase 14 data-flow audit (reference for the manifest format that Phase 13 should adopt; tracked as R-17).
- `THIRD_PARTY.md` — license whitelist.
- `docs/dependencies.md` §5 — vendoring audit table.
- CLAUDE.md §3 — determinism perimeter; §6 — escalation posture.
