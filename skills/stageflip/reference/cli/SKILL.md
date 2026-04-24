---
title: Reference — CLI
id: skills/stageflip/reference/cli
tier: reference
status: auto-generated
last_updated: 2026-04-24
owner_task: T-226
related:
  - skills/stageflip/reference/schema
  - skills/stageflip/reference/validation-rules
---

# Reference — CLI

**Auto-generated from `apps/cli`'s command registry** via
`@stageflip/skills-sync`. Do NOT edit by hand — run
`pnpm skills-sync` after adding or renaming a command;
`pnpm skills-sync:check` fails in CI on drift.

35 commands registered.

## Commands

### `stageflip new`

Create a new document.

```
stageflip new <name> [flags]
```

**Arguments**

- `<name>` — Document name.

**Flags**

- `--mode` `<string>` — slide | video | display.
- `--aspect` `<string>` — Video aspect ratio (e.g. 16:9, 9:16).
- `--size` `<string>` — Display banner size, e.g. 300x250.
- `--duration` `<string>` — Duration in ms or suffixed (30s).
- `--from-prompt` `<string>` — Seed from a natural-language prompt.
- `--from-template` `<string>` — Seed from a template id.
- `--from-pptx` `<string>` — Import a PPTX file as slide mode.
- `--from-google-slides` `<string>` — Import via OAuth from a Slides URL.

### `stageflip list`

List documents accessible to you.

```
stageflip list [flags]
```

**Flags**

- `--mode` `<string>` — Filter by mode.
- `--org` `<string>` — Filter by org.

### `stageflip info`

Show doc metadata + loss flags + quality tier.

```
stageflip info <name>
```

**Arguments**

- `<name>` — Document name.

### `stageflip rename`

Rename a document.

```
stageflip rename <name> <new-name>
```

**Arguments**

- `<name>` — Current name.
- `<new-name>` — New name.

### `stageflip delete`

Soft-delete a document (recoverable 30d).

```
stageflip delete <name>
```

**Arguments**

- `<name>` — Document name.

### `stageflip preview`

Open a document in the web editor.

```
stageflip preview <name>
```

**Arguments**

- `<name>` — Document name.

### `stageflip export`

Export a document to a target format (alias: render).

```
stageflip export <name> [flags]
```

**Arguments**

- `<name>` — Document name.

**Flags**

- `--format` `<string>` — Target export format.
- `--codec` `<string>` — Codec for video formats.
- `--crf` `<number>` — Constant rate factor (video).
- `--bounce` `<string>` — Multi-aspect-ratio render (comma-separated).
- `--sizes` `<string>` — Multi-size display render (comma-separated).
- `--out` `<string>` — Output path.

### `stageflip render`

Render a document to a target format.

```
stageflip render <name> [flags]
```

**Arguments**

- `<name>` — Document name.

**Flags**

- `--format` `<string>` — Target export format.
- `--codec` `<string>` — Codec for video formats.
- `--crf` `<number>` — Constant rate factor (video).
- `--bounce` `<string>` — Multi-aspect-ratio render (comma-separated).
- `--sizes` `<string>` — Multi-size display render (comma-separated).
- `--out` `<string>` — Output path.

### `stageflip lint`

Pre-render static validation.

```
stageflip lint <name>
```

**Arguments**

- `<name>` — Document name.

### `stageflip validate`

Parity + brand + accessibility; returns tier A/B/F.

```
stageflip validate <name>
```

**Arguments**

- `<name>` — Document name.

### `stageflip loss-flags`

What won’t round-trip through target format.

```
stageflip loss-flags <name> [flags]
```

**Arguments**

- `<name>` — Document name.

**Flags**

- `--target` `<string>` — Target format.

### `stageflip theme list`

List available themes.

```
stageflip theme list
```

### `stageflip theme learn`

Run 8-step theme-learning pipeline on a source.

```
stageflip theme learn <source-path>
```

**Arguments**

- `<source-path>` — Source to learn from.

### `stageflip template save`

Save the current doc as a template.

```
stageflip template save <name> [flags]
```

**Arguments**

- `<name>` — Template name.

**Flags**

- `--public` — Make the template public.

### `stageflip template use`

Instantiate a template.

```
stageflip template use <template-id>
```

**Arguments**

- `<template-id>` — Template id.

### `stageflip bulk-render`

Render a variant per CSV row.

```
stageflip bulk-render <template-id> <csv> [flags]
```

**Arguments**

- `<template-id>` — Template id.
- `<csv>` — CSV file path.

**Flags**

- `--out-dir` `<string>` — Output directory.
- `--concurrency` `<number>` — Max parallel renders. (default: `4`)

### `stageflip variables list`

List variables bound to a document.

```
stageflip variables list <name>
```

**Arguments**

- `<name>` — Document name.

### `stageflip variables set`

Set a variable value.

```
stageflip variables set <name> <assignment>
```

**Arguments**

- `<name>` — Document name.
- `<assignment>` — key=value.

### `stageflip import`

Auto-detect import (pptx, gslides, html, lottie, afx).

```
stageflip import <file>
```

**Arguments**

- `<file>` — Path or URL.

### `stageflip export-schema`

Dump canonical document JSON to stdout.

```
stageflip export-schema <name>
```

**Arguments**

- `<name>` — Document name.

### `stageflip login`

Open OAuth flow + persist session JWT locally.

```
stageflip login [flags]
```

**Flags**

- `--org` `<string>` — Target org (optional).
- `--profile` `<string>` — Token-store profile name. (default: `default`)

### `stageflip logout`

Clear the local token store.

```
stageflip logout
```

### `stageflip whoami`

Print the logged-in principal.

```
stageflip whoami
```

### `stageflip doctor`

Environment diagnostics.

```
stageflip doctor
```

### `stageflip config get`

Read a config value.

```
stageflip config get <key>
```

**Arguments**

- `<key>` — Config key.

### `stageflip config set`

Write a config value.

```
stageflip config set <assignment>
```

**Arguments**

- `<assignment>` — key=value.

### `stageflip api-key create`

Mint a new API key.

```
stageflip api-key create [flags]
```

**Flags**

- `--scope` `<string>` — Role / scope for the key.

### `stageflip skills list`

List installed skill files.

```
stageflip skills list
```

### `stageflip skills search`

Full-text search the skill tree.

```
stageflip skills search <query>
```

**Arguments**

- `<query>` — Search term.

### `stageflip skills open`

Print a skill body.

```
stageflip skills open <name>
```

**Arguments**

- `<name>` — Skill path.

### `stageflip plugin install`

Bundle the skills tree + MCP config into a Claude plugin.

```
stageflip plugin install [destination]
```

**Arguments**

- `<destination>` _(optional)_ — Output directory (default ./stageflip-plugin).

### `stageflip parity run`

Run the parity harness locally.

```
stageflip parity run [fixture]
```

**Arguments**

- `<fixture>` _(optional)_ — Fixture name (optional).

### `stageflip parity update-expected`

Re-bake reference frames for a fixture.

```
stageflip parity update-expected <fixture>
```

**Arguments**

- `<fixture>` — Fixture name.

### `stageflip runtimes list`

List registered runtimes.

```
stageflip runtimes list
```

### `stageflip clips list`

List registered clips.

```
stageflip clips list [flags]
```

**Flags**

- `--runtime` `<string>` — Filter by runtime id.
- `--mode` `<string>` — Filter by mode.
