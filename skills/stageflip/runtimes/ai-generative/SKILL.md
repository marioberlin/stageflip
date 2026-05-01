---
title: AI Generative Runtime
id: skills/stageflip/runtimes/ai-generative
tier: runtime
status: placeholder
last_updated: 2026-05-01
owner_task: T-395
related:
  - skills/stageflip/runtimes/contract/SKILL.md
  - skills/stageflip/runtimes/ai-chat/SKILL.md
  - skills/stageflip/runtimes/live-data/SKILL.md
  - skills/stageflip/runtimes/web-embed/SKILL.md
  - skills/stageflip/concepts/runtimes/SKILL.md
  - skills/stageflip/concepts/clip-elements/SKILL.md
  - skills/stageflip/concepts/auth/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
---

# AI Generative Runtime

**Status**: placeholder. This file exists so the
`orchestrator/T-395-T-396-specs` spec PR has a target for
`check-skill-drift` and so future readers can locate the planned
runtime. Substantive content lands in **T-395** (liveMount) and
**T-396** (staticFallback). See `docs/tasks/T-395.md` and
`docs/tasks/T-396.md`.

## Planned shape (preview)

`@stageflip/runtimes-interactive/clips/ai-generative` will ship the
fifth (and final) **γ-live** family. Standalone interactive-tier clip
— no §3 runtime to reuse, no frame-source dependency, no convergence
test. At mount time the factory feeds `liveMount.props.prompt` to a
host-injected `AiGenerativeProvider`, awaits the generated artifact
(a `Blob` + `contentType`), and renders it into an `<img>` element
under the supplied root.

- `liveMount` (T-395) — playback-time generation via host-injected
  provider; one-shot at mount + manual `regenerate()` only (no
  streaming in v1).
- `staticFallback` (T-396) — curated example output rendered as
  an `ImageElement`. Same posture as T-394's `posterImage`.

**v1 is image-only.** The schema does NOT carry a `modality` field
in v1 — a single-value enum has no purpose. Audio / video / 3D
modalities are deferred to a future task; when a second modality
lands, the field is added with `z.enum(['image', 'audio', ...]).default('image')`
as a non-breaking change. ADR-006 (Phase 14) covers authoring-time
asset generation (frozen files); T-395/T-396 are the playback-time
counterpart.

## Hard rules

The clip directory must contain **no** direct `fetch` /
`XMLHttpRequest` / `navigator.sendBeacon`. Production generation
goes through the host-injected `AiGenerativeProvider`. Same posture
AiChat (T-389) and LiveData (T-391) use. Pinned by T-395 AC #26
(grep-driven structural assertion) plus the existing
`check-determinism` gate.

Prompt body, `negativePrompt` body, and generated blob bytes MUST
NOT appear in telemetry attributes. `promptLength` and
`blobByteLength` integers only. Same posture as T-389 / T-391 /
T-393.

**Blob-URL revocation**: `URL.createObjectURL` creates a hidden GC
root not handled by ordinary DOM teardown. `dispose()` MUST call
`URL.revokeObjectURL` for every blob URL the factory created — a
leaked blob URL holds the blob in browser memory indefinitely
(measurable cost: one slide × one clip × one regenerate ≈ 200KB
held forever). Pinned by T-395 D-T395-7 / AC #15.

## When to reach for it (planned)

- A presentation that wants a fresh visual at mount time —
  generated cover art for a slide deck, illustration for a topic,
  per-prompt example for a demo.
- An interactive teaching surface that demonstrates generative-AI
  output for a chosen prompt.
- Any presentation where the artifact MUST regenerate on demand
  (host-driven `regenerate()`).

## When NOT (planned)

- Frozen / pre-baked assets. Use Phase 14 (ADR-006) authoring-time
  generation — the result lands in storage and is consumed by
  ordinary `MediaElement` schema slots. Generative-at-mount-time
  costs tokens / API quota every time the slide is shown.
- Streaming partial results (DALL-E preview-frame). T-395 is
  request/response only; streaming is a future task with its own
  seam (closer to T-389's `LLMChatProvider.streamTurn`).
- Authenticated providers whose credentials must be in the schema.
  Auth is the host's responsibility — the host's `Generator`
  adapter injects credentials at request time (ADR-005 §D7).

## Cross-references

- T-389 / T-390 — sister AiChatClip pair. Closest in shape (same
  prompt-bearing schema; same host-injected provider seam; same
  prompt-body privacy posture).
- T-391 / T-392 — sister LiveDataClip pair. Closest in transport
  shape (request/response with `signal`); AiGenerative differs by
  having binary `Blob` output instead of text.
- T-393 / T-394 — sister WebEmbedClip pair. Closest in DOM
  surface (no React tree; single mounted element under `ctx.root`).
- T-388a — static-fallback generator registry T-396 will register
  against.
- ADR-005 §D7 — credential scoping; the provider's auth is the
  host's responsibility, not the clip's.
- ADR-006 (Phase 14) — authoring-time asset generation; the
  frontier-vs-asset-gen split per `docs/implementation-plan.md`
  line 873.
