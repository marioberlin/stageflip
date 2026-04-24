# @stageflip/llm-abstraction

## 0.1.0

### Minor Changes

- b8808c7: T-150 — `@stageflip/llm-abstraction` fills out the agent-plane seam with
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
- 36d0c5d: T-227: make the Phase-10 publish targets shippable via Changesets.

  - Renames the CLI's workspace name from `@stageflip/app-cli` →
    `@stageflip/cli` (the plan's publishable name).
  - Drops `"private": true` from the 11 packages in the publishable
    closure: the three primary targets (`@stageflip/{cli,plugin,mcp-server}`)
    plus their transitive deps (`@stageflip/{engine,llm-abstraction,schema,
skills-core,skills-sync,validation,rir,runtimes-contract}`).
  - Adds `"publishConfig": { "access": "public" }`, `"license":
"BUSL-1.1"`, `"repository"`, and `"homepage"` metadata to each
    publishable package. Primary targets also get a `"description"`
    visible on npmjs.com.
  - Copies the root `LICENSE` into each publishable package dir so
    tarballs carry the license even outside the monorepo.
  - Flips `.changeset/config.json`'s `access` from `"restricted"` to
    `"public"`.
  - Adds `.github/workflows/release.yml` — Changesets-driven: opens a
    "Version Packages" PR when changesets land on main; `pnpm publish`
    fires on merge of that PR iff `NPM_TOKEN` is configured.

  Actual publishing is opt-in via the NPM_TOKEN secret; this PR does
  NOT run `changeset publish`.
