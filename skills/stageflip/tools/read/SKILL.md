---
title: Tools — Read Bundle
id: skills/stageflip/tools/read
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-155
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
  - skills/stageflip/concepts/agent-executor/SKILL.md
---

# Tools — Read Bundle

Five read-only tools for inspecting the current document. The Planner
selects this bundle on any step that needs to reason about state before
mutating it; Executor loads them via `registerReadBundle(registry, router)`
from `@stageflip/engine`.

Handlers type against `DocumentContext` (document + optional selection) —
they **never** push to `patchSink`. Callers can point the bundle at any
`ToolRouter<TContext extends DocumentContext>`.

## Tools

### `get_document`

Top-level document metadata. Available across all three modes.

Input: `{}`.

Output:

```ts
{
  id: string;
  mode: 'slide' | 'video' | 'display';
  locale: string;
  title?: string;
  themeName?: string;
  // Exactly one of these, keyed on mode:
  slideCount?: number;
  trackCount?: number;
  sizeCount?: number;
}
```

Never returns the full document payload — that would blow the LLM context
budget. Use `get_slide` / `list_elements` for per-slide detail.

### `get_slide`

Per-slide summary. Slide mode only; wrong-mode calls return
`{ found: false, reason: 'wrong_mode' }`.

Input: `{ slideId: string }`.

Output:

```ts
| { found: true; id; title?; elementCount; durationMs?; hasBackground; hasTransition; hasNotes }
| { found: false; reason: 'wrong_mode' | 'not_found' }
```

### `list_elements`

Elements on a slide. Slide mode only.

Input: `{ slideId: string }`.

Output: `{ found: true, slideId, elements: { id, type, name?, visible }[] } | { found: false, reason }`.

### `describe_selection`

What the user currently has selected in the editor. Reads
`context.selection`; returns empty arrays when nothing is selected.
Non-slide modes currently return `selectedIds` but empty `elements`.

Input: `{}`.

Output: `{ slideId?, selectedIds: string[], elements: { id, type, name?, visible }[] }`.

The Executor threads `ExecutorRequest.selection` through to this handler.
When wiring the AI copilot (T-170), the editor client should pass its
current selection state in the request.

### `get_theme`

Palette + design tokens. Small payload — safe to call whenever the model
needs to reason about brand colours or token values.

Input: `{}`.

Output: `{ palette: Record<string, string>; tokens: Record<string, string | number> }`.

Palette entries that are not plain colour strings are dropped — a
conservative cut to prevent refs or undefined values from confusing the
model. Full theme-ref resolution lands with T-249.

## Registration

```ts
import { createCanonicalRegistry, ToolRouter, registerReadBundle } from '@stageflip/engine';

const registry = createCanonicalRegistry();    // seeded catalog, empty tools
const router = new ToolRouter<ExecutorContext>();
registerReadBundle(registry, router);           // +5 tools on both sides
```

`registerReadBundle` throws when (a) the registry has no `read` bundle to
merge into, or (b) the router already has a handler with one of the same
names. The router↔registry name set is asserted equal by an integration
test in `handlers/read/register.test.ts`.

## Invariants

- Every handler carries `bundle: 'read'` per the tool-bundles skill §"Enforcement".
- Bundle tool count = 5 → well within the 30-tool I-9 budget.
- No handler mutates the document, returns patches, or calls the LLM.

## Related

- Meta: `concepts/tool-bundles/SKILL.md`
- Router: `concepts/tool-router/SKILL.md`
- Executor (consumer): `concepts/agent-executor/SKILL.md`
- Task: T-155
