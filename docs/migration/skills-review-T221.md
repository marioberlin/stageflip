---
title: T-221 — Skills review pass
id: docs/migration/skills-review-T221
owner: orchestrator
last_updated: 2026-04-24
---

# T-221 — Skills review against four non-negotiables

**Scope**: all 63 `SKILL.md` files under `skills/stageflip/`.

**Non-negotiables** (CLAUDE.md §5; skills-tree concept SKILL):

1. **One-screen** — body fits in ~150 lines / ~6500 chars so a reader can skim the whole thing without scrolling past orientation.
2. **Examples-over-prose** — concrete code / CLI / config snippets carry the weight; prose explains the *why*, not the *what*.
3. **Cross-linked** — every substantive skill declares ≥2 related entries in frontmatter AND references them in the body.
4. **Single-source-of-truth** — the skill does not duplicate content that lives in source (Zod schemas, tool registries, TSDoc). If both exist, one is auto-generated.

## Method

Programmatic audit over every `SKILL.md` for: line count, char count, code-block count, `related:` entry count, status, tier. Audit output captured in the commit message of the T-221 PR. File-by-file findings recorded below grouped by severity.

## Summary

- **63 files** total.
- **5 must-fix**: placeholders with empty `related:` frontmatter. Non-negotiable #3 fails trivially.
- **4 should-fix**: substantive concepts with 0 code blocks (non-negotiable #2).
- **3 nice-to-fix**: substantive concepts with only 1 related entry.
- **5 flagged for follow-up** (not in scope of T-221): files >300 lines that need structural rework. Listed in §"Follow-ups".
- **17 auto-gen files**: reviewed under the generator that emits them, not hand-edited. No action.
- **29 files green** against all four non-negotiables.

## Must-fix (5 files)

Empty `related:` on placeholders. Placeholders are allowed (CLAUDE.md §5 explicitly permits them), but they still need ≥1 cross-link so readers can find the substantive surface.

| File | Proposed `related` links |
|---|---|
| `profiles/slide/SKILL.md` | `modes/stageflip-slide`, `concepts/rir` |
| `reference/cli/SKILL.md` | `reference/schema`, `reference/validation-rules` |
| `workflows/import-google-slides/SKILL.md` | `concepts/loss-flags`, `concepts/design-system-learning` |
| `workflows/import-hyperframes-html/SKILL.md` | `concepts/loss-flags`, `concepts/rir` |
| `workflows/import-pptx/SKILL.md` | `concepts/loss-flags`, `concepts/design-system-learning` |
| `workflows/import-slidemotion-legacy/SKILL.md` | `concepts/rir`, `workflows/parity-testing` |

## Should-fix (3 files)

Substantive concepts with zero fenced code blocks. Non-negotiable #2 requires concrete examples where the concept has a usage surface.

| File | Finding | Action |
|---|---|---|
| `concepts/captions/SKILL.md` | Explains the transcription provider pipeline but no code — a reader can't see how to call `createProvider()` or `packWords()`. | Add a ~10-line example showing provider creation + packWords → SegmentTrack. |
| `concepts/mcp-integration/SKILL.md` | Describes the MCP server shape without showing a tool-list or call example. | Add a minimal MCP `callTool` example mirroring the future `@stageflip/mcp-server` surface. |
| `concepts/rir/SKILL.md` | A foundational concept documented entirely in prose — the RIR has a concrete call-site shape that should appear. | Add a minimal `compileRIR` example (≤15 lines TS). |

(`concepts/rate-limits/SKILL.md` already carries a header-response example fenced block; moved to the cross-link set below.)

## Nice-to-fix (4 files)

Low cross-linking (`related: 1`). Under-linking makes the skill an orphan — CLAUDE.md §5 treats cross-linking as a thread readers pull to discover the rest of the tree.

| File | Current `related` | Proposed additions |
|---|---|---|
| `concepts/collab/SKILL.md` | 1 | `concepts/auth`, `concepts/rate-limits` |
| `concepts/editor-context-menu/SKILL.md` | 1 | `concepts/skills-tree`, `modes/stageflip-slide` |
| `concepts/rate-limits/SKILL.md` | 1 | `concepts/mcp-integration`, `concepts/agent-executor` |
| `concepts/skills-tree/SKILL.md` | 1 | `concepts/tool-bundles`, `reference/schema` |

## Auto-gen (17 files; reviewed via generator)

Any content deficit here is a generator task, not a hand-edit. Flagged for future-T tasks:

- `clips/catalog/SKILL.md` — T-220 gen; satisfies all 4.
- `runtimes/SKILL.md` — T-220 gen; satisfies all 4.
- `tools/SKILL.md` — T-220 gen; satisfies all 4.
- `reference/schema/SKILL.md` — T-034 gen; long (401 lines) but table-heavy; acceptable.
- `reference/validation-rules/SKILL.md` — T-107 gen.
- `tools/<bundle>/SKILL.md` × 16 — T-169 gen; all have 0 code blocks by design (tool signatures are the example); `related: 2` is the generator default. Acceptable.

**Follow-up (future task)**: the 16 per-bundle tool skills could benefit from a minimal `tool-router.dispatch({ name: '...', args: {...} })` example in the generator template. Out of T-221 scope.

## Follow-ups (5 files; not in T-221 scope)

Files that are >300 lines AND substantive — they violate the one-screen non-negotiable, but splitting each is a dedicated task. Listed here so the handover knows they exist; **not touched by this PR**:

| File | Lines | Chars | Why deferred |
|---|---|---|---|
| `modes/stageflip-slide/SKILL.md` | 407 | 19569 | Earliest mode skill; splitting would break inbound links across the tree. Worth a dedicated T-2NN. |
| `workflows/parity-testing/SKILL.md` | 405 | 19286 | Phase-5 deliverable; the PSNR/SSIM methodology is genuinely long; split via TOC is a tooling task. |
| `modes/stageflip-display/SKILL.md` | 322 | 17283 | Shipped last phase (T-209) substantive; splitting too soon is churn. |
| `modes/stageflip-video/SKILL.md` | 263 | 14368 | Shipped T-189 substantive; same argument as above. |
| `reference/export-formats/SKILL.md` | 324 | 15041 | Cross-format reference table; natural long-form. |

## Not touched (29 files green)

All other files pass all four non-negotiables at audit. No edits needed.

## Verification

- `pnpm check-skill-drift` green after edits.
- `pnpm skills-sync:check` green.
- `pnpm gen:tool-skills:check` green.

---

*Review produced as the T-221 deliverable; commit that follows applies the Must-fix + Should-fix + Nice-to-fix edits.*
