---
title: Live Data Runtime
id: skills/stageflip/runtimes/live-data
tier: runtime
status: substantive
last_updated: 2026-04-30
owner_task: T-391
related:
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/runtimes/ai-chat/SKILL.md
  - skills/stageflip/runtimes/voice/SKILL.md
  - skills/stageflip/concepts/runtimes/SKILL.md
  - skills/stageflip/concepts/clip-elements/SKILL.md
  - skills/stageflip/concepts/auth/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
---

# Live Data Runtime

`@stageflip/runtimes-interactive/clips/live-data` ships the third
**γ-live** family. Standalone interactive-tier clip — no §3 runtime
to reuse, no frame-source dependency, no convergence test. Wraps a
host-injected `Fetcher` callable to fetch a single response from a
configured endpoint at mount time, surfaces parsed data through a
typed `MountHandle`, emits typed lifecycle telemetry.

`liveMount` lands here (T-391). `staticFallback` (cached snapshot
rendered as text) ships in T-392. Chart-aware rendering for both halves
is a follow-up task gated on T-406 (Chart clip family, γ-supporting);
see ADR-005 §D1 footnote `^liveData-v1`.

## When to reach for it

- A slide that displays a snapshot of an external dataset — current
  weather, build status, a stock ticker, a sales-dashboard KPI.
- An interactive teaching surface that demonstrates an API response
  shape.
- Any presentation where a value should be re-fetched on demand
  (host-driven `refresh()`).

## When NOT

- A continuously-updating live feed. T-391 is **one-shot at mount +
  manual refresh**. Polling / WebSocket / SSE are future tasks gated on
  a determinism-skill ruling — wall-clock cadences intersect the
  determinism floor.
- A clip that needs to make authenticated requests with credentials
  baked into the schema. Auth is the host's responsibility —
  credentials are NEVER in clip props (ADR-005 §D7). The host wraps a
  `Fetcher` that adds auth headers at request time.
- A chart-rendering surface in v1. Use the chart family (T-406)
  directly when it lands.

## Architecture

The factory is event-driven; nothing here ticks on a frame. The
mount-harness security model still applies:

```
harness.mount(liveDataClip, root, signal):
  1. permissionShim.mount(clip)         # 'network' → no-op grant in v1
       → tenant-denied: render staticFallback (T-392 once on main)
  2. registry.resolve('live-data')      # registered at subpath import time
  3. factory(MountContext)              # builds React tree + handle
  4. signal.abort → handle.dispose()    # idempotent teardown
```

The factory returns a `LiveDataClipMountHandle`:

```ts
interface LiveDataClipMountHandle extends MountHandle {
  refresh(): Promise<void>;
  getData(): unknown | undefined;
  getStatus(): number | undefined;
  onData(handler: (e: DataEvent) => void): () => void;
  onError(handler: (e: ErrorEvent) => void): () => void;
}
```

The mount-time fetch is deferred to the next microtask
(`queueMicrotask`) so callers can subscribe `onData` / `onError` after
the factory's promise resolves but before the fetch settles. Without
the deferral the very first resolution races subscriber attachment.

`refresh()` re-runs the configured fetch when `refreshTrigger:
'manual'`; rejects with `RefreshTriggerError` (typed throw, NOT a
silent no-op) when `refreshTrigger: 'mount-only'`.

### Visual surface

A minimal React tree with no English strings (CLAUDE.md §10):

```tsx
<div data-stageflip-live-data-clip="true">
  <output data-role="live-data" />
</div>
```

Host applications style + render via the data attribute; the package
ships no copy and no chart. Subscribers to `onData` mirror the resolved
payload into the host's own DOM. Chart rendering is the T-406
follow-up.

### Schema (`liveDataClipPropsSchema`)

```ts
liveDataClipPropsSchema = z.object({
  endpoint: z.string().url(),                                          // absolute
  method: z.enum(['GET', 'POST']).default('GET'),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),                                        // POST JSON payload
  parseMode: z.enum(['json', 'text']).default('json'),
  refreshTrigger: z.enum(['mount-only', 'manual']).default('mount-only'),
  posterFrame: z.number().int().nonnegative().default(0),
}).strict();
```

