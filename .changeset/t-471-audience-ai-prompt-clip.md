---
'@stageflip/schema': minor
'@stageflip/runtimes-audience': minor
'@stageflip/app-audience-join': minor
'@stageflip/rir': patch
'@stageflip/export-pptx': patch
---

T-471 — `AudienceAiPromptClip` family. Eleventh + FINAL audience-clip
variant on disk; the THIRD marquee differentiator (per ADR-010 §D1 +
§D7): audience-driven AI generation. Voters submit prompts → upvote
shortlist → winning prompt triggers the P14 asset-gen pipeline
(Seedance T-430 / ACE-Step T-432 / etc., per `targetModality`); the
generated asset is then rendered statically in the static-fallback
view. This clip family closes the v1 clip-family set and demonstrates
the cross-product synergy (audience-driven authoring of AI-generated
assets) that Slido / Mentimeter / Poll Everywhere structurally cannot
offer.

Schema-side `audience-ai-prompt` variant ships:

- `props: { prompt, targetModality, topN (default 20),
  maxPromptLength (default 200), sessionId? }`.
- `targetModality` enum: `'video-gen' | 'music-gen' | 'image-gen' |
  'tts'`, mapping onto P14's `AdapterModalityKind`.
- `ELEMENT_TYPES` bumped 23 → 24.

Audience runtime ships:

- a pure static-fallback render function with a three-state
  dispatcher (voting / generating / final) emitting distinct
  `data-state` markers + a `data-testid="aip-state"` phase marker.
- per-modality asset rendering on the final phase: `<video>` for
  `video-gen`, `<audio>` for `music-gen` / `tts`, `<img>` for
  `image-gen`. Each carries `data-cache-key` + `data-modality` + the
  raw cacheKey as `src` (URL resolution deferred to a follow-up
  task).
- a three-state factory (live / staticFallback / empty-live-mount)
  matching T-461..T-470.
- module-load auto-registration into `audienceClipRegistry`,
  `staticFallbackRenderer`, and `audienceRuntime`.

Voter UI: tabbed Submit / Browse mirroring T-464's LiveQA pattern.
Submit emits `{ kind: 'audience-ai-prompt', action: 'submit', text }`;
upvote emits `{ action: 'upvote', promptId }`. Per-promptId memo to
disable already-upvoted buttons. Lock-when-winner-set: once
`winnerPromptId !== null`, both tabs disable + a "Voting ended.
Winner: …" status line replaces the input affordances. Voter
dispatcher registry size 10 → 11 (registry now covers every
`AudienceClipKind`).

§13 (structural-extension end-to-end verification): option 1 —
`render-e2e.test.ts` drives the static-fallback through
`StaticFallbackRenderer` with three snapshots (one per phase) and
asserts on observable DOM:

- final-phase spec snapshot: `<video>` element with
  `data-cache-key="cache://video/abc123"` + `data-modality="video-gen"`
  + winner banner with "A sunset over mountains" + full prompt feed
  (3 entries) + "3 prompts" total label.
- voting phase: no `<video>` / `<audio>` / `<img>`; full feed
  present; `data-state="voting"`.
- generation phase: "Generating with AI…" placeholder present;
  winner banner shown; no asset element.

Cross-package switches updated:

- `packages/rir/src/compile/index.ts` — RIR lowering case
  (`runtime: 'audience'`, `clipName: 'audience-ai-prompt'`).
- `packages/export-pptx/src/parts/{slide,template-elements}.ts` —
  fallthrough into the existing unsupported-element loss-flag path
  pending a downstream renderer task.

CI gates green: typecheck, lint, test, check-licenses,
check-remotion-imports, check-determinism, check-skill-drift,
check-audience-permissions reports "11 audience clips inspected",
gen:tool-skills:check, skills-sync.

Out of scope: server-side trigger of the asset-gen pipeline on
winner declaration (the audience backend service T-453 routes the
trigger; the actual generation lives in the P14 asset-gen sandbox +
provider stack T-426..T-434 + T-444), winner-selection algorithm
(presenter or server-side decision; T-471 renders whatever
`winnerPromptId` the snapshot carries), cost-budget enforcement on
AI generation (inherited from T-443 TenantCostTrackerStore),
cacheKey → URL resolution (deferred — emitted as raw `src` +
`data-cache-key`; tests assert on attribute presence), Cluster I
parity fixtures (T-476), native provider (T-478), vendor adapters
(motion-native = native-only per ADR-010 §D7).

This task closes the v1 clip-family set. AUDIENCE_CLIP_KINDS = 11.
