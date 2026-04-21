---
"@stageflip/renderer-cdp": minor
---

Host contract carries `RIRDocument` + `richPlaceholderHostHtml` (T-100c).

Foundation for T-100d (runtime-bundle host) — with this change,
host builders get full access to the element tree, not just
dispatch metadata.

**Contract change**:

- `CdpSession.mount(plan, config, document)` — new required
  `document: RIRDocument` parameter. Single in-repo caller
  (`LiveTierAdapter.mount`) already has the document and threads
  it through; external implementers of `CdpSession` must update.
  Since `@stageflip/renderer-cdp` is `private: true` with zero
  external consumers, the break is harmless.
- `HostHtmlBuilder` context adds `document: RIRDocument`. Existing
  builders that only need viewport + fps + duration continue to
  work (they just ignore the new field) — `canvasPlaceholderHostHtml`
  still shipped unchanged in behaviour.

**New export — `richPlaceholderHostHtml`**:

Renders non-clip RIR elements (text, shape, video/image
placeholders) as absolutely-positioned inline DOM nodes with
frame-reactive visibility:

- Each element becomes a `<div class="__sf_el">` with CSS from its
  `transform` (position, size, opacity, rotation).
- Shape elements get their `content.fill` as the background;
  `shape: 'ellipse'` gets `border-radius: 50%`.
- Text elements render `content.text` with the font spec.
- Video / image / clip elements render as labelled
  hatched-background placeholders.
- `window.__sf.setFrame(n)` toggles each element's `display`
  based on whether `n ∈ [startFrame, endFrame)`. Animations are
  NOT applied — full animation resolution lands with T-100d.

**Determinism posture**: safe under BeginFrame — the host page
does zero network, zero timers, zero random numbers. Every
frame's DOM state is a pure function of `(document, frame)`.

**Script-injection defence**: the document JSON is embedded in a
`<script type="application/json">` tag; the serialiser replaces
`</script` with `<\/script` (a valid JSON escape for `/`) and
escapes U+2028 / U+2029 line separators so text elements
containing `</script` substrings or exotic whitespace cannot
break out.

**Plan doc change**: `docs/implementation-plan.md` updated —
T-100c narrows to contract + smart placeholder (M), T-100d added
for the runtime-bundle host (L). Plan version bumped v1.2 → v1.3.

**Tests**: 224 → 229 in renderer-cdp. Five new cases cover
document threading from the session through to the builder, and
richPlaceholderHostHtml's dimension embedding, JSON embedding,
`</script` escape, U+2028/U+2029 escape, and `window.__sf` boot.
All 19 existing mount-callers updated to the 3-arg form (via a
shared `mkDoc()` helper). E2E reference-render suite still green
on macOS via the unchanged `canvasPlaceholderHostHtml`.

**Skill**: `skills/stageflip/reference/export-formats/SKILL.md`
updated — the pluggable-host section now documents all three
builders (canvas, rich placeholder, runtime bundle); the module-
surface table adds the T-100c exports; the deferred-work table
points the runtime-bundle row at T-100d.
