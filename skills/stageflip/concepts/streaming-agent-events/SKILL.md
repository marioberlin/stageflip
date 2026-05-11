---
title: Streaming agent events — SSE transport for ExecutorEvents
id: skills/stageflip/concepts/streaming-agent-events
tier: concept
status: substantive
last_updated: 2026-05-11
owner_task: T-442
related:
  - skills/stageflip/concepts/agent-executor/SKILL.md
  - skills/stageflip/concepts/agent-validator/SKILL.md
  - skills/stageflip/concepts/optimistic-placeholders/SKILL.md
  - skills/stageflip/concepts/llm-abstraction/SKILL.md
---

# Streaming agent events

The agent's three-step pipeline (Planner → Executor → Validator) can
take tens of seconds end-to-end, especially when the Executor calls
asset-generation tools that dispatch to long-latency provider adapters
(image-gen, video-gen, music-gen). The non-streaming
`POST /api/agent/execute` route buffers the entire run before
returning a single JSON blob — the editor UI can do nothing until
every step is complete.

T-442 introduces a **streaming variant**:

```
POST /api/agent/execute?stream=true
Content-Type: application/json
Accept: text/event-stream
```

Each `ExecutorEvent` is emitted as it occurs, framed as a Server-Sent
Event on the wire, and consumed by the editor via
`consumeAgentStream` (re-exported from `@stageflip/editor-shell`).

This SKILL is the contract for the transport. The semantic event model
itself lives in
[`agent-executor`](../agent-executor/SKILL.md).

## Why SSE (not WebSocket / Long-poll / gRPC-Web)

- **Unidirectional**: the server is the only producer; the client
  never needs to send mid-stream messages.
- **HTTP-native**: works through every load balancer / proxy that
  speaks HTTP/1.1 keep-alive without special config.
- **Auto-reconnect-friendly**: `EventSource` has built-in
  `lastEventId` plumbing if we ever add resumability.
- **Cheap**: no extra dependency on the client; `fetch` +
  `ReadableStream` works out of the box.
- **Cancellation**: `AbortController` on the fetch side propagates
  through Next.js's `request.signal` to the executor's
  `AbortSignal`.

WebSocket would buy us bidirectional traffic we don't need and would
require a separate auth path. Long-poll would round-trip per event,
defeating the latency win. gRPC-Web would force us to spec a `.proto`
for the executor's union — overkill for a single-direction stream.

## Wire format

```
id: 0
event: step-start
data: {"kind":"step-start","stepId":"s1"}

id: 1
event: tool-call
data: {"kind":"tool-call","stepId":"s1","name":"create_slide","args":{...}}

id: 2
event: tool-result
data: {"kind":"tool-result","stepId":"s1","name":"create_slide","result":{...},"isError":false}

id: 3
event: patch-applied
data: {"kind":"patch-applied","stepId":"s1","patch":[{...}]}

id: 4
event: step-end
data: {"kind":"step-end","stepId":"s1","status":"ok"}

id: 5
event: plan-end
data: {"kind":"plan-end","finalDocument":{...}}

id: 6
event: validation-complete
data: {"kind":"validation-complete","validation":{"tier":"pass",...}}
```

Each frame:

- starts with `id: <monotonic-integer>` (per-stream, not cross-request),
- carries `event: <kind>` so an `EventSource` consumer can attach
  per-event listeners,
