---
'@stageflip/schema': minor
'@stageflip/runtimes-audience': minor
'@stageflip/app-audience-join': minor
---

T-462 — `LivePollOpenTextClip`: second standard audience clip family.

- Adds the schema-side `live-poll-open-text` `Element` discriminator
  variant (`packages/schema/src/elements/live-poll-open-text.ts`) with
  the strict `props: { question, maxLength (default 280, max 2000),
  sessionId? }` shape, the `permissions: ['audience-network']` literal
  tuple per ADR-009 §D13, and the optional `provenance` slot per
  ADR-010 §D5. Second audience-clip variant on the `Element` union
  (T-461 was the first); `ELEMENT_TYPES` bumped 14 → 15.
- Ships the `live-poll-open-text` clip family under
  `packages/runtimes/audience/src/clips/live-poll-open-text/`:
  manifest, clip-definition (registered with `audienceRuntime`),
  factory (registered with `audienceClipRegistry`), and a deterministic
  static-fallback renderer (registered with `staticFallbackRenderer`).
  Static-fallback layout: vertical list of "text — N votes" rows,
  ordered by count desc; total label "N responses".
- Wires `LivePollOpenTextVoterInput` into the audience-join voter-input
  dispatcher's default registry (size grows from 1 → 2).
- §13 (CLAUDE.md structural-extension) verification ships as
  `render-e2e.test.ts` — drives the static-fallback path through the
  T-454 dispatcher with a known snapshot (`{ entries: [{ text: 'great
  talk', count: 5 }, { text: 'more demos!', count: 3 }, { text: 'love
  the q&a', count: 2 }], totalResponses: 10 }`) and asserts on
  observable DOM (three rows, count desc ordering, "10 responses"
  total label, each entry's text rendered, non-blank row + badge
  backgrounds) per option-1 of the §13 menu.
- RIR compiler + PPTX writer extend their exhaustive-switch coverage
  for the new `Element` variant.
