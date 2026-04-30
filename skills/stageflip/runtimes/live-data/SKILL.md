---
title: Live Data Runtime
id: skills/stageflip/runtimes/live-data
tier: runtime
status: placeholder
last_updated: 2026-04-30
owner_task: T-391
related:
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/runtimes/ai-chat/SKILL.md
  - skills/stageflip/runtimes/voice/SKILL.md
  - skills/stageflip/concepts/runtimes/SKILL.md
  - skills/stageflip/concepts/clip-elements/SKILL.md
  - skills/stageflip/concepts/auth/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
---

# Live Data Runtime

**Status**: placeholder. This file exists so the `task/T-391-T-392-specs`
spec PR has a target for `check-skill-drift` and so future readers can
locate the planned runtime. Substantive content lands in **T-391**
(liveMount) and **T-392** (staticFallback). See `docs/tasks/T-391.md`
and `docs/tasks/T-392.md`.

## Planned shape (preview)

`@stageflip/runtimes-interactive/clips/live-data` will ship the third
**γ-live** family. Standalone interactive-tier clip — no §3 runtime to
reuse, no frame-source dependency, no convergence test. Fetches a single
response from a configured endpoint at mount time via a host-injected
`Fetcher`; surfaces parsed data through a typed `MountHandle`; emits
typed lifecycle telemetry. Chart rendering is deferred to T-406.

- `liveMount` (T-391) — endpoint fetch via host-injected `Fetcher`; one-shot at mount + manual `refresh()` only (no polling in v1).
- `staticFallback` (T-392) — cached snapshot rendered as text (chart-aware rendering follow-up gated on T-406).

## Hard rules

The clip directory must contain **no** direct `fetch` /
`XMLHttpRequest` / `navigator.sendBeacon`. Production fetch goes
through the host-injected `Fetcher`. Same posture AiChat uses for
`LLMProvider`. Pinned by T-391 AC #26 (grep-driven structural assertion)
plus the existing `check-determinism` gate.

## When to reach for it (planned)

- A slide that displays a snapshot of an external dataset — current weather, a build status, a stock ticker, a sales-dashboard KPI.
- An interactive teaching surface that demonstrates an API response shape.
- Any presentation where a value should be re-fetched on demand (host-driven `refresh()`).

## When NOT (planned)

- A continuously-updating live feed. T-391 is **one-shot at mount + manual refresh**. Polling / WebSocket / SSE are future tasks gated on a determinism-skill ruling.
- A clip that needs to make authenticated requests with credentials baked into the schema. Auth is the host's responsibility — credentials are NEVER in clip props (ADR-005 §D7). The host wraps a `Fetcher` that adds auth headers at request time.
- A chart-rendering surface in v1. Use the chart family (T-406) directly when it lands.

## Cross-references

- T-389 / T-390 — sister AiChatClip pair. Same second-γ pattern, same host-injected-client posture.
- T-388a — static-fallback generator registry T-392 will register against.
- T-406 — chart family (γ-supporting); follow-up task wires chart rendering once on `main`.
