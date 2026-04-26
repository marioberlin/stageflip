---
title: RIR (Renderable Intermediate Representation)
id: skills/stageflip/concepts/rir
tier: concept
status: substantive
last_updated: 2026-04-20
owner_task: T-029
related:
  - skills/stageflip/concepts/schema/SKILL.md
  - skills/stageflip/concepts/fonts/SKILL.md
  - skills/stageflip/concepts/determinism/SKILL.md
  - skills/stageflip/reference/export-formats/SKILL.md
---

# RIR — Renderable Intermediate Representation

The RIR sits between the canonical schema and any rendering backend. Its job:
**resolve everything that could be ambiguous at render time**, so editors, the
headless export pipeline, and thumbnail runtimes all see exactly the same
tree.

## What the compiler does

| Pass | Input | Output |
|---|---|---|
| Apply inheritance | per-element `inheritsFrom` | placeholder fields filled from layout / master (T-251) |
| Theme resolve | raw token refs | literal values |
| Variable resolve | `{{x}}` placeholders | bound values from `variables` |
| Component expand | `<MyCallout/>` refs | inline element trees |
| Binding resolve | data-source bindings | concrete values |
| Timing flatten | nested start/end/anchor | absolute per-frame timings |
| zIndex assign | array order | `zIndex = arrayIndex * 10` |
| Stacking context | three/shader/embed runtimes | `isolation: isolate` wrappers |
| Font aggregate | per-element font use | `FontRequirement[]` for FontManager |

The `apply-inheritance` pass runs **first** so theme tokens / variables / component bodies on placeholder values resolve through the standard pipeline. It can emit two diagnostic codes (both `severity: 'warn'`):
- `LF-RIR-LAYOUT-NOT-FOUND` — a slide carries a `layoutId` that does not resolve in `Document.layouts`.
- `LF-RIR-PLACEHOLDER-NOT-FOUND` — an element carries `inheritsFrom.placeholderIdx` that does not match any placeholder on the layout (or transitively on its master), or `inheritsFrom.templateId` that does not resolve.

Materialization is implemented as a pure helper `applyInheritance(doc): Document` exported from `@stageflip/schema`; the RIR pass is a thin wrapper that delegates to the helper and walks the slides a second time to emit diagnostics. The same helper is consumed by the editor canvas via `materializedDocumentAtom` so editor reads see the same materialized fields.

Output: a pure, determinism-safe `RIR` tree + a `StackingMap` (for parity
verifiers) + a `FontRequirementSet`.

## Invariants

- **Pure.** `compile(document)` is a pure function. Same input → byte-identical
  output. No `Date.now()`, no `Math.random()`, no network. If the schema
  forbids it, the RIR forbids it harder.
- **Explicit.** Nothing implicit survives the compiler. No "default spacing
  applies if omitted" at render time — defaults are materialized.
- **Stable.** `RIR` is versioned alongside schema. A schema migration that
  changes semantics must land with an RIR test update.

## Why `zIndex = arrayIndex * 10`

Reserves gaps for future-inserted elements without renumbering the whole
stack. Runtimes that need an extra layer (three, shader, embed) get wrapped in
an `isolation: isolate` container so they can't leak out of their slot.

## Implementation

- Package: `@stageflip/rir` (T-029 types, T-030 compiler, T-031 finalize, T-032 fixtures)
- Entry point: `compileRIR(document, opts)` — returns `{ rir, diagnostics }`
- Pass implementations: `packages/rir/src/compile/passes.ts`
- Finalize pass (stacking + timing): `packages/rir/src/compile/finalize.ts`
- Orchestrator: `packages/rir/src/compile/index.ts`
- Golden fixtures: `packages/rir/fixtures/inputs/` paired with `fixtures/goldens/`

## Compiling a document

```ts
import { compileRIR } from '@stageflip/rir';

const { rir, diagnostics } = compileRIR(document, {
  // Opt-in strict mode rejects any pass that produces warnings.
  strict: true,
});

if (diagnostics.some((d) => d.severity === 'error')) {
  throw new Error(`RIR compile failed: ${diagnostics.length} issues`);
}

// rir.meta is materialized (no refs); rir.elements have absolute timings
// and assigned zIndex values; rir.fonts is a deduplicated
// FontRequirement[] the renderer can hand straight to the FontManager.
```

Compile is pure — same `document` always produces byte-identical `rir`. That property is what makes the parity harness + prompt-caching model work.

## Related

- Schema: `concepts/schema/SKILL.md`
- Fonts: `concepts/fonts/SKILL.md`
- Determinism: `concepts/determinism/SKILL.md`
- Compiler tasks: T-030, T-031, T-032
