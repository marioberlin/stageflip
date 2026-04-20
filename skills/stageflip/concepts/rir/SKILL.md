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
---

# RIR — Renderable Intermediate Representation

The RIR sits between the canonical schema and any rendering backend. Its job:
**resolve everything that could be ambiguous at render time**, so editors, the
headless export pipeline, and thumbnail runtimes all see exactly the same
tree.

## What the compiler does

| Pass | Input | Output |
|---|---|---|
| Theme resolve | raw token refs | literal values |
| Variable resolve | `{{x}}` placeholders | bound values from `variables` |
| Component expand | `<MyCallout/>` refs | inline element trees |
| Binding resolve | data-source bindings | concrete values |
| Timing flatten | nested start/end/anchor | absolute per-frame timings |
| zIndex assign | array order | `zIndex = arrayIndex * 10` |
| Stacking context | three/shader/embed runtimes | `isolation: isolate` wrappers |
| Font aggregate | per-element font use | `FontRequirement[]` for FontManager |

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

## Related

- Schema: `concepts/schema/SKILL.md`
- Fonts: `concepts/fonts/SKILL.md`
- Determinism: `concepts/determinism/SKILL.md`
- Compiler tasks: T-030, T-031 (rev), T-032 (golden fixtures)