- carries `data: <single-line JSON>` (the full event payload — same
  shape as the JSON-route's `events[]` entries),
- terminates with the SSE-mandated blank line (`\n\n`).

Response headers:

- `content-type: text/event-stream; charset=utf-8`
- `cache-control: no-store`
- `connection: keep-alive`
- `x-accel-buffering: no` — disables nginx / Vercel reverse-proxy
  buffering so the client sees frames as they're produced.

## Event taxonomy

| Wire event           | Source       | Notes                                                        |
|---------------------|--------------|--------------------------------------------------------------|
| `step-start`         | Executor    | One per plan step.                                            |
| `tool-call`          | Executor    | LLM-issued tool invocation; carries `args`.                   |
| `tool-result`        | Executor    | Tool's structured response; `isError` discriminates.          |
| `patch-applied`      | Executor    | JSON-Patch ops the tool emitted to the document.              |
| `step-end`           | Executor    | Status: `ok` / `aborted` / `max_iterations` / `bundle_limit_exceeded`. |
| `plan-end`           | Executor    | Final document; emitted once.                                 |
| `validation-complete`| **Transport** | Validator's verdict — folded into the stream after `plan-end`. NOT in canonical `ExecutorEvent` union. |
| `plan-cancelled`     | **Transport** | Emitted when the AbortSignal fires mid-stream. Truncation marker. |

The two transport-only events (`validation-complete`,
`plan-cancelled`) live on the wire only. They are members of
`StreamEvent` (the wire union) but NOT of `ExecutorEvent` (the
canonical executor union). Consumers that only care about the
canonical shape filter them out; consumers that want the full
picture (the editor shell) handle them too.

## Cancellation contract

| Client action | Server response |
|---|---|
| `fetch(..., { signal })` aborted | `request.signal.aborted` flips → forwarded to executor → step returns `step-end status: 'aborted'` → stream emits `plan-cancelled` → stream closes |
| TCP close mid-stream | Same path — Next.js surfaces this on `request.signal` |
| Stream completes normally | `plan-end` → `validation-complete` → close |

Server-side cleanup:

- Pending patches in the executor's `patchSink` are drained and dropped.
- LLM in-flight `provider.complete` calls receive the abort signal via
  the existing `LLMProvider` contract.
- No partial document mutation persists — the document state lives
  inside the executor's async generator; on abort, the iterator's
  `return()` triggers a clean unwind.

The client surfaces cancellation via the `onCancelled` handler in
`AgentStreamHandlers`:

```ts
import { consumeAgentStream } from '@stageflip/editor-shell';

const controller = new AbortController();
const response = await fetch('/api/agent/execute?stream=true', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ prompt, document }),
  signal: controller.signal,
});
await consumeAgentStream(response, {
  onPatchApplied: (e) => store.applyPatch(e.patch),
  onPlanEnd: (e) => store.replace(e.finalDocument),
  onValidationComplete: (e) => store.recordValidation(e.validation),
  onCancelled: () => store.notifyCancelled(),
});
```

## Relationship to T-438 placeholder swaps

T-438 ships the optimistic-placeholder pattern: a `generate_asset`
tool call returns immediately with a placeholder `MediaElement`, and
the resolved asset arrives via a separate swap patch. Before T-442,
the swap was delivered on the NEXT agent run — the user had to
re-prompt for the placeholder to resolve.

With T-442, the swap is delivered in real time: when the
`placeholderResolver` seam dispatches the resolution, it emits a
`patch-applied` event onto the same stream. The editor sees the
swap arrive seconds (or minutes) after `plan-end`, before the stream
closes.

This is how the placeholder pattern was always intended to work; the
streaming transport was the missing piece.

## Out of scope

- **Resumability** via `Last-Event-ID` — would require a server-side
  replay buffer (and either Redis or a sticky-session contract).
  Defer to a later task.
- **Streaming the Planner** — Planner emits one Plan, not events; no
  need to stream it.
- **Wiring the consumer into the ai-copilot sidebar** — that lands in
  a follow-up UI task. T-442 ships the transport + consumer hook only.

## Code anchors

- Encoder + ReadableStream: `packages/agent/src/streaming.ts`
- Streaming orchestrator: `packages/app-agent/src/orchestrator.ts` →
  `streamAgent()`
- Route branch: `apps/stageflip-slide/src/app/api/agent/execute/route.ts`
- Client consumer: `packages/editor-shell/src/streaming-consumer.ts`
- Spec: `docs/tasks/T-442.md`
