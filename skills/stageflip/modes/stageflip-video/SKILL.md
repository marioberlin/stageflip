---
title: StageFlip.Video Mode
id: skills/stageflip/modes/stageflip-video
tier: mode
status: substantive
last_updated: 2026-04-24
owner_task: T-189
related:
  - skills/stageflip/profiles/video/SKILL.md
  - skills/stageflip/concepts/captions/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
  - skills/stageflip/runtimes/frame-runtime/SKILL.md
  - skills/stageflip/runtimes/frame-runtime-bridge/SKILL.md
  - skills/stageflip/tools/video-mode/SKILL.md
  - skills/stageflip/workflows/parity-testing/SKILL.md
---

# StageFlip.Video Mode

StageFlip's horizontal-timeline video editor. A Next.js 15 app that mounts
`@stageflip/editor-shell` on a `VideoContent` document, renders composition
previews against the shared frame runtime + registered clip runtimes, and
speaks the same canonical `Document` shape used by Slide and Display modes.

The mode exists so short-form video content (social ads, product videos,
explainer clips) has a first-class workflow that composes on tracks +
bounces across aspect ratios, without forking the engine. Canvas, timeline
panel, track-list, aspect-bouncer, and AI copilot panels are video-specific;
schema, RIR, frame runtime, clip runtimes, renderer-core, parity harness,
captions pipeline, and the Planner/Executor/Validator agent triad are all
shared with Slide and Display.

## Package map

| Package / app | Purpose |
|---|---|
| `apps/stageflip-video` | The Next.js 15 editor (port 3200). Walking-skeleton entrypoint at `src/app/page.tsx`; the seeded track-list view lives under `src/app/editor-app-client.tsx`. The agent route is `src/app/api/agent/execute/`, wired to the shared `@stageflip/app-agent` orchestrator. |
| `@stageflip/profiles-video` | Profile descriptor: `VIDEO_ALLOWED_ELEMENT_TYPES`, `VIDEO_CLIP_KINDS`, `VIDEO_TOOL_BUNDLES`, four RIR-level lint rules, and the `videoProfile` aggregate. See `profiles/video/SKILL.md`. |
| `@stageflip/editor-shell` | Mode-agnostic primitives — atoms, shortcut + context-menu frameworks, i18n, persistence, plus the T-181 multi-track timeline math + headless React components (`<TimelineRuler>`, `<TimelineStack>`, `<TrackRow>`, `<ElementBlock>`, `<Playhead>`, `<TimelinePanel>`, `useScrubber`, `useTimelineScale`) and the T-182 aspect-ratio bouncer primitives (`<AspectRatioGrid>`, `<AspectRatioPreview>`, `layoutAspectPreviews`, `fitAspect`). |
| `@stageflip/schema` | Canonical `Document` shape. Video mode operates on `document.content.mode === 'video'`; `content.tracks[]` carries per-track element lists. |
| `@stageflip/captions` | T-184 caption pipeline: `TranscriptionProvider` contract, mock + real OpenAI Whisper providers, deterministic word→segment packer, SHA-256 content-hash cache. `transcribeAndPack` is the entry point. |
| `@stageflip/export-video` | T-186 multi-aspect export orchestrator (`exportMultiAspectInParallel`) that consumes the agent's `bounce_to_aspect_ratios` output and runs per-variant renders in parallel behind the injectable `VariantRenderer` contract. |
| `@stageflip/app-agent` | Shared Planner/Executor/Validator wiring + `runAgent` entry point (T-187b). Slide and video apps load the same 15-bundle registry through it. |
| `@stageflip/engine` | Agent tool bundles. Video-specific bundle `video-mode` (15th canonical) ships `bounce_to_aspect_ratios` (T-185); the other 11 eligible bundles follow `VIDEO_TOOL_BUNDLES` in the video profile. |
| `@stageflip/runtimes-frame-runtime-bridge` | Houses the six T-183 video-profile clips: `hook-moment`, `product-reveal`, `endslate-logo`, `lower-third`, `beat-synced-text`, `testimonial-card`. |

## Document contract

Video documents carry `content: { mode: 'video', aspectRatio, durationMs, frameRate, tracks: Track[], bgm?, captions? }`. The core fields:

```ts
interface VideoContent {
  mode: 'video';
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | '21:9' | { kind: 'custom'; w; h };
  durationMs: number;           // positive int
  frameRate: number;            // default 30
  tracks: Track[];              // at least 1
  bgm?: AssetRef;               // optional background music
  captions?: CaptionTrack;      // optional pre-segmented Whisper output
}

interface Track {
  id: string;
  kind: 'visual' | 'overlay' | 'caption' | 'audio';
  name?: string;
  muted: boolean;
  elements: Element[];          // the shared 11-variant Element union
}
```

`Element` is the same discriminated union slide mode uses, but the
`videoElementTypesAllowed` rule rejects the slide-oriented trio —
`chart`, `table`, `code` — in video mode. See
`profiles/video/SKILL.md` for the full allowlist.

