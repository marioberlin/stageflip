---
title: Tool Router
id: skills/stageflip/concepts/tool-router
tier: concept
status: substantive
last_updated: 2026-04-24
owner_task: T-154
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/agent-executor/SKILL.md
  - skills/stageflip/concepts/llm-abstraction/SKILL.md
---

# Tool Router

`@stageflip/engine`'s `ToolRouter` dispatches every tool call by name with
Zod-validated input + output. It's the runtime half of the agent plane —
the LLM-facing JSONSchema half lives on the matching `LLMToolDefinition`
in `@stageflip/llm-abstraction`.

## Why bi-directional validation

- **Input**: the model hallucinates. A tool asked for `x: number` may receive
  `x: "1"`. Validation fails loudly rather than corrupting state.
- **Output**: a buggy handler can return malformed data. If the Executor
  then feeds that back to the model, we poison the loop silently. Validating
  output closes the channel.

## `ToolHandler` contract

```ts
interface ToolHandler<TInput, TOutput, TContext extends ToolContext = ToolContext> {
  readonly name: string;           // matches LLMToolDefinition.name
  readonly bundle: string;         // the one bundle this tool belongs to
  readonly description: string;
  readonly inputSchema: ZodType<TInput>;
  readonly outputSchema: ZodType<TOutput>;
  handle(input: TInput, context: TContext): Promise<TOutput> | TOutput;
}
```

`ToolContext` defaults to `{ readonly signal?: AbortSignal }`. The Executor
(T-152) narrows `TContext` via intersection (e.g. `ExecutorContext` adds
`document`, `patchSink`, `audit`). Handlers that only need `signal` ignore
the extra fields.

## `ToolRouter`

```ts
const router = new ToolRouter<ExecutorContext>({ observer });
router.register(handler);
await router.call(name, input, context); // → validated output
```

- `register(handler)` — throws on duplicate name. Each handler declares its
  one owning bundle (tool-bundles invariant).
- `has` / `get` / `size` / `names` — registry inspection.
- `call(name, input, context)` — the dispatch. Order:
  1. `unknown_tool` → throw if no handler registered.
  2. `aborted` → throw if `context.signal.aborted` before start.
  3. `input_invalid` → Zod-parse input; throw with `issues` on failure.
  4. Handler runs. Thrown `AbortError` → `aborted`; anything else →
     `handler_error`.
  5. `output_invalid` → Zod-parse output; throw with `issues` on failure.
  6. Return validated output.

## Error taxonomy

Every failure surfaces as `ToolRouterError` with `kind`:

| kind              | When                                                      | Executor response (T-152)                  |
|-------------------|-----------------------------------------------------------|--------------------------------------------|
| `unknown_tool`    | No handler registered                                     | Fail the step; plan referenced a ghost     |
| `input_invalid`   | Zod rejected the LLM's args                               | Re-prompt the model with the issues list   |
| `handler_error`   | Handler threw a non-abort error                           | Surface to user; abort the step            |
| `output_invalid`  | Handler returned data Zod rejected                        | Log + abort; this is a bug in the handler  |
| `aborted`         | `context.signal` fired or handler threw `AbortError`      | Propagate cancellation                     |

`issues` (`ZodIssue[]`) is populated for `input_invalid` + `output_invalid`
so the Executor can format them into a user-facing re-prompt.

## Observer hook

`ToolRouterOptions.observer` receives `call-start` / `call-success` /
`call-error` events. Used by the Executor for the audit trail + UI
streaming events. Observer exceptions are swallowed — the audit trail is
diagnostic, not contract.

`call-start` is emitted as soon as the handler is resolved (i.e. after
the `unknown_tool` check passes) and *before* the pre-start abort check
or input validation. Observers therefore see `call-start → call-error`
for pre-start-abort and `input_invalid` cases. State machines keyed on
`start → (success | error)` work; state machines assuming start implies
"handler ran" do not.

## Relationship with the bundle registry

The router and the `BundleRegistry` (tool-bundles) are independent:

- `BundleRegistry` holds `LLMToolDefinition[]` — the LLM sees these.
- `ToolRouter` holds `ToolHandler` runtime halves — the Executor calls these.

Handler packages (T-155–T-168) register in both at once: `registry.mergeTools`
for the LLM-facing JSONSchema, `router.register` for the Zod-validated
runtime. Name collision between the two is the contract: same `name`, same
input shape. A follow-up could derive one from the other to remove the
drift surface; out of scope for T-154.

## Current state (Phase 7, T-154 shipped)

- `@stageflip/engine` exports `ToolRouter`, `ToolHandler`, `ToolContext`,
  `ToolRouterError`, `ToolCallEvent`, `ToolRouterOptions`.
- 15 unit tests covering every error kind + observer + context propagation.
- Zero handlers registered yet; T-155–T-168 are the downstream populators.
- Executor (T-152) is the primary consumer; it constructs a router per
  agent run and calls `router.call(...)` inside its tool-call loop.

## Related

- Tool bundles: `concepts/tool-bundles/SKILL.md`
- Executor: `concepts/agent-executor/SKILL.md`
- LLM abstraction: `concepts/llm-abstraction/SKILL.md`
- Task: T-154
