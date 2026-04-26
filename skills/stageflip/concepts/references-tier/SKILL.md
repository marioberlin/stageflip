---
name: references-tier
description: Convention for shipping a sibling `references/` directory next to a SKILL.md when the surface complexity warrants it. Each reference doc is short (<500 lines), purpose-specific (constraints / pitfalls / patterns / case studies), and linkable from the parent skill. Inspired by huashu's references/ tier (~7K lines across 20 docs).
---

# `references/` tier convention

A SKILL.md is the agent's **first read** for a topic — the principles, the contract, the canonical pointer. But complex topics produce content that doesn't fit there:

- **Specific failure modes** ("the `__recording` flag prevents loops; here's why pngjs's `filterType: -1` differs from the bare `PNG.sync.write`")
- **Constraint catalogues** ("can I use `position: fixed` in PPTX export? No, here's why, here's the workaround")
- **Pattern recipes** ("hero-reveal animation: 400-600ms total, 40% intro / 60% settle, expoOut entrance")
- **Case studies** (a single complex feature dissected into reusable patterns)

Cramming this into the SKILL.md inflates it past 500 lines and buries the canonical principles. Splitting it across the broader `docs/` tree makes it un-discoverable mid-task.

The fix is a sibling `references/` directory containing 1-N short docs, linked from the parent SKILL.md.

## When to add a `references/` tier

Add one when **any** of the following is true:

1. The skill's SKILL.md is approaching 500 lines and 30%+ of it is concrete details (not principles).
2. Implementers consistently hit issues the skill mentions but doesn't enumerate.
3. The same edge case appears in multiple PR Reviewer rounds for the same skill.
4. The skill's domain has a "constraints catalogue" (PPTX limits, fonts, browser quirks, API rate limits) that's >10 entries.

Do NOT add one preemptively. The references/ tier earns its place when the SKILL.md can't cleanly hold the depth.

## Directory layout

```
skills/stageflip/<category>/<skill-name>/
  SKILL.md                          # canonical principles, public surface, references[] list
  references/                       # sibling tier
    <topic>-constraints.md          # things you CAN'T do + why + workaround
    <topic>-pitfalls.md             # observed failure modes + prevention rules
    <topic>-patterns.md             # composition recipes + parameter ranges
    <topic>-case-study.md           # one complex feature broken down for reuse
```

Naming is descriptive, not numeric. Pick the suffix that matches content type.

## Per-doc shape

Each `references/<topic>.md` is short (<500 lines) and follows one of these templates:

### Constraints catalogue template

```markdown
# <Skill> constraints

Searchable Q&A: when authoring or reviewing, look up "Can I X?" before doing it.

## Quick lookup

| Question | Answer | Why | Workaround |
|---|---|---|---|
| Can I use `position: fixed`? | No | PPTX has no fixed-positioning equivalent | Use absolute coords inside slide bounds |
| ...

## Detailed entries

### Q: ...
**A**: yes/no, with caveat.
**Why**: brief technical reason + spec/source pointer.
**Workaround**: concrete replacement.
**Verified**: file_path:line_number where the constraint is enforced.
```

### Pitfalls template

```markdown
# <Skill> pitfalls

Failure modes observed in production + prevention rules. Append entries as new failures surface.

## Pitfall #N: <short name>

**Symptom**: what the user/agent sees go wrong.
**Root cause**: technical explanation.
**Prevention**: concrete code/config to add.
**Pin**: test file path + line proving the prevention.
```

### Patterns template

```markdown
# <Skill> patterns

Composition recipes with concrete parameter ranges.

## Pattern: <name>

**When to use**: scenario.
**Recipe**: ordered steps.
**Parameter ranges**: numeric defaults that work in practice.
**Example**: file_path:line_number of a working instance.
**Anti-patterns**: what NOT to do.
```

### Case study template

```markdown
# Case study: <feature name>

A complex feature dissected into reusable patterns.

## Overview

1-paragraph summary of what was built and why.

## Architecture

Diagram or list of the layers + their responsibilities.

## Reusable patterns

Each pattern with: name, code snippet, where it appears, when to reapply.

## What went wrong

Specific bugs or design dead-ends + how they were resolved. Future feature authors read this section first.
```

## Discoverability via SKILL.md

The parent `SKILL.md` should reference the tier explicitly near the top:

```markdown
## References

When the topic comes up mid-task, read the relevant doc:

- [references/pptx-constraints.md](references/pptx-constraints.md) — constraint catalogue (Q&A)
- [references/pptx-pitfalls.md](references/pptx-pitfalls.md) — observed failure modes
- ...
```

Without this list, the references/ tier becomes invisible.

## Tone

Tight, factual, agent-readable. No marketing prose. No "we believe" / "best practice." Each entry should answer **one** question or pin **one** rule, with a code-location citation.

## Maintenance

- A pitfalls entry is added the first time a Reviewer flags an issue that the SKILL.md didn't preempt.
- A constraints entry is added when an Implementer asks "can I do X?" and the answer requires research.
- Entries are not deleted when fixed; they're updated with "Status: fixed in T-XXX" so future readers see the resolved-design history.

## Inspiration

Pattern lifted from `huashu-design`'s `references/` tier (~7K lines across 20 docs, ~average 350 lines/doc). The agent that authored huashu (alchaincyf) split a complex skill across philosophy / technical / pitfalls / case studies; we adopt the structural pattern, not the content.

## Edge case: references/ without a parent SKILL.md

Sometimes a package has surfaced enough concrete edge cases (pitfalls, constraints) to warrant a `references/` tier, but the parent SKILL.md hasn't been written yet because the principles haven't been distilled. In that case, **the references/ tier can ship first**, and the parent SKILL.md is written later when the principles are clear.

Example: `@stageflip/renderer-cdp` had no SKILL.md when this convention landed. The package is foundational (orchestrates every live-tier bake) and has many observed pitfalls; the pitfalls doc was authored first. A future PR can author the parent `skills/stageflip/reference/renderer-cdp/SKILL.md` distilling the principles, at which point it'll link to the existing `references/render-pitfalls.md`.

Auto-generated SKILL.md files (`pnpm skills-sync` outputs like `skills/stageflip/runtimes/SKILL.md`) are NOT touched by hand; references/ tier docs live alongside them and are linked from the package's own dedicated SKILL.md (e.g., `skills/stageflip/runtimes/<runtime>/SKILL.md`) rather than the auto-generated index.

## Adoption status

Initial seed (this PR):
- `skills/stageflip/reference/export-pptx/references/pptx-constraints.md` — PPTX writer constraints (T-253-base).
- `skills/stageflip/reference/renderer-cdp/references/render-pitfalls.md` — renderer-cdp failure modes (parent SKILL.md TBD).

Future skills that have surfaced enough complexity to earn a tier:
- `skills/stageflip/workflows/import-pptx/references/` — gotchas observed across T-243a/b/c.
- `skills/stageflip/workflows/import-google-slides/references/` — T-244 fixture patterns + CV provider stub conventions.
- `skills/stageflip/concepts/loss-flags/references/` — code emission patterns.

These should be added incrementally, only when they earn their place per "When to add" above.