`endpoint` must be an absolute URL — the clip does not resolve relative
paths. `method` is restricted to GET / POST in v1; PUT / DELETE / etc.
are future tasks. `headers` accepts arbitrary string-to-string entries —
the schema does **not** enforce a key allowlist; credential headers
(`Authorization`, `Cookie`, `X-API-Key`, etc.) MUST NOT appear here
(ADR-005 §D7) and the host's `Fetcher` is the place to inject auth at
request time. Documenting this in the schema rather than enforcing it
with a Zod refine is intentional — a refine would be security theatre
(a host could still smuggle credentials via `X-Custom-Auth`); the real
defence is at the network gate (T-403 tenant allowlists, future).
`body` is `unknown` because the schema accepts arbitrary JSON-shaped
payloads; the factory `JSON.stringify`s it for POST. `parseMode`
controls JSON parsing on the response side — `'text'` returns the raw
body verbatim. `refreshTrigger` is the polling-control surface;
`'interval'` is reserved for a future task. `posterFrame` follows the
shader / three-scene / voice / ai-chat convention; T-392 consumes it.

### Permissions (`['network']`)

The clip declares `permissions: ['network']`. The shim treats `network`
as a no-op grant in v1 (ADR-003 §D6 follow-up adds tenant allowlists
later). **Pre-prompt is OFF by default** for `network`-only clips — same
posture as AiChat (T-389) — the no-op grant short-circuits without a
user-visible browser dialog so a pre-prompt would be redundant. Hosts
CAN opt in via `MountContext.permissionPrePrompt: true` if they want to
gate network egress behind an in-app explanation modal.

### `componentRef.module` resolution

```
@stageflip/runtimes-interactive/clips/live-data#LiveDataClip
```

The subpath export points at
`packages/runtimes/interactive/src/clips/live-data/index.ts`, whose
import side-effect registers `liveDataClipFactory` against
`interactiveClipRegistry`. T-391 does NOT register a static-fallback
generator — T-392 lands that registration alongside
`defaultLiveDataStaticFallback`.

## LiveDataProvider seam

```ts
interface LiveDataProvider {
  fetchOnce(args: {
    url: string;
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body: string | undefined;     // already stringified by the factory
    signal: AbortSignal;
  }): Promise<{
    status: number;
    bodyText: string;
    contentType: string | undefined;
  }>;
}
```

T-391 ships two implementations:

