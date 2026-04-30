---
title: Web Embed Runtime
id: skills/stageflip/runtimes/web-embed
tier: runtime
status: substantive
last_updated: 2026-05-01
owner_task: T-394
related:
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/runtimes/live-data/SKILL.md
  - skills/stageflip/runtimes/ai-chat/SKILL.md
  - skills/stageflip/concepts/runtimes/SKILL.md
  - skills/stageflip/concepts/clip-elements/SKILL.md
  - skills/stageflip/concepts/auth/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
---

# Web Embed Runtime

`@stageflip/runtimes-interactive/clips/web-embed` ships the fourth
**γ-live** family. Standalone interactive-tier clip — no §3 runtime
to reuse, no frame-source dependency, no convergence test, **NO
provider seam**: the browser's `<iframe>` element IS the runtime; the
factory just creates and disposes the DOM. Different from voice /
ai-chat / live-data which all wrap a host-injected client.

`liveMount` lands here (T-393). `staticFallback` (poster-frame
screenshot) ships in T-394 — both halves of `family: 'web-embed'`
are now structurally complete.

## When to reach for it

- Embed a third-party widget — Twitter timeline, GitHub gist, Slack
  thread, payment widget — without rebuilding it natively.
- Display a live web tool (CodePen demo, Observable notebook, online
  prototype) inside a presentation.
- Show a tenant's own web property (dashboard, KPI tile, intranet
  page) with auth handled by the embedded page itself.

## When NOT

- A clip whose content is structured data you can render natively.
  Use `LiveDataClip` (T-391) — embedding a JSON endpoint via iframe
  is wasteful and bypasses your data layer.
- Authenticated iframes whose credentials must be cross-origin
  postMessage-delivered. Auth is the embedded page's responsibility;
  T-393 does not surface a credential-injection seam (ADR-005 §D7).
- Replacing the entire app shell with an iframe. The clip is sized
  to the clip transform; full-page embeds are an authoring concern.

## Architecture

The factory is event-driven; nothing here ticks on a frame. The
mount-harness security model still applies:

```
harness.mount(webEmbedClip, root, signal):
  1. permissionShim.mount(clip)         # 'network' → no-op grant in v1
       → tenant-denied: render staticFallback (T-394 once on main)
  2. registry.resolve('web-embed')      # registered at subpath import time
  3. factory(MountContext)              # builds iframe + handle
  4. signal.abort → handle.dispose()    # idempotent teardown
```

The factory returns a `WebEmbedClipMountHandle`:

```ts
interface WebEmbedClipMountHandle extends MountHandle {
  reload(): void;
  postMessage(message: unknown): void;
  onMessage(handler: (e: WebEmbedMessageEvent) => void): () => void;
}
```

`reload()` re-assigns `iframe.src` to the configured URL. `postMessage`
forwards to `iframe.contentWindow.postMessage(msg, targetOrigin)` —
where `targetOrigin = new URL(props.url).origin`, NOT `'*'` (the host
knows which page they embedded; reflexive `'*'` would defeat scoping).
`onMessage` subscribers receive ONLY events that pass BOTH filters:
`event.source === iframe.contentWindow` AND `event.origin ∈
props.allowedOrigins`.

### Visual surface

A single `<iframe>` element, no React tree. Sized via `width` /
`height` attributes (props overrides, then clip transform fallback).

```html
<iframe
  data-stageflip-web-embed-clip="true"
  src="https://example.com/embed"
  sandbox="allow-scripts allow-same-origin"
  width="800"
  height="600"
></iframe>
```

The iframe IS the surface. Hosts that want overlay UI compose at the
application layer.

### Schema (`webEmbedClipPropsSchema`)

```ts
webEmbedClipPropsSchema = z.object({
  url: z.string().url(),                            // absolute
  sandbox: z.array(z.string()).default([]),         // tokens; default = full sandbox
  allowedOrigins: z.array(z.string().url()).optional(),
  width: z.number().int().positive().optional(),    // defaults to clip transform
  height: z.number().int().positive().optional(),
  posterFrame: z.number().int().nonnegative().default(0),
}).strict();
```

`url` must be an absolute URL — the clip does not resolve relative
paths. `sandbox` accepts any string array; the schema does not
enforce a token allowlist (the security review T-403 decides which
tokens are permitted at tenant level). Default `[]` = fully sandboxed
(no scripts, no same-origin, no forms, no popups). `allowedOrigins`
is the postMessage filter — empty / undefined → `onMessage` never
fires. `width` / `height` are optional positive integers; default to
the clip transform's dimensions. `posterFrame` follows the
shader / three-scene / voice / ai-chat / live-data convention; T-394
consumes it.

### Permissions (`['network']`)

The clip declares `permissions: ['network']`. The shim treats
`network` as a no-op grant in v1 (ADR-003 §D6 follow-up adds tenant
allowlists later). **Pre-prompt is OFF by default** for `network`-
only clips — same posture as AiChat (T-389) and LiveData (T-391) —
the no-op grant short-circuits without a user-visible browser dialog
so a pre-prompt would be redundant. Hosts CAN opt in via
`MountContext.permissionPrePrompt: true` if they want to gate iframe
egress behind an in-app explanation modal.

