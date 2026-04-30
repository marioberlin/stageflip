---
title: AI Chat Runtime
id: skills/stageflip/runtimes/ai-chat
tier: runtime
status: substantive
last_updated: 2026-04-29
owner_task: T-389
related:
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/runtimes/voice/SKILL.md
  - skills/stageflip/concepts/runtimes/SKILL.md
  - skills/stageflip/concepts/clip-elements/SKILL.md
  - skills/stageflip/concepts/auth/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
---

# AI Chat Runtime

`@stageflip/runtimes-interactive/clips/ai-chat` ships the second
**γ-live** family. Standalone interactive-tier clip — no §3 runtime
to reuse, no frame-source dependency, no convergence test. Wraps
`@stageflip/llm-abstraction`'s provider-neutral `LLMProvider` to expose
a scoped chat with a per-slide system prompt baked into the schema;
streams tokens to subscribers; emits typed lifecycle telemetry.

`liveMount` lands here (T-389). `staticFallback` (captured transcript)
is T-390 — until that ships, the harness routes the static path to the
authored `staticFallback` array verbatim.

## When to reach for it

- A slide that asks the audience a question and lets a scoped LLM
  answer in-presentation.
- An interactive teaching surface where the system prompt frames the
  topic and the user types follow-ups.
- A demo of LLM behaviour with strict per-slide guardrails (system
  prompt is part of the schema, not user-typed).

## When NOT

- A general-purpose chat. AiChatClip is **per-slide**: the system
  prompt is baked into the schema, history is per-mount, and there is
  no cross-mount memory. A general chat surface lives at the
  application layer outside the clip.
- Tool-use / function-calling. The seam supports it via
  `@stageflip/llm-abstraction`, but T-389's `aiChatClipPropsSchema`
  does NOT surface a tool definitions field. A future task widens the
  schema if cluster authors need it.
- Vision / image inputs. T-389 is text-only. Multimodal inputs are a
  future task.
- Voice dictation as the input. `VoiceClip` (T-387) is the dictation
  surface; AiChatClip receives text.

## Architecture

The factory is event-driven; nothing here ticks on a frame. The
mount-harness security model still applies:

```
harness.mount(aiChatClip, root, signal):
  1. permissionShim.mount(clip)         # 'network' → no-op grant in v1
       → tenant-denied: render staticFallback
  2. registry.resolve('ai-chat')        # registered at subpath import time
  3. factory(MountContext)              # builds React tree + handle
  4. signal.abort → handle.dispose()    # idempotent teardown
```

The factory returns an `AiChatClipMountHandle`:

```ts
interface AiChatClipMountHandle extends MountHandle {
  send(userMessage: string): Promise<void>;
  onTurn(handler: (e: TurnEvent) => void): () => void;
  reset(): void;
}
```

`send(userMessage)` runs ONE turn end-to-end: emits a `user` event,
forwards the system prompt + accumulated history + new message to the
configured `LLMChatProvider`, streams `assistant-token` events as
tokens arrive, then emits `assistant-final` carrying the FULL assistant
text. The promise resolves after the final event fires. `reset` drops
history (the system prompt persists; it's part of the schema).
`dispose` is the terminal step (idempotent).

### Visual surface

A minimal React tree with no English strings (CLAUDE.md §10):

```tsx
<div data-stageflip-ai-chat-clip="true">
  <output data-role="message-stream" />
  <textarea data-role="user-input" />
  <button type="button" data-action="send" />
</div>
```

Host applications style + label via the data attributes; the package
ships no copy. Subscribers to `onTurn` mirror the running message
stream into the host's own DOM (the package emits no message-stream
DOM mirror — the data attribute is the contract for hosts to override).

### Schema (`aiChatClipPropsSchema`)

```ts
aiChatClipPropsSchema = z.object({
  systemPrompt: z.string().min(1),         // baked-in, per-slide
  provider: z.string().min(1),             // 'openai' | 'anthropic' | 'google' | tenant-supplied
  model: z.string().min(1),
  maxTokens: z.number().int().positive().default(512),
  temperature: z.number().min(0).max(1.5).default(0.7),
  multiTurn: z.boolean().default(true),
  posterFrame: z.number().int().nonnegative().default(0),
}).strict();
```