## UI layout

Today's app ships the walking skeleton (T-187a) + wired agent route
(T-187c). Layout, left-to-right:

```
 ┌────────────────────────────────────────────────────────────────────┐
 │ Header: title • mode: video • (aspect, duration, fps readout)      │
 ├────────────────────────────────────────────────────────────────────┤
 │                    Track list (seeded rows)                         │
 │ visual / overlay / caption / audio • element counts                 │
 └────────────────────────────────────────────────────────────────────┘
```

Follow-up tasks (not yet landed) will plug the real primitives into this
shell:

- `<TimelinePanel>` wrapping `<TimelineRuler>` + `<TimelineStack>` + a
  `<Playhead>` driven by `useScrubber`. Track rows stack in canonical
  order `visual → overlay → caption → audio` (see
  `@stageflip/editor-shell`'s `TRACK_KIND_ORDER`).
- `<AspectRatioGrid>` preview strip that bounces `9:16 / 1:1 / 16:9`
  side-by-side using `layoutAspectPreviews`.
- AI copilot panel reusing `execute-agent.ts` against the shared
  `/api/agent/execute` route.

The agent route is live: the copilot can already POST `{ prompt, document }`
and get back `{ plan, events, finalDocument, validation }` once
`ANTHROPIC_API_KEY` is set. Without it the route returns 503
`not_configured`, matching slide-app's contract.

## Video-profile clips (T-183)

Six clips registered on `@stageflip/runtimes-frame-runtime-bridge` and
named in `VIDEO_CLIP_KINDS`:

| Kind | Purpose |
|---|---|
| `hook-moment` | Opening attention-grabber — claim zoom-in + brightness pulse, supporting tagline slides up. |
| `product-reveal` | Product-hero card — image slides up + zoom, name + optional price strip in from the right. |
| `endslate-logo` | Closing brand card — centred wordmark + optional tagline with fade-scale entrance and fade exit. |
| `lower-third` | Speaker chyron — slides in from left, holds, slides out right; accent bar + name + optional subtitle. |
| `beat-synced-text` | Text pulse on each beat frame — scale bump + glow peak then decay; takes `beatFrames[]` as props. |
| `testimonial-card` | Quote card — translate-up entrance + fade, quote body + attribution name + optional role. |

Every clip is deterministic — every numeric is derived from
`useCurrentFrame` + `useVideoConfig` via `interpolate`. Theme-slotted on
palette roles so a theme swap re-flows colours. Parity manifests live in
`packages/testing/fixtures/frame-runtime-<kind>.json` (T-188).

## Captions pipeline (T-184)

Authoring-time — captions are a sidecar pass, not a render-time hook.

1. Host extracts audio to bytes (e.g. 16 kHz mono PCM).
2. `transcribeAndPack({ source, language?, pack, provider, cache? })`:
   - Derives a SHA-256 cache key from bytes + language hint.
   - On miss, calls the injected `TranscriptionProvider` (`createMockProvider`
     in tests, `createOpenAIProvider({ apiKey })` in production).
   - Caches the raw `Transcript` by content hash.
   - Re-packs words into `CaptionSegment[]` via `packWords` with the
     caller's `{ maxCharsPerLine, maxLines, minSegmentMs? }` budget.
3. Document merges the resulting segments into `content.captions`.
4. Render path picks up via the shared `subtitle-overlay` clip (no
   separate video-specific renderer — it's already bridge-style).

The cache is content-addressed, so re-rendering the same video never
re-hits OpenAI. Per-aspect bouncing (T-185) re-packs with a tighter
`maxCharsPerLine` for 9:16 — the transcript stays identical, only
cell boundaries differ.

## Multi-aspect export (T-185 + T-186)

Two-phase:

1. **Plan** — the agent calls `bounce_to_aspect_ratios({ targets, basisPx? })`
   (bundle `video-mode`) and gets
   `{ ok: true, variants: [{ aspectRatio, label, width, height }] }`. Canvas
   dimensions are always even (H.264/H.265 requirement); `basisPx` (default
   1080) is the short-axis pixel basis.
2. **Render** — `exportMultiAspectInParallel({ document, variants, renderer, concurrency? })`
   runs each variant through an injectable `VariantRenderer`, with a
   configurable concurrency cap (default 3), an abort signal, and
   **collect-all error handling** so one failing variant doesn't cancel
   the others. Outputs are `{ ok: true, output } | { ok: false, variant, error }`
   per input in input-preserving order.

Real renderer bindings (CDP host bundle, bake tier) plug in behind
`VariantRenderer`; `@stageflip/export-video` owns the orchestration
only.

## Agent tools

Video mode loads a subset of the 15 canonical bundles — see
`VIDEO_TOOL_BUNDLES` in `@stageflip/profiles-video` (11 bundles today):
`read`, `create-mutate`, `timing`, `layout`, `validate`, `clip-animation`,
`element-cm1`, `qc-export-bulk`, `semantic-layout`,
`data-source-bindings`, `fact-check`, `video-mode`. Excluded:
`slide-cm1`, `table-cm1`, `domain-finance-sales-okr` (slide-oriented).

The `video-mode` bundle is itself mode-specific — today it ships only
`bounce_to_aspect_ratios`; future video tools (caption-sync helpers,
beat-detection hints, social-export presets) will register here too.

## Determinism scope

Video-app shell code (editor-app-client, route handler) is outside the
determinism-restricted scope — UI code may use `Date.now`, timers,
`crypto.randomUUID`. **Clip code rendered inside the canvas MUST remain
deterministic**; every T-183 clip body is scanned by
`pnpm check-determinism`. Transcription runs at authoring time, not
render time, so the Whisper network call is allowed — the cache makes
re-renders identical without re-calling.

## Parity (T-188)

Six parity manifests cover the mode's render surface, grouped by
category:

- **Video overlays** — `hook-moment`, `product-reveal`, `lower-third`.
- **Aspect-bounce** — `endslate-logo` @ 9:16, `testimonial-card` @ 1:1.
- **Audio-sync** — `beat-synced-text` with dense reference frames around
  each beat.
- **Captions** — inherited from the pre-existing
  `frame-runtime-subtitle-overlay.json`; the T-184 caption pack hydrates
  the same render surface.

Thresholds default to `minPsnr: 32, minSsim: 0.95, maxFailingFrames: 0`
(standard frame-runtime-bridge tier). Goldens are produced at CDP-harness
time, not committed with the manifests.

## Quality gates

Every video-app or video-profile PR must pass:

- `pnpm typecheck` — TS strict with `noUncheckedIndexedAccess` +
  `exactOptionalPropertyTypes`.
- `pnpm lint` — Biome.
- `pnpm test` — Vitest; ≥85% coverage on changed code.
- `pnpm check-licenses` — whitelist only.
- `pnpm check-remotion-imports` — zero matches anywhere in the video tree.
- `pnpm check-determinism` — scoped rule; still runs for every PR.
- `pnpm check-skill-drift` — skills ↔ source.
- `pnpm skills-sync:check` + `pnpm gen:tool-skills:check` — registry-driven skill files in sync.
- `pnpm parity` — PSNR + SSIM if rendering touched; T-188 fixtures gate the video tier.

Plus: PR template checklist complete, changeset included if a
publishable package is touched.

## Acceptance (Phase 8 exit criterion)

*"Render 30s ad across 3 aspect ratios from prompt; captions sync ±100 ms."*

The ingredients:

- **Prompt → document**: `/api/agent/execute` (T-187c) plans +
  executes + validates a video document.
- **3 aspect ratios**: `bounce_to_aspect_ratios` (T-185) +
  `exportMultiAspectInParallel` (T-186).
- **Captions sync**: `@stageflip/captions` (T-184) with SHA-256 cache.
- **30s render**: frame-runtime-bridge dispatches each variant through
  the CDP host bundle.

Remaining Phase 8 work tracks non-blocking tooling (timeline UI
composition, aspect-bouncer preview mount) and goldens priming — the
core path is in place.

## Where things go

| Adding… | Goes in |
|---|---|
| New video clip | `packages/runtimes/frame-runtime-bridge/src/clips/<kind>.tsx` + register in `ALL_BRIDGE_CLIPS` + add to `VIDEO_CLIP_KINDS` in `@stageflip/profiles-video` + fixture under `packages/testing/fixtures/frame-runtime-<kind>.json` + `KNOWN_KINDS` entry. |
| New video-only agent tool | Handler in `packages/engine/src/handlers/video-mode/` + registry-driven auto-gen runs `pnpm gen:tool-skills`. Bundle already in `VIDEO_TOOL_BUNDLES`. |
| New captions provider | `packages/captions/src/providers/<name>.ts` implementing `TranscriptionProvider`; export from `src/index.ts`. |
| New render backend | Implement `VariantRenderer` (`@stageflip/export-video`); wire into the host app (CDP / bake). |
| New lint rule for video mode | `packages/profiles/video/src/rules.ts` + add to `VIDEO_RULES`; gate on `doc.mode === 'video'`. |
| New translated UI string | `apps/stageflip-video/src/...` catalog entries flow through `t(...)` from `@stageflip/editor-shell`. |
| New aspect-ratio preset | Extend `aspectRatioSchema` in `packages/schema/src/content/video.ts`; `layoutAspectPreviews` + `bounce_to_aspect_ratios` pick it up for free. |

## Related

- Profile: `profiles/video/SKILL.md` (element allowlist, lint rules, bundle list, clip kinds).
- Tools: `tools/video-mode/SKILL.md` (auto-generated from the engine registry).
- Captions: `concepts/captions/SKILL.md`.
- Determinism: `concepts/determinism/SKILL.md`.
- Parity: `workflows/parity-testing/SKILL.md`.
- Frame runtime bridge: `runtimes/frame-runtime-bridge/SKILL.md`.
- Owning task: T-189 (this doc). Composing tasks span T-180..T-188.