### `componentRef.module` resolution

```
@stageflip/runtimes-interactive/clips/web-embed#WebEmbedClip
```

The subpath export points at
`packages/runtimes/interactive/src/clips/web-embed/index.ts`, whose
import side-effect registers `webEmbedClipFactory` against
`interactiveClipRegistry`. T-393 does NOT register a static-fallback
generator — T-394 lands that registration alongside
`defaultWebEmbedStaticFallback`.

## Why no provider seam?

Voice (T-387), AiChat (T-389), and LiveData (T-391) all wrap a
host-injected client (`TranscriptionProvider` / `LLMChatProvider` /
`Fetcher`) because the underlying transport (browser microphone API,
LLM provider package, host-supplied fetch) is what the clip code
delegates to. WebEmbed has no such delegation: the iframe IS the
transport, the embedded page IS the runtime, and the postMessage
surface IS the testable boundary. A `WebEmbedProvider` interface
would be a leaky abstraction wrapping `<iframe>` itself — there is
no upstream client to inject.

This is the architectural reason D-T393-10 reaffirms the T-391
D-T391-10 ruling: the four γ-live shapes (streaming with discriminated
callback, streaming with `onToken+signal`, request/response with
`signal`, no-seam-just-DOM) cannot share a `ProviderSeam<T>`
abstraction. The convention "host supplies the client" is honoured;
no abstraction is extracted. See `concepts/runtimes/SKILL.md` for the
codified ruling.

## Origin-filtered onMessage (security observability)

Inbound postMessage events are filtered in the order:

1. **Source check** — `event.source !== iframe.contentWindow` →
   drop with `reason: 'source-mismatch'`. A rogue page sending
   postMessage from a nested iframe with a forged origin would
   otherwise pass the origin filter; the source check is the
   primary defence.
2. **Origin check** — `event.origin ∉ props.allowedOrigins` →
   drop with `reason: 'origin-not-allowed'`. Configured origins
   (typed `z.string().url()`) are matched verbatim.

Both drop paths emit `web-embed-clip.message.dropped` with distinct
`reason` enums so a security reviewer can trace cross-origin attacks
(F-1 fix from spec PR #289 review: source-check failures must NOT
be conflated with origin-check failures).

## Resource cleanup contract (D-T393-7)

`MountHandle.dispose()` MUST tear down — in this order:

1. Remove the `window` `'message'` event listener
   (`window.removeEventListener('message', state.windowListener)`).
2. Set `iframe.src = 'about:blank'` BEFORE detach. Detaching alone
   does not halt the embedded page's scripts / network / timers in
   browsers like Firefox; the about:blank navigation forces document
   teardown.
3. Detach the iframe from the DOM
   (`iframe.parentNode.removeChild(iframe)`).
4. Clear the subscriber set (`state.messageHandlers.clear()`).
5. Emit `web-embed-clip.dispose`.

`signal.abort` triggers the SAME path. `dispose` is idempotent —
calling twice (or N times) is a no-op (the second-call exit short-
circuits at `state.disposed`).

A leaked iframe runs scripts in the background, holds network
connections, and may continue dispatching postMessage to the (now-
disposed) handler. The about:blank-before-detach step is the
architectural floor for T-393.

## Telemetry (privacy posture — D-T393-8)

The factory emits via `MountContext.emitTelemetry`:

| Event | Attributes |
|---|---|
| `web-embed-clip.mount.start` | `family`, `url`, `sandbox` (joined string), `hasAllowedOrigins` (boolean) |
| `web-embed-clip.mount.success` | `family` |
| `web-embed-clip.mount.failure` | `family`, `reason: 'invalid-props' \| 'permission-denied'`, `issues?` |
| `web-embed-clip.message.outbound` | `family`, `byteLength` integer, `targetOrigin` |
| `web-embed-clip.message.received` | `family`, `origin`, `byteLength` integer |
| `web-embed-clip.message.dropped` | `family`, `origin`, `reason: 'origin-not-allowed' \| 'source-mismatch' \| 'pre-mount' \| 'post-dispose'` |
| `web-embed-clip.reload` | `family` |
| `web-embed-clip.dispose` | `family` |

**postMessage payload bodies NEVER appear in telemetry attributes.**
`byteLength` is computed via `safeByteLength(value)` — a defensive
`JSON.stringify(value).length` wrapped in try/catch, returning `0`
for non-serializable data (Blob / ArrayBuffer / circular objects /
MessagePort) per F-6 escalation trigger from spec PR #289 review.
The full serialised event log is grep-tested against the secret body
in factory tests (AC #17).

`url`, `targetOrigin`, and `origin` ARE included — they are
configuration / event metadata, not user content. `sandbox` is
joined into a space-separated string (the iframe attribute format),
NOT the raw token array.

## Determinism contract

Web embed is **event-driven**, not frame-driven. There is no
convergence test (D-T393-6) and no `frameSource` dependency. The
interactive tier's broad `check-determinism` exemption (ADR-003 §D5)
applies; the shader sub-rule does NOT (path-matched at
`clips/{shader,three-scene}/**` only). The factory uses synchronous
DOM operations (`document.createElement`, `element.setAttribute`,
`element.removeChild`) — no timers, no rAF, no random, no time.

## Hard rules

The clip directory must contain **no** direct `fetch` /
`XMLHttpRequest` / `navigator.sendBeacon`. The iframe makes its own
network requests via the browser's standard navigation pipeline,
which runs in a separate document and is OUT of scope for the clip's
determinism. Pinned by T-393 AC #25 (grep-driven structural
assertion) plus the existing `check-determinism` gate.