`systemPrompt` is the clip's identity — empty rejects.
`provider` accepts any non-empty string so tenant-supplied adapters
extend without a schema bump (the underlying `@stageflip/llm-abstraction`
constrains the v1 set to `'anthropic' | 'google' | 'openai'`).
`temperature` is bounded `[0, 1.5]` matching the provider-neutral
primitive's accepted range. `multiTurn: false` is a single-turn
guardrail — the clip rejects a second `send` with a typed
`MultiTurnDisabledError` (D-T389-4 + AC #13). `posterFrame` follows
the shader / three-scene / voice convention; T-390 consumes it for the
captured-transcript poster.

### Permissions (`['network']`)

The clip declares `permissions: ['network']`. The shim treats
`network` as a no-op grant in v1 (ADR-003 §D6 follow-up adds tenant
allowlists). **Pre-prompt is OFF by default** for `network`-only
clips — the no-op grant short-circuits without a user-visible browser
dialog, so a pre-prompt would be redundant noise. Hosts CAN opt in via
`MountContext.permissionPrePrompt: true` if they want to gate LLM
spend behind an in-app explanation modal.

### `componentRef.module` resolution

```
@stageflip/runtimes-interactive/clips/ai-chat#AiChatClip
```

The subpath export points at
`packages/runtimes/interactive/src/clips/ai-chat/index.ts`, whose
import side-effect registers `aiChatClipFactory` against
`interactiveClipRegistry`. T-389 does NOT register a static-fallback
generator — T-390 lands that registration alongside
`defaultAiChatStaticFallback`.

## LLMChatProvider seam

```ts
interface LLMChatProvider {
  streamTurn(args: {
    systemPrompt: string;
    history: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>;
    userMessage: string;
    model: string;
    maxTokens: number;
    temperature: number;
    onToken: (token: string, turnId: string) => void;
    signal: AbortSignal;
  }): Promise<{ finalText: string; turnId: string }>;
}
```

T-389 ships two implementations:

1. **`RealLLMChatProvider`** — wraps an `LLMProvider` from
   `@stageflip/llm-abstraction`. Constructor accepts EXACTLY ONE of
   `{ provider }` (pre-built; preferred for tests) or `{ spec }`
   (calls `createProvider(spec)` once at construction time). On
   provider rejection, `streamTurn` rethrows via `classifyError` so
   the host's error UI can branch on `error.kind` (`'rate_limited'`,
   `'authentication'`, `'aborted'`, etc.).
2. **`InMemoryLLMChatProvider({ scripted, finalText?, rejectWith?, timers? })`** —
   emits a scripted token sequence over time; resolves with the
   concatenated text (or `finalText` override). Optional `rejectWith`
   pins the AC #12 error path. Honors the `signal`: aborts produce an
   `AbortError` rejection.

