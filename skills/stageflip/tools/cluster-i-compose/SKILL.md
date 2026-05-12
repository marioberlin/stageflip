---
title: Tools — Cluster I Compose Bundle
id: skills/stageflip/tools/cluster-i-compose
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-487
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Cluster I Compose Bundle

3 read-only composer tools that bind a semantic Cluster I (Live audience) brief to a ratified preset id + audience clipKind + opaque props payload. compose_live_poll → slido-classic-poll | mentimeter-bar-vote; compose_audience_qa → bbc-question-time | conference-qa-upvote; compose_quiz_round → kahoot-competitive | classroom-quiz. Cluster I = 6 audience presets ratified in T-486 (T-487).

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/cluster-i-compose/`.

Registration: see `@stageflip/engine`'s `registerClusterIComposeBundle` (or equivalent) export.

## Tools

### `compose_live_poll`

Bind a live-poll semantic brief to a Cluster I audience preset. variant="multiple-choice" picks slido-classic-poll; variant="rating" picks mentimeter-bar-vote (Likert 1..scaleMax). Returns (presetId, clipKind, props) for the caller to mount via add_clip. Read-only.

- `question` (`string`)
- `variant` (`string`) _(optional)_ — enum: `multiple-choice` / `rating`
- `options` (`array`) _(optional)_
- `scaleMax` (`integer`) _(optional)_

### `compose_audience_qa`

Bind an audience Q&A semantic brief to a Cluster I audience preset. venue="broadcast" picks bbc-question-time; venue="conference" (default) picks conference-qa-upvote. Returns (presetId, clipKind, props). Read-only.

- `topic` (`string`)
- `venue` (`string`) _(optional)_ — enum: `broadcast` / `conference`
- `allowUpvoting` (`boolean`) _(optional)_

### `compose_quiz_round`

Bind a multi-question quiz brief to a Cluster I audience preset. audience="competitive" (default) picks kahoot-competitive; audience="classroom" picks classroom-quiz. Returns (presetId, clipKind, props). Read-only.

- `questions` (`array`)
- `audience` (`string`) _(optional)_ — enum: `competitive` / `classroom`


## Invariants

- Every handler declares `bundle: 'cluster-i-compose'`.
- Tool count 3 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-487