postMessage payload bodies MUST NOT appear in telemetry attributes.
`byteLength` integer only. Same posture as AiChat (T-389) / LiveData
(T-391).

## Bundle + size

The package adds:

- `clips/web-embed/types.ts` — public types, no runtime cost.
- `clips/web-embed/factory.ts` — the iframe-creating factory + the
  message-filter state machine.
- `clips/web-embed/index.ts` — subpath entry, side-effect register,
  re-exports.

`size-limit` budgets are enforced by the existing CI gate.

## Static fallback (T-394)

When the harness routes to the static path AND the clip's authored
`staticFallback` is empty, `webEmbedStaticFallbackGenerator`
substitutes a deterministic Element[] derived from the clip's
`liveMount.props`:

- A single `ImageElement` filling the clip's bounds with `src =
  posterImage.src` (a `data:` URL baked at authoring time).
- When `posterImage` is absent, a single placeholder `TextElement`
  (empty text, `id: 'web-embed-static-fallback-placeholder'`) is
  emitted instead. The host overrides via app-level i18n.

### Schema addition (`posterImage?`)

T-394 extends `webEmbedClipPropsSchema` with an optional
`posterImage` field:

```ts
posterImage: z.object({
  src: z.string().refine(s => s.startsWith('data:'), ...),
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']).optional(),
}).strict().optional()
```

**v1 accepts ONLY `data:` URLs** (the refine enforces this).
`http(s):` URLs are deferred per the out-of-scope deferral —
accepting external URLs would push the fetch question to the
frame-runtime export path, which `check-determinism` forbids inside
`clips/**`. Widening to `http(s)` is gated on a determinism-skill
ruling for the frame-runtime image-fetch path. ADR-005 §D1 footnote
`^liveData-v1` documents the analogous LiveData chart deferral.

Backward-compatible: T-393 fixtures without the field continue to
validate. The schema-level `AssetRef` regex (`^asset:<id>$`) does
not accept data URLs; the generator casts `src as
ImageElement['src']` to bypass it (same posture as
`defaultVoiceStaticFallback` — the data URL is the authoring-time
bake, not a storage-resolved asset reference).

### Layout

The ImageElement fills the canvas exactly: `transform = { x: 0,
y: 0, width, height, rotation: 0, opacity: 1 }`. No overflow guard
needed — there's only one element either way.

### Determinism

Pure transformation. No `Math.random` / `Date.now` /
`performance.now`. The poster URL is passed through verbatim into
the ImageElement; no parsing, no fetching. Same posture as
`defaultAiChatStaticFallback` (T-390), `defaultLiveDataStaticFallback`
(T-392), and `defaultVoiceStaticFallback` (T-388).

### Telemetry (privacy posture — D-T394-4)

| Event | Attributes |
|---|---|
| `web-embed-clip.static-fallback.rendered` | `family`, `reason`, `width`, `height`, `hasPoster` boolean, `posterSrcLength` integer |

**The poster URL string NEVER appears in telemetry attributes.**
`posterSrcLength` is `posterImage.src.length` (or `0` when absent)
— a 50KB inline data URL would balloon every telemetry event, so
the integer length is what telemetry consumers get. Pinned via grep
on captured event payloads in the static-fallback test (AC #11).

The `reason` is forwarded verbatim from the harness — `'authored' |
'permission-denied' | 'tenant-denied' | 'export-static'`.

### Registration (T-388a)

`packages/runtimes/interactive/src/clips/web-embed/index.ts` now
side-effect-registers two things at subpath import time:

```ts
interactiveClipRegistry.register('web-embed', webEmbedClipFactory);  // T-393
staticFallbackGeneratorRegistry.register('web-embed', webEmbedStaticFallbackGenerator);  // T-394
```

The harness's family-agnostic dispatch (T-388a) picks up the
registration without further changes.

## Cross-references

- T-389 / T-390 — sister AiChatClip pair (network permission,
  telemetry privacy posture).
- T-391 / T-392 — sister LiveDataClip pair (closest in shape; same
  second-γ pattern, `network` permission). T-393 differs by having
  no provider seam.
- T-388 / T-388a — voice static-fallback (the data-URL ImageElement
  cast pattern T-394 reuses) and the static-fallback generator
  registry T-394 registers against.
- ADR-005 §D7 — credential scoping; the iframe's auth is the embedded
  page's responsibility, not the host's.
