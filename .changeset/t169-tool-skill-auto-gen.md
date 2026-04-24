---
'@stageflip/engine': patch
---

T-169 — `skills/stageflip/tools/*/SKILL.md` is now **generated from the
engine's registry**. All 14 per-bundle SKILL.md files are regenerated
by `scripts/gen-tool-skills.ts`, which iterates registered bundles and
emits canonical per-tool documentation from each handler's
`LLMToolDefinition` (name + description + input schema summary).

- `pnpm gen:tool-skills` — regenerate.
- `pnpm gen:tool-skills:check` — diff generated output vs committed
  files; exits non-zero on drift. Added as a CI gate alongside
  `check-skill-drift` and `skills-sync:check`.

Tool descriptions in the handler source (`packages/engine/src/handlers/`)
are now the single source of truth for agent-facing tool docs. Editing
a handler's description + regenerating keeps skills and code in sync.

Policy: hand-edits to generated `tools/*/SKILL.md` files will be
reverted on regeneration. Extended narrative content belongs in
`concepts/tool-bundles/SKILL.md` or handler-level comments.
