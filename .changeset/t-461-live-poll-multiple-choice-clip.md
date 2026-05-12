---
'@stageflip/schema': minor
'@stageflip/runtimes-audience': minor
'@stageflip/app-audience-join': minor
---

T-461 — `LivePollMultipleChoiceClip`: first standard audience clip
family.

- Adds the schema-side `live-poll-multiple-choice` `Element` discriminator
  variant (`packages/schema/src/elements/live-poll-multiple-choice.ts`)
  with the strict `props: { question, options[2..10], sessionId? }` shape,
  the `permissions: ['audience-network']` literal tuple per ADR-009 §D13,
  and the optional `provenance` slot per ADR-010 §D5. First audience-
  clip variant on the `Element` union; sets the precedent for
  T-462..T-471.
- Ships the `live-poll-multiple-choice` clip family under
  `packages/runtimes/audience/src/clips/live-poll-multiple-choice/`:
  manifest, clip-definition (registered with `audienceRuntime`),
  factory (registered with `audienceClipRegistry`), and a deterministic
  static-fallback renderer (registered with `staticFallbackRenderer`).
- Wires `LivePollMultipleChoiceVoterInput` into the audience-join voter-
  input dispatcher's default registry (was inaugural-empty before).
- §13 (CLAUDE.md structural-extension) verification ships as
  `render-e2e.test.ts` — drives the static-fallback path through the
  T-454 dispatcher with a known snapshot and asserts on observable DOM
  (three bars, proportional ordering, "18 votes" total label, non-blank
  bar fills) per option-1 of the §13 menu.
- RIR compiler + PPTX writer extend their exhaustive-switch coverage for
  the new `Element` variant.
