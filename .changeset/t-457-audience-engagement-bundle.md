---
'@stageflip/engine': minor
'@stageflip/app-agent': minor
---

T-457 — Add the `audience-engagement` engine handler bundle (canonical bundle #26; the inventory grows 25 → 26). 11 read-only composer tools — one per `AudienceClipKind` discriminant from `@stageflip/audience-contract` (T-452): `compose_live_poll_multiple_choice` / `compose_live_poll_open_text` / `compose_live_poll_rating` / `compose_live_qa` / `compose_live_quiz` / `compose_leaderboard` / `compose_word_cloud` / `compose_survey` / `compose_heatmap` / `compose_reaction_stream` / `compose_audience_ai_prompt`. Each tool takes a per-kind semantic brief, emits `(presetId?, clipKind, props)`, and declares `ToolContext` (no document reads, no patch sink — composer paths neither read nor mutate the document, per the T-379 pattern).

Per ADR-010 §D2 (`LeaderboardVote = never`), `compose_leaderboard`'s input schema accepts only `{ dataSourceClipId, topN? }` — strict-mode Zod rejects any vote-bearing extras; the leaderboard clip is derived from a referenced `live-quiz` clip's aggregation. Per the spec, every handler emits `presetId: undefined` until Cluster I (T-486) ratifies the per-kind preset table; downstream `add_clip` accepts the triple and the runtime dispatches by `clipKind`. Each handler is a pure function of its input (no `Date.now()`, no `Math.random()`, no I/O).

Wires into the orchestrator (`@stageflip/app-agent`) as the 26th registered bundle alongside the existing 25; `pnpm gen:tool-skills` regenerates `skills/stageflip/tools/audience-engagement/SKILL.md` from the bundle's `LLMToolDefinition[]`; `pnpm skills-sync` updates the tool index. Not a structural extension — no document-model / binding-model / renderer-pipeline change; render verification N/A (no rendering surface touched). Inaugural `pnpm check-audience-permissions` gate passes (no audience clips yet — Cluster I + T-461..T-471 ship those).
