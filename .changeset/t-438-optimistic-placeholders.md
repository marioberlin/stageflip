---
'@stageflip/schema': minor
'@stageflip/engine': minor
'@stageflip/editor-shell': minor
---

T-438 — optimistic placeholder UX for async asset generation
(Phase 14 γ third cross-cutting integration; §13 structural
extension with option 3 deferral).

- `@stageflip/schema`: extends `MEDIA_PROVENANCE_KINDS` with
  `'asset-gen-pending'` (now 8 variants total) and adds two
  optional slots on `mediaProvenanceSchema`: `placeholderId`
  (opaque correlation id) and `estimatedCompletionAt` (ISO-8601
  upper-bound hint). Pixel-level verification deferred per
  CLAUDE.md §13 option 3 — pending provenance is metadata only
  (no new RIR element, no new runtime, no new compositing mode);
  the visual surface is the new editor-shell component (tests
  assert on rendered DOM); future deeper visual verification is
  gated on T-442 (streaming events real-render integration).
- `@stageflip/engine`: `generate_asset` gains optional
  `optimistic: boolean` input. When true, the handler returns a
  placeholder result `{ ok: true, kind: 'placeholder',
  slideId, elementId, placeholderId, modality, cacheKey,
  estimatedCompletionAt? }` IMMEDIATELY and emits a placeholder
  MediaElement (provenance.kind `asset-gen-pending`); the real
  adapter dispatch fires via the new `placeholderResolver` seam
  in a fire-and-forget background promise. Synchronous path
  (`optimistic` absent / false) is byte-identical to T-423.
- `@stageflip/editor-shell`: new `<AssetGenPlaceholder>` React
  component + `useAssetGenPlaceholders()` hook. The component
  renders a greyed-out box + spinner + provider label +
  countdown for elements whose `provenance.kind` is
  `'asset-gen-pending'`; returns null for terminal-state
  provenance. The hook enumerates pending elements
  document-wide for editor sidebars / count badges.

Async dispatch pattern: immediate-return-then-background-promise.
The placeholder → real-asset swap transport (next-cycle tool call
vs streaming event vs polling) is the seam's choice; T-438 ships
the placeholder mount + the seam contract. T-442 lands the
streaming-event transport.
