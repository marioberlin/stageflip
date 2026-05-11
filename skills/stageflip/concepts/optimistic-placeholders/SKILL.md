---
title: Optimistic placeholders for async asset generation
id: skills/stageflip/concepts/optimistic-placeholders
tier: concept
status: substantive
last_updated: 2026-05-11
owner_task: T-438
related:
  - skills/stageflip/concepts/agent-executor/SKILL.md
  - skills/stageflip/concepts/provider-seam/SKILL.md
  - skills/stageflip/concepts/schema/SKILL.md
---

# Optimistic placeholders

Async asset generation (Phase 14 Provider Seam) blocks the editor UI
unless the document model surfaces an in-flight state. T-438 introduces
the **optimistic-placeholder** pattern: a `generate_asset` tool call
returns IMMEDIATELY with a placeholder result, and emits a placeholder
`MediaElement` carrying `provenance.kind: 'asset-gen-pending'`. The
editor renders the placeholder as a greyed-out box + spinner +
adapter modality + countdown. When the adapter resolves, a follow-up
swap patch replaces the placeholder with the terminal-state asset.

## Lifecycle

```
1. Agent invokes generate_asset with optimistic: true
2. Engine handler:
   a. Validates seams (adapterRegistry + licenseGate + tenantContext +
      placeholderResolver)
   b. Resolves slide + derives cacheKey + selects licensed adapters
   c. Synthesizes placeholderId (UUID) + estimatedCompletionAt
   d. Emits patch:  add MediaElement with
      provenance.kind: 'asset-gen-pending', placeholderId, cacheKey,
      provider, estimatedCompletionAt
   e. Fires placeholderResolver.dispatch(...) fire-and-forget
   f. Returns { ok: true, kind: 'placeholder', placeholderId, ... }
3. Editor renders the placeholder element (AssetGenPlaceholder)
4. Adapter resolves in the background (1s..5min)
5. placeholderResolver seam owns the swap transport:
   - Next-cycle tool call (default), OR
   - Streaming event (T-442), OR
   - Polling (host's choice)
6. Swap patch: remove placeholder element + add terminal-state asset
   (correlated via placeholderId)
7. Editor unmounts AssetGenPlaceholder; normal asset renderer takes
   over
```

## The pending discriminator

`MEDIA_PROVENANCE_KINDS` (T-421, extended in T-438) includes the
`'asset-gen-pending'` variant alongside the 7 terminal variants
(`'tts'`, `'video-gen'`, `'music-gen'`, `'sfx'`, `'three-d'`,
`'image-gen'`, `'imported'`).

A pending element carries:

- `provenance.kind: 'asset-gen-pending'` — discriminator
- `provenance.placeholderId: string` — opaque correlation id
- `provenance.cacheKey: string` — the deterministic cache key the
  swap will share (so cache-hit short-circuits land on the same
  asset)
- `provenance.provider?: string` — the chosen adapter id (the
  spinner label uses this)
- `provenance.model?` / `voiceId?` / `prompt?` / `seed?` /
  `researchSessionId?` — same audit fields as terminal provenance
- `provenance.estimatedCompletionAt?: string` — ISO-8601 datetime
  the editor countdown ticks toward; optional (indefinite spinner
  when absent)

## The placeholderResolver seam

```ts
interface PlaceholderResolver {
  dispatch(input: PlaceholderDispatchInput): Promise<void>;
}

interface PlaceholderDispatchInput {
  placeholderId: string;
  licensed: readonly AdapterDescriptor[];  // candidates from fallback chain
  modality: AssetProducingModality;
  prompt: string;
  // ...same as ExecuteAdapterCallInput, plus target.slideId etc.
}
```

Hosts wire the resolver onto `AssetGenerationContext.placeholderResolver`.
When absent, calling `generate_asset` with `optimistic: true` returns
`{ ok: false, reason: 'asset_generation_unavailable' }` (the
synchronous path remains available without the seam).

The handler does **NOT await** `dispatch`. The seam owns:

- Adapter execution (typically reuses `FallbackChainExecutor`)
- Telemetry on success / failure
- Asset upload (resolved bytes → AssetRef)
- The eventual swap patch delivery transport

## Editor-shell rendering

`<AssetGenPlaceholder element={el} />` in `@stageflip/editor-shell`:

- Returns `null` when `el.provenance` is absent or `kind` is terminal
- Renders a greyed-out box + spinner + label "Generating <type> with
  <provider>" + countdown when `kind === 'asset-gen-pending'`
- Reads `provenance.estimatedCompletionAt` to drive the countdown;
  falls back to an indefinite "working..." label when absent
- Exposes test-id `asset-gen-placeholder` + `data-placeholder-id` for
  swap-matching tests in host apps

`useAssetGenPlaceholders()` hook returns every pending element in
document-order. Editor sidebars use it for count badges and
per-modality progress indicators.

## §13 deferral

The T-438 schema extension is a **§13 structural extension** (new
`MediaProvenance.kind` variant + two new optional fields). Per
CLAUDE.md §13 acceptable-evidence **option 3**, pixel-level
verification is **DEFERRED**:

- Pending provenance is metadata only — no new RIR element type,
  no new clip kind, no new runtime, no new compositing mode
- The visual surface is `<AssetGenPlaceholder>`; its tests assert
  on the rendered DOM (test-ids, label text, countdown state)
- Renderer parity goldens consume TERMINAL-STATE assets only;
  pending elements are filtered out at export time
- The downstream pixel-verification gate is T-442 (streaming
  events real-render integration test) or a future dedicated
  visual-verification task

## Async dispatch pattern

T-438 picked **immediate-return-then-background-promise** over a
streaming-event posture:

- The handler returns the placeholder result synchronously
- `placeholderResolver.dispatch(...).catch(...)` runs fire-and-forget
- The seam owns the swap transport (next-cycle tool call vs streaming
  event vs polling — host's choice)

This keeps the engine handler transport-agnostic. T-442 lands the
streaming-event transport that wires the swap into a new
`asset-gen-completed` ExecutorEvent; until then, hosts deliver the
swap on the next agent run or via a side channel.

## Related concepts

- `concepts/agent-executor` — the tool-call loop that produces
  placeholder + swap patches as ExecutorEvents
- `concepts/provider-seam` — the AdapterRegistry / LicenseGate /
  FallbackChainExecutor stack the seam dispatches through
- `concepts/schema` — `MediaProvenance` shape + the strict-mode
  back-compat rules
