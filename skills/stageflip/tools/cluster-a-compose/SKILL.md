---
title: Tools — Cluster A Compose Bundle
id: skills/stageflip/tools/cluster-a-compose
tier: tools
status: substantive
last_updated: 2026-04-24
owner_task: T-331
related:
  - skills/stageflip/concepts/tool-bundles/SKILL.md
  - skills/stageflip/concepts/tool-router/SKILL.md
---

# Tools — Cluster A Compose Bundle

Cluster A (News & Broadcast) composer tools — preset-binding factories for breaking-news / ongoing-update / guest-intro / documentary-title-card briefs across the 8 ratified Cluster A presets (T-331).

> **This file is generated from the engine's registered tool
> definitions** (`pnpm gen:tool-skills`). Hand-edits will be
> overwritten. Tool descriptions themselves are the single source of
> truth — edit them in the handler's `ToolHandler` + matching
> `LLMToolDefinition` in `packages/engine/src/handlers/cluster-a-compose/`.

Registration: see `@stageflip/engine`'s `registerClusterAComposeBundle` (or equivalent) export.

## Tools

### `compose_breaking_news`

Pick a Cluster A (News) breaking-register preset by `severity` + `network` and emit a ratified preset id + clipKind + rationale. `severity='urgent'` × six accepted networks dispatches to the urgent register: `cnn` → cnn-breaking (breakingBanner), `fox` → fox-news-alert (breakingBanner), `msnbc` → msnbc-big-board (fullScreen), `bbc` → bbc-reith-dark (lowerThird), `ajazeera` → al-jazeera-orange (lowerThird), `aplus` → apple-tv-lt (lowerThird). `severity='developing'` / `'standard'` are rejected (`ok: false`, `reason: 'unsupported_severity'`) — Cluster A canon forbids painting non-urgent material in breaking register; route those to `compose_ongoing_update` instead. Read-only: caller mounts the clip via a separate write-tier tool.

- `headline` (`string`)
- `severity` (`string`) — enum: `urgent` / `developing` / `standard`
- `network` (`string`) — enum: `cnn` / `fox` / `msnbc` / `bbc` / `ajazeera` / `aplus`
- `timestamp` (`string`) _(optional)_

### `compose_ongoing_update`

Pick a Cluster A (News) lowerThird preset for ongoing / non-urgent coverage by `network`. `cnn` → cnn-classic (white card + red flag, flipper register), `bbc` → bbc-reith-dark (dark Reith register), `ajazeera` → al-jazeera-orange (warm orange-on-light register). Networks without an ongoing register (`fox` / `msnbc` / `aplus`) are not in the input enum — Zod parse rejects them, forcing the caller to pick a different register tool. Cluster A canon: ticker format = flipper > scroll (BBC 2019 rebrand); the lowerThird presets in this dispatch are flipper-style or static, never wipe-register.

- `network` (`string`) — enum: `cnn` / `bbc` / `ajazeera`
- `mainline` (`string`)
- `kicker` (`string`) _(optional)_
- `talent` (`string`) _(optional)_
- `timestamp` (`string`) _(optional)_

### `compose_guest_intro`

Pick a Cluster A (News) lowerThird preset for a guest / talent intro by `theme` + `network`. `theme='broadcast'`: cnn / fox / msnbc → cnn-classic (most-neutral broadcast register; fox + msnbc fall back here per Cluster A SKILL fallback rule); bbc → bbc-reith-dark; ajazeera → al-jazeera-orange. `theme='streaming'`: netflix → netflix-doc-lt; aplus → apple-tv-lt. Cross-theme combinations (broadcast network + streaming theme, or streaming network + broadcast theme) return `ok: false, reason: 'register_unavailable'` — register coupling is canonical and the caller must pick a coherent (theme, network) pair.

- `person` (`string`)
- `role` (`string`)
- `network` (`string`) — enum: `cnn` / `fox` / `msnbc` / `bbc` / `ajazeera` / `aplus` / `netflix`
- `theme` (`string`) — enum: `broadcast` / `streaming`

### `compose_documentary_title_card`

Pick a Cluster A (News) documentary-register lowerThird preset by `network`. `netflix` → netflix-doc-lt (text-only register, no chrome, bottom-left float); `appletv` → apple-tv-lt (thin-weight uppercase, wide tracking). The Zod input enum is sealed at exactly two networks; out-of-range values are rejected by parse. Returns `clipKind: 'lowerThird'` for both branches.

- `title` (`string`)
- `network` (`string`) — enum: `netflix` / `appletv`
- `subtitle` (`string`) _(optional)_


## Invariants

- Every handler declares `bundle: 'cluster-a-compose'`.
- Tool count 4 (I-9 cap is 30).
- Tool names + descriptions above mirror what the LLM sees at plan +
  execution time, produced by the router's `LLMToolDefinition[]`.

## Related

- `concepts/tool-bundles/SKILL.md` — bundle catalog + loading policy.
- `concepts/tool-router/SKILL.md` — Zod-validated dispatch.
- Task: T-331