1. **`HostFetcherProvider({ fetcher })`** — wraps a host-supplied
   `Fetcher` callable (typically `globalThis.fetch.bind(globalThis)` in
   production, a wrapped fetcher with tenant headers in multi-tenant
   deployments, or a test double). The clip directory **NEVER**
   references `globalThis.fetch` directly per CLAUDE.md §3 (T-391
   AC #26 grep-pinned structural assertion). The host vetted egress at
   the network-permission gate (T-385) and is responsible for any auth
   headers, CSP allowlisting, and tenant scoping at request time. Same
   posture AiChat uses for `LLMProvider`.
2. **`InMemoryLiveDataProvider({ scripted })`** — resolves a scripted
   `Record<url, ScriptedResponse>`. Used by tests; production code
   never instantiates. Honours an already-aborted signal with an
   `AbortError`-named Error so the factory's abort-discipline path
   surfaces the same shape it would see from a real provider.

A `@stageflip/http-abstraction` package mirroring
`@stageflip/llm-abstraction` is a **future asset-gen task** — Phase 14
ADR-006 covers the pattern. T-391 ships the seam shape; tenant-specific
adapters do not land here.

### Why no default real fetcher?

CLAUDE.md §3 forbids `fetch()` / `XMLHttpRequest` /
`navigator.sendBeacon` inside `packages/runtimes/**/src/clips/**`. The
host-injected `Fetcher` pattern is the cleanest way to honour this:
the clip code never touches the global; the host (or an upstream
abstraction package) does. This mirrors AiChat's posture exactly.

The escalation trigger in `docs/tasks/T-391.md` flags the alternative
(a `// determinism-safe:` escape on a default `RealLiveDataProvider`)
as something to push back on — the §3 rule's intent is that the
determinism floor stays clean even when the architectural floor permits.

## Resource cleanup contract (D-T391-7)

`MountHandle.dispose()` MUST tear down — in this order:

1. `AbortController.abort()` on the active per-fetch controller (if a
   fetch is in flight). The provider's `signal`-aware path surfaces
   the rejection; the factory suppresses the rejected onError event on
   the dispose path so a late `aborted` event does not surface to
   subscribers.
2. Drop the resolved-data reference (`state.latestData = undefined`,
   `state.latestStatus = undefined`).
3. Unsubscribe all `onData` and `onError` handlers
   (`state.dataHandlers.clear()`, `state.errorHandlers.clear()`).
4. Unmount the React root (`reactRoot.unmount()`).
5. Emit `live-data-clip.dispose`.

`signal.abort` triggers the SAME path. `dispose` is idempotent —
calling twice (or N times) is a no-op (the second-call exit short-
circuits at `state.disposed`).

A leaked fetch costs the host's network budget — measurable cost, even
when a single fetch's overhead is small. This is the architectural
floor for T-391; AC #16-#17 pin it via spy on the provider-supplied
`AbortController.signal`.

## Telemetry (privacy posture — D-T391-8)

The factory emits via `MountContext.emitTelemetry`:

| Event | Attributes |
|---|---|
| `live-data-clip.mount.start` | `family`, `endpoint`, `method`, `parseMode`, `refreshTrigger` |
| `live-data-clip.mount.success` | `family` |
| `live-data-clip.mount.failure` | `family`, `reason: 'invalid-props' \| 'fetcher-unavailable' \| 'permission-denied'`, `issues?` |
| `live-data-clip.fetch.started` | `family`, `requestId`, `endpoint`, `method` |
| `live-data-clip.fetch.resolved` | `family`, `requestId`, `status`, `durationMs`, `bodyByteLength`, `parseMode` |
| `live-data-clip.fetch.error` | `family`, `requestId`, `errorKind: 'network' \| 'parse' \| 'aborted'` |
| `live-data-clip.dispose` | `family` |

**The response body NEVER appears in telemetry attributes.** The
privacy posture is a per-event invariant: body-derived attributes are
integers only (`bodyByteLength`). Pinned via grep on captured event
payloads in the factory test (AC #18). Future tenant adapters and
cloud providers must preserve this invariant.

`endpoint`, `method`, `parseMode`, `refreshTrigger`, `status`, and
`requestId` ARE included — they are configuration / response metadata,
not user content. `errorKind` is a fixed enum.

## Determinism contract

Live data is **event-driven**, not frame-driven. There is no
convergence test (D-T391-6) and no `frameSource` dependency. The
interactive tier's broad `check-determinism` exemption (ADR-003 §D5)
applies; the shader sub-rule does NOT (path-matched at
`clips/{shader,three-scene}/**` only). The factory uses
`Date.now()` / `performance.now()` for fetch `durationMs` measurements
— wall-clock by definition.

The clip directory is **structurally** prevented from calling
`globalThis.fetch` / `XMLHttpRequest` / `navigator.sendBeacon`: the
factory test grep-walks every non-test file in `clips/live-data/` and
fails if any match (T-391 AC #26). This is the stronger guarantee that
backstops `check-determinism`.

## Hard rules

The clip directory must contain **no** direct `fetch` /
`XMLHttpRequest` / `navigator.sendBeacon`. Production fetch goes
through the host-injected `Fetcher`. Pinned by T-391 AC #26 plus the
existing `check-determinism` gate.

Credentials MUST NOT appear in `liveMount.props.headers`. The schema
documents this responsibility but does not enforce it with a refine —
a refine would be security theatre. The real defence is at the network
gate (T-403 tenant allowlists, future).

## Bundle + size

The package adds:

- `clips/live-data/types.ts` — public types, no runtime cost.
- `clips/live-data/live-data-provider.ts` — interface + two thin
  classes (`HostFetcherProvider` is ~10 lines of body; `InMemoryLiveDataProvider`
  is a small Promise wrapper).
- `clips/live-data/factory.ts` — the React-mounted factory + the
  fetch-lifecycle state machine.
- `clips/live-data/index.ts` — subpath entry, side-effect register,
  re-exports.

`size-limit` budgets are enforced by the existing CI gate.

## Cross-references

- T-389 / T-390 — sister AiChatClip pair. Same second-γ pattern, same
  host-injected-client posture, same telemetry-privacy invariant.
- T-388a — static-fallback generator registry T-392 will register
  against.
- T-406 — chart family (γ-supporting); follow-up task wires chart-aware
  rendering once on `main`. ADR-005 §D1 footnote `^liveData-v1`
  documents the v1 (text-only) vs end-state (chart) split.
- ADR-003 §D5 — determinism + frame-source posture for interactive
  clips.
- ADR-005 §D1 — clip table; §D7 — credential scoping (real defence is
  at the network gate, T-403).
