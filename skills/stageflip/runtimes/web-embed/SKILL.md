---
title: Web Embed Runtime
id: skills/stageflip/runtimes/web-embed
tier: runtime
status: placeholder
last_updated: 2026-04-30
owner_task: T-393
related:
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/runtimes/live-data/SKILL.md
  - skills/stageflip/runtimes/ai-chat/SKILL.md
  - skills/stageflip/concepts/runtimes/SKILL.md
  - skills/stageflip/concepts/clip-elements/SKILL.md
  - skills/stageflip/concepts/auth/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
---

# Web Embed Runtime

**Status**: placeholder. This file exists so the
`orchestrator/T-393-T-394-specs` spec PR has a target for
`check-skill-drift` and so future readers can locate the planned
runtime. Substantive content lands in **T-393** (liveMount) and
**T-394** (staticFallback). See `docs/tasks/T-393.md` and
`docs/tasks/T-394.md`.

## Planned shape (preview)

`@stageflip/runtimes-interactive/clips/web-embed` will ship the fourth
**γ-live** family. Standalone interactive-tier clip — no §3 runtime to
reuse, no frame-source dependency, no convergence test, **no provider
seam** (the browser's `<iframe>` element is the runtime). Mounts a
sandboxed `<iframe>` whose `src` is a clip-supplied URL; exposes
`reload()`, `postMessage()`, and origin-filtered `onMessage()` via a
typed `MountHandle`; emits typed lifecycle telemetry.

- `liveMount` (T-393) — sandboxed iframe with allowlisted-origin postMessage filtering.
- `staticFallback` (T-394) — poster-frame screenshot rendered as an `ImageElement`.

## Hard rules

The clip directory must contain **no** direct `fetch` /
`XMLHttpRequest` / `navigator.sendBeacon`. The iframe makes its own
network requests via the browser's standard navigation pipeline (which
runs in a separate document and is OUT of scope for the clip's
determinism). Pinned by T-393 AC #24 (grep-driven structural
assertion) plus the existing `check-determinism` gate.

postMessage payload bodies MUST NOT appear in telemetry attributes.
`byteLength` integer only. Same posture as AiChat (T-389) / LiveData
(T-391).

## When to reach for it (planned)

- Embed a third-party widget — Twitter timeline, GitHub gist, Slack
  thread, payment widget — without rebuilding it natively.
- Display a live web tool (CodePen demo, Observable notebook, online
  prototype) inside a presentation.
- Show a tenant's own web property (dashboard, KPI tile, intranet page)
  with auth handled by the embedded page itself.

## When NOT (planned)

- A clip whose content is structured data you can render natively. Use
  `LiveDataClip` (T-391) — embedding a JSON endpoint via iframe is
  wasteful and bypasses your data layer.
- Authenticated iframes whose credentials must be cross-origin
  postMessage-delivered. Auth is the embedded page's responsibility;
  T-393 does not surface a credential-injection seam (ADR-005 §D7).
- Replacing the entire app shell with an iframe. The clip is sized to
  the clip transform; full-page embeds are an authoring concern.

## Cross-references

- T-389 / T-390 — sister AiChatClip pair (network permission,
  telemetry privacy posture).
- T-391 / T-392 — sister LiveDataClip pair (closest in shape; same
  second-γ pattern).
- T-388a — static-fallback generator registry T-394 will register
  against.
- ADR-005 §D7 — credential scoping; the iframe's auth is the embedded
  page's responsibility, not the host's.
