---
title: LLM Abstraction
id: skills/stageflip/concepts/llm-abstraction
tier: concept
status: substantive
last_updated: 2026-04-24
owner_task: T-150
related:
  - skills/stageflip/concepts/agent-planner/SKILL.md
  - skills/stageflip/concepts/agent-executor/SKILL.md
  - skills/stageflip/concepts/agent-validator/SKILL.md
  - skills/stageflip/concepts/rate-limits/SKILL.md
---

# LLM Abstraction

`@stageflip/llm-abstraction` is the single seam between the agent plane
(Planner, Executor, Validator) and concrete LLM SDKs. Agents import this
package only; no direct `@anthropic-ai/sdk` / `@google/generative-ai` /
`openai` imports survive outside it.

## Why a provider-neutral interface

- **Swappability**: a runtime env var selects `anthropic | google | openai`
  without touching agent code.
- **One event model**: Planner/Executor/Validator reason over a single
  streaming-event shape (Anthropic-style, since Claude is primary). Gemini
  and OpenAI translate into it.
- **Tool-use parity**: `tool_use` + `tool_result` blocks are first-class in
  the neutral interface. Each provider handles its own dialect — OpenAI's
  `tool_calls` + role-`tool` messages, Gemini's `functionCall` +
  `functionResponse` parts — behind the seam.

## The neutral interface

```ts
interface LLMProvider {
  readonly name: 'anthropic' | 'google' | 'openai';
  complete(request: LLMRequest, options?: { signal?: AbortSignal }): Promise<LLMResponse>;
  stream(request: LLMRequest, options?: { signal?: AbortSignal }): AsyncIterable<LLMStreamEvent>;
}
```

`LLMRequest` shape:

```ts
{
  model: string;             // provider-specific model id
  messages: LLMMessage[];    // user/assistant/tool, string or content[]
  system?: string;           // single system prompt
  tools?: LLMToolDefinition[]; // {name, description, input_schema (JSONSchema)}
  max_tokens: number;
  temperature?: number;
  stop_sequences?: string[];
}
```

`LLMStreamEvent` — Anthropic-style discriminated union:

```
message_start            { id, model }
content_block_start      { index, block: text | tool_use{id,name} }
content_block_delta      { index, delta: text_delta | input_json_delta }
content_block_stop       { index }
message_delta            { delta: { stop_reason? }, usage? }
message_stop
```

`collectStream(asyncIterable)` reassembles a full `LLMResponse` (content
blocks + stop_reason + usage). Consumers can iterate events for UI token
streaming and still grab the finalised response — no second provider call.

## Content blocks

```ts
type LLMContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };
```

An assistant message is always returned as `LLMContentBlock[]`, even for
plain text. Consumers switch on `type` rather than sniffing shape.

## Error taxonomy

Every provider wraps SDK errors into `LLMError`:

```ts
kind: 'aborted' | 'rate_limited' | 'authentication' | 'invalid_request'
    | 'server_error' | 'network' | 'unknown'
```

429 responses populate `retryAfterMs` from the `retry-after` header. The
Executor (T-152) branches on `kind` — `rate_limited` triggers the cooperative
slow-down described in `concepts/rate-limits/SKILL.md`; `aborted` is
surfaced to the caller without retry.

## Provider selection

```ts
import { createProvider } from '@stageflip/llm-abstraction';

const provider = createProvider({
  provider: process.env.LLM_PROVIDER as 'anthropic' | 'google' | 'openai',
  apiKey: process.env.LLM_API_KEY,
});
```

Defaults: `claude-opus-4-7` (Anthropic), `gemini-2.5-pro` (Google),
`gpt-4o` (OpenAI). The caller picks the model string — this package does
not maintain a model registry.

## Dependency injection for tests

Every provider factory accepts either `apiKey` (builds a real SDK client)
or `client` (pre-built, typically a mock). Planner/Executor/Validator tests
pass a deterministic fake via `client` rather than hitting the network. The
`*Like` interfaces (`AnthropicLike`, `GeminiClientLike`, `OpenAILike`) are
exported for that purpose.

## Out of scope

- Retry / exponential-backoff policy — lives in the Executor
  (T-152), not here. This package surfaces `retryAfterMs` + kind only.
- Rate-limit counting — handled at the HTTP middleware tier per
  `concepts/rate-limits/SKILL.md`.
- Prompt templating — agents manage their own prompts.
- Response caching — deferred; Anthropic prompt-cache headers can pass
  through via the provider-native model config when needed.

## Current state (Phase 7 opener, T-150)

- Shipped: three providers (Anthropic, Google, OpenAI), streaming +
  tool-use across all three, `AbortSignal` support, classified
  `LLMError`, `collectStream` helper, `createProvider(spec)` factory.
- Consumers: `@stageflip/agent` (T-151/T-152/T-153) and
  `apps/stageflip-slide/src/components/ai-copilot/` will wire through
  this interface starting T-151.

## Related

- Planner: `concepts/agent-planner/SKILL.md`
- Executor: `concepts/agent-executor/SKILL.md`
- Validator: `concepts/agent-validator/SKILL.md`
- Rate limits: `concepts/rate-limits/SKILL.md`
- Task: T-150
