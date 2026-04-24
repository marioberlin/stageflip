---
title: Tools — Fact Check Bundle
id: skills/stageflip/tools/fact-check
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-165
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Fact Check Bundle

Fact-verification tools using web search + citation.

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/fact-check/`.

Registration: see `@stageflip/engine`'s `registerFactCheckBundle` (or equivalent) export.

## Tools

### `list_factual_claims`

Heuristic extractor: scan every text element and slide notes for sentences containing numeric claims (percentages, dollar amounts, counts), year references, or 'according to' phrasing. Returns candidates ranked by source location; the LLM picks which to verify externally via a web-search tool (provided by the orchestrator layer, not this bundle). This tool does NOT make HTTP calls.

### `record_fact_check_result`

Append a structured fact-check annotation to a slide's speaker notes. The block format is a machine-parseable `[fact-check:<status>]\n<claim>\n<source?>\n[/fact-check]` so downstream consumers (audit pipelines, export renderers) can extract findings. Status is `verified` / `unverified` / `disputed`. `source` must be a valid URL when provided. Refuses `exceeds_max_length` when the appended block would push notes over the 5000-char schema limit.

- `slideId` (`string`)
- `status` (`string`) — enum: `verified` / `unverified` / `disputed`
- `claim` (`string`)
- `source` (`string`) _(optional)_


## Invariants

- Every handler declares `bundle: 'fact-check'`.
- Tool count 2 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-165
