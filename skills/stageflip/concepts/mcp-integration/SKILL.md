---
title: MCP Integration
id: skills/stageflip/concepts/mcp-integration
tier: concept
status: substantive
last_updated: 2026-04-20
owner_task: T-222
related:
  - skills/stageflip/concepts/auth/SKILL.md
  - skills/stageflip/concepts/tool-bundles/SKILL.md
---

# MCP Integration

StageFlip ships a Model Context Protocol server (`@stageflip/mcp-server`) and
a Claude plugin (`@stageflip/plugin`) that together give any MCP-aware agent
full access to the semantic tool surface.

## Surface

`@stageflip/mcp-server` exposes:

- **Tools** — every semantic tool registered in the engine, filtered by the
  caller's permitted bundles. The tool-router's Zod schemas become MCP tool
  schemas directly.
- **Resources** — document state, asset registry, recent exports.
- **Prompts** — canned agent prompts (plan, validate, bounce-aspects).

## Bundle gating

MCP callers authenticate via the MCP auth flow (T-223). The resolved
principal's role determines which bundles are loadable. Invariant I-9 still
applies per-session: a single MCP session may not have more than 30 tools
loaded at once. The server enforces this client-agnostically.

## Plugin packaging

`@stageflip/plugin` (T-224) contains:

- The entire `skills/stageflip/` tree as content
- A reference to the MCP server URL (runtime-configured)
- An OAuth registration that kicks off the auth flow on first use

Install: `claude plugin install stageflip`. The plugin registers itself with
Claude, prompts for OAuth on first use, and stores the JWT in the OS
keychain.

## Auto-generated inputs

Tool schemas, CLI reference, and the skills tree are *all* auto-generated:

| Source of truth | Generator | Output |
|---|---|---|
| Engine tool registry | `@stageflip/skills-sync` | `skills/stageflip/tools/*/SKILL.md` |
| CLI command registry | same | `reference/cli/SKILL.md` |
| Schema Zod types | same | `reference/schema/SKILL.md` |
| Clip registry | same | `clips/catalog/SKILL.md` |
| Pre-render linter rules | same | `reference/validation-rules/SKILL.md` |

`check-skill-drift` (T-014) runs each generator and diffs against the checked-in
skill file. Drift = CI failure.

## Related

- Auth: `concepts/auth/SKILL.md`
- Tool bundles: `concepts/tool-bundles/SKILL.md`
- Tasks: T-222 (server), T-223 (auth), T-224 (plugin)