A custom-provider seam (e.g., a tenant's self-hosted endpoint) is a
**future asset-gen task** — Phase 14 ADR-006 covers the pattern.
T-389 ships the seam shape; tenant-specific adapters do not land here.

## Resource cleanup contract (D-T389-7)

`MountHandle.dispose()` MUST tear down — in this order:

1. `AbortController.abort()` on the active per-turn controller (if a
   turn is in flight). The provider's `signal`-aware path surfaces
   the rejection; the factory swallows it on the dispose path so a
   late `assistant-final` does not surface to subscribers.
2. Drop accumulated message history — clears the array so GC can
   collect (`state.history.length = 0`).
3. Unsubscribe all `onTurn` handlers (`state.handlers.clear()`).
4. Unmount the React root (`reactRoot.unmount()`).
5. Emit `ai-chat-clip.dispose`.

`signal.abort` triggers the SAME path. `dispose` is idempotent —
calling twice (or N times) is a no-op (the second-call exit short-
circuits at `state.disposed`).

A leaked LLM call wastes tokens — measurable cost. This is the
architectural floor for T-389; AC #15-#19 pin it via spy on the
provider-supplied `AbortController` plus internal-state reads via
the test seam (`__test__.historySize`, `handlerCount`,
`isAbortAttached`).

## Telemetry (privacy posture — D-T389-8)

The factory emits via `MountContext.emitTelemetry`:

| Event | Attributes |
|---|---|
| `ai-chat-clip.mount.start` | `family`, `provider`, `model` |
| `ai-chat-clip.mount.success` | `family` |
| `ai-chat-clip.mount.failure` | `family`, `reason: 'invalid-props' \| 'provider-unavailable' \| 'permission-denied'` |
| `ai-chat-clip.turn.started` | `family`, `turnId`, `userMessageLength` |
| `ai-chat-clip.turn.finished` | `family`, `turnId`, `durationMs`, `tokenCount` |
| `ai-chat-clip.turn.error` | `family`, `turnId`, `errorKind` |
| `ai-chat-clip.dispose` | `family` |

**Neither user-message body nor assistant-completion body appears in
telemetry attributes.** The privacy posture is a per-event invariant:
text-derived attributes are integers only (`userMessageLength`,
`tokenCount`). Pinned via grep on captured event payloads in the
factory test (AC #20). Future tenant adapters and cloud providers
must preserve this invariant.

`provider` and `model` ARE included — they are configuration, not
user content. `errorKind` derives from `LLMError.kind` (or the error
constructor name when the provider does not return an `LLMError`).

## Determinism contract

AI chat is **event-driven**, not frame-driven. There is no
convergence test (D-T389-6) and no `frameSource` dependency. The
interactive tier's broad `check-determinism` exemption (ADR-003 §D5)
applies; the shader sub-rule does NOT (path-matched at
`clips/{shader,three-scene}/**` only). The factory uses
`Date.now()` / `performance.now()` for turn timestamps and
`durationMs` measurements — wall-clock by definition.

## Bundle + size

The package adds:

- A small (~2 KB min+gz) factory + provider-seam module.
- One new dep: `@stageflip/llm-abstraction` (workspace).
- No new peer deps beyond the existing `react` / `react-dom`.

## Implementation map

| File | Purpose |
|---|---|
| `packages/runtimes/interactive/src/clips/ai-chat/types.ts` | `TurnEvent`, `AiChatClipMountHandle`, `MultiTurnDisabledError`, failure-reason enum |
| `packages/runtimes/interactive/src/clips/ai-chat/factory.ts` | `aiChatClipFactory` + `AiChatClipFactoryBuilder` + React mount tree |
| `packages/runtimes/interactive/src/clips/ai-chat/llm-chat-provider.ts` | `LLMChatProvider` interface + `RealLLMChatProvider` (wraps `@stageflip/llm-abstraction`) + `InMemoryLLMChatProvider` (tests) |
| `packages/runtimes/interactive/src/clips/ai-chat/index.ts` | Subpath module + side-effect registry registration |
| `packages/schema/src/clips/interactive/ai-chat-props.ts` | `aiChatClipPropsSchema` |

## Pattern-evaluation outcome (T-389 D-T389-10)

T-389 is the **third application of the second γ pattern**
(standalone, event-driven, no §3 reuse). After T-387 (voice) and
T-388 (voice static-fallback half), T-389 + T-390 round out the
ai-chat family. The shared parts between T-387 / T-389 are:

1. **Conventions**, not duplication: schema discriminator file
   (5-line shape), subpath export (4-line block), side-effect
   registration (1 line), telemetry-event naming convention.
2. **Logic overlap**: factory skeleton (state machine, dispose,
   abort wiring) is structurally similar but uses different
   primitives (MediaRecorder vs. LLM stream). Inlining is shorter
   and clearer than abstracting.
3. **Provider-seam pattern**: `TranscriptionProvider` (T-387) and
   `LLMChatProvider` (T-389) share a shape — interface + start /
   stream + tests via in-memory impl. **This is the candidate for
   future extraction.** With only two seams it isn't yet "three
   similar lines of meaningful logic"; a third seam at T-391
   (LiveDataClip's data-fetch path) would earn the move to a shared
   `ProviderSeam<T>`.

**Decision**: no abstraction extraction at T-389. The skill
documents the eligibility for a future `ProviderSeam<T>` extraction
at T-391 — that is when the three-similar-lines rule fires.
Future Implementers (T-391 live-data, T-393 web-embed, T-395
ai-generative) inherit this precedent.

## Static fallback (T-390 — pending)

T-390 (S-sized, separate plan row) ships
`defaultAiChatStaticFallback` + `aiChatStaticFallbackGenerator` and
extends `aiChatClipPropsSchema` with an optional
`capturedTranscript?: Array<{ role, text }>` field. Until T-390
merges, `family: 'ai-chat'` clips MUST author a non-empty
`staticFallback` array (the schema's non-empty refine enforces it
at parse time); the harness renders that authored array verbatim on
the static path.

## Related

- Contract types + registry: `runtimes/contract/SKILL.md`
- Permission flow UX (T-385): `concepts/auth/SKILL.md`
- Sister γ-live family (voice, T-387 + T-388): `runtimes/voice/SKILL.md`
- LLM primitive being wrapped: `@stageflip/llm-abstraction`
- Owning task: T-389 (`liveMount`); pairs with T-390 (`staticFallback`).
