---
'@stageflip/llm-abstraction': minor
---

T-150 — `@stageflip/llm-abstraction` fills out the agent-plane seam with
three providers (Anthropic Claude, Google Gemini, OpenAI) behind a single
provider-neutral interface. Ships `LLMProvider` / `LLMRequest` /
`LLMStreamEvent` / `LLMContentBlock` / `LLMResponse` types; `createProvider`
factory routing by provider name; `collectStream` helper that reassembles a
full `LLMResponse` from a stream iterator (so UI token rendering and final
response capture share one call); `LLMError` taxonomy (`aborted`,
`rate_limited`, `authentication`, `invalid_request`, `server_error`,
`network`, `unknown`) with `retry-after` header parsing; `AbortSignal`
propagation on every provider call. Anthropic is primary — its streaming
event shape (`message_start` / `content_block_start` / `content_block_delta`
with `text_delta` + `input_json_delta` / `content_block_stop` /
`message_delta` / `message_stop`) is the neutral model the Gemini and
OpenAI providers translate into. Tool-use and tool_result blocks are
first-class; provider-dialect translation (OpenAI `tool_calls` +
role-`tool` messages, Gemini `functionCall` + `functionResponse` parts)
lives behind the seam. Every provider accepts either `apiKey` (builds a
real SDK client) or `client` (pre-built, typically a mock) for
dependency-injection tests. New concept skill
`skills/stageflip/concepts/llm-abstraction/SKILL.md`; agent-planner /
agent-executor / agent-validator skills cross-ref. Unblocks T-151 / T-152 /
T-153 (Planner / Executor / Validator).
