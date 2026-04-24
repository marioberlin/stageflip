---
title: Tools — Fact-Check Bundle
id: skills/stageflip/tools/fact-check
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-165
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/tools/qc-export-bulk/SKILL.md
---

# Tools — Fact-Check Bundle

Two tools that bookend the LLM's fact-checking loop:

1. `list_factual_claims` — heuristic extractor. Scans every text
   element (including run-style text) and slide notes for sentences
   containing numeric claims (percentages, dollar amounts, counts),
   year references (`in 2023`, `by 1984`, `circa 1999`), or
   `"according to <source>"` phrasing. Returns a ranked list of
   candidate claims with `{ slideId, source: 'element'|'notes',
   elementId?, snippet }`. The LLM picks which to verify.

2. `record_fact_check_result` — append a structured fact-check
   annotation to a slide's speaker notes. Status is
   `verified` / `unverified` / `disputed`; `source` is an optional
   URL. Format: machine-parseable block inside `slide.notes`:

   ```
   [fact-check:<status>]
   <claim>
   <source>
   [/fact-check]
   ```

   Refuses `exceeds_max_length` when the appended block would push
   `notes` over the 5000-char schema limit.

## Design note — no HTTP from handlers

This bundle does **not** make HTTP calls. Engine handlers are pure +
deterministic (CLAUDE.md §3 forbids `fetch` inside
`packages/engine/**`'s production paths by convention, and determinism
gates enforce this for clip/runtime code). The LLM is expected to call
a web-search tool from the orchestrator layer (planner tier, not the
engine bundle tier), gather evidence, then use
`record_fact_check_result` to write the conclusion back into the
document.

## Invariants

- Every handler declares `bundle: 'fact-check'`.
- Both handlers type against `MutationContext`.
- Tool count 2 → well within I-9's 30 cap.
- Fact-check blocks in notes are machine-parseable: downstream
  consumers (audit pipelines, export renderers, QC tools) can grep for
  `[fact-check:` prefix. The bundle exports `FACT_CHECK_BLOCK_RE` for
  parsers that need it.

## Related

- Meta: `concepts/tool-bundles/SKILL.md`
- QC sibling: `tools/qc-export-bulk/SKILL.md`
- Task: T-165
