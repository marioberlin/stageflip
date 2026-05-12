---
title: Tools — Audience Engagement Bundle
id: skills/stageflip/tools/audience-engagement
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-457
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Audience Engagement Bundle

11 compose_audience_* tools for authoring Live Audience clips per ADR-009 / ADR-010 — one composer per AudienceClipKind discriminant (live-poll-multiple-choice / live-poll-open-text / live-poll-rating / live-qa / live-quiz / leaderboard / word-cloud / survey / heatmap / reaction-stream / audience-ai-prompt). Each tool emits a (presetId?, clipKind, props) triple; the caller mounts via add_clip from create-mutate. Cluster I (T-486) ratifies presets later — until then presetId is undefined and the runtime dispatches by clipKind (T-457).

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/audience-engagement/`.

Registration: see `@stageflip/engine`'s `registerAudienceEngagementBundle` (or equivalent) export.

## Tools

### `compose_live_poll_multiple_choice`

Compose a Live Audience multiple-choice-poll brief: `{ question (1..280 chars), options[2..10] }` → emit `(presetId?, clipKind: live-poll-multiple-choice, props)`. Voters cast a single discrete `optionIndex` (ADR-010 §D2); the runtime aggregates into per-option counts. Read-only: caller mounts the clip via a separate write-tier tool (add_clip from create-mutate). presetId is undefined until Cluster I (T-486) ratifies presets.

- `question` (`string`)
- `options` (`array`) — Per-option labels (1..120 chars each); 2..10 entries.

### `compose_live_poll_open_text`

Compose a Live Audience open-text-poll brief: `{ question (1..280 chars), maxLength? (1..2000) }` → emit `(presetId?, clipKind: live-poll-open-text, props)`. Voters submit free-text responses bounded by `maxLength` (default enforced at the runtime layer); the runtime renders a moderated stream (ADR-010 §D2). Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.

- `question` (`string`)
- `maxLength` (`integer`) _(optional)_

### `compose_live_poll_rating`

Compose a Live Audience rating-poll brief: `{ question (1..280 chars), scaleMin (int), scaleMax (int > scaleMin) }` → emit `(presetId?, clipKind: live-poll-rating, props)`. Voters cast an integer rating in `[scaleMin, scaleMax]` (ADR-010 §D2); the runtime aggregates into mean + histogram. Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.

- `question` (`string`)
- `scaleMin` (`integer`)
- `scaleMax` (`integer`)

### `compose_live_qa`

Compose a Live Audience Q&A brief: `{ topic (1..280 chars), allowUpvoting?, moderationMode?: 'none' | 'pre-approve' | 'post-flag' }` → emit `(presetId?, clipKind: live-qa, props)`. Voters submit questions + (optionally) upvote others; the runtime renders a sorted feed (ADR-010 §D2). Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.

- `topic` (`string`)
- `allowUpvoting` (`boolean`) _(optional)_
- `moderationMode` (`string`) _(optional)_ — enum: `none` / `pre-approve` / `post-flag`

### `compose_live_quiz`

Compose a Live Audience quiz brief: `{ question (1..280 chars), options[2..10], correctIndex (int, in [0, options.length)), timerSeconds? (1..600) }` → emit `(presetId?, clipKind: live-quiz, props)`. Voters cast a single `optionIndex` against the authored `correctIndex`; the runtime emits per-question scores + a derived leaderboard aggregation (referenced via compose_leaderboard) per ADR-010 §D2. Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.

- `question` (`string`)
- `options` (`array`) — Per-option labels (1..120 chars each); 2..10 entries.
- `correctIndex` (`integer`)
- `timerSeconds` (`integer`) _(optional)_

### `compose_leaderboard`

Compose a Live Audience leaderboard brief: `{ dataSourceClipId (1..120 chars), topN? (1..100) }` → emit `(presetId?, clipKind: leaderboard, props)`. Per ADR-010 §D2 the leaderboard is a DERIVED clip — `LeaderboardVote = never`, voters never cast votes against the leaderboard; aggregation is computed from the referenced `live-quiz` clip via `dataSourceClipId`. The input MUST NOT include vote payloads (strict-mode Zod rejects extras). Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.

- `dataSourceClipId` (`string`)
- `topN` (`integer`) _(optional)_

### `compose_word_cloud`

Compose a Live Audience word-cloud brief: `{ prompt (1..280 chars), maxWords? (1..500) }` → emit `(presetId?, clipKind: word-cloud, props)`. Voters submit short keyword(s); the runtime renders a live-aggregated cloud weighted by frequency (ADR-010 §D2). Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.

- `prompt` (`string`)
- `maxWords` (`integer`) _(optional)_

### `compose_survey`

Compose a Live Audience survey brief: `{ questions[1..20] }` where each question is `{ kind: 'multiple-choice' | 'open-text' | 'rating', prompt (1..280 chars), options[2..10]? (required for multiple-choice), scaleMin? + scaleMax? (required for rating, scaleMax > scaleMin), maxLength? (1..2000, open-text only) }` → emit `(presetId?, clipKind: survey, props)`. The runtime renders a sequenced form + aggregates per-question results (ADR-010 §D2). Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.

- `questions` (`array`)

### `compose_heatmap`

Compose a Live Audience heatmap brief: `{ prompt (1..280 chars), imageRef: { assetId? | url? } (one required) }` → emit `(presetId?, clipKind: heatmap, props)`. Motion-native differentiator (ADR-009 §D2); voters tap (x, y) on the image, the runtime renders a live-aggregated 2-D density field. `imageRef.assetId` references the asset-cache; `imageRef.url` is a raw HTTPS reference. Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.

- `prompt` (`string`)
- `imageRef` (`object`) — Image reference atom: `{ assetId? | url? }` — exactly one of `assetId` (asset-cache key) or `url` (HTTPS reference) is required.

### `compose_reaction_stream`

Compose a Live Audience reaction-stream brief: `{ prompt (1..280 chars), reactionSet? (1..20 entries, each 1..40 chars) }` → emit `(presetId?, clipKind: reaction-stream, props)`. Motion-native differentiator (ADR-009 §D2); voters tap a reaction entry, the runtime renders a particle-burst stream weighted by submission rate (5 Hz snapshot cadence default per ADR-010 §D3). Default `reactionSet` is supplied at the runtime layer when omitted. Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.

- `prompt` (`string`)
- `reactionSet` (`array`) _(optional)_

### `compose_audience_ai_prompt`

Compose a Live Audience AI-prompt brief: `{ basePrompt (1..2000 chars), voterPromptTemplate (1..2000 chars) }` → emit `(presetId?, clipKind: audience-ai-prompt, props)`. Motion-native differentiator (ADR-009 §D2); the renderer combines `basePrompt` with voter-supplied tokens (per `voterPromptTemplate`) into a single AI generation call; results stream into the rendered clip. Read-only: caller mounts the clip via a separate write-tier tool. presetId is undefined until Cluster I (T-486) ratifies presets.

- `basePrompt` (`string`)
- `voterPromptTemplate` (`string`)


## Invariants

- Every handler declares `bundle: 'audience-engagement'`.
- Tool count 11 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-457
