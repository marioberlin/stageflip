---
title: Runtimes — Index
id: skills/stageflip/runtimes
tier: runtime
status: auto-generated
last_updated: 2026-04-24
owner_task: T-220
related:
  - skills/stageflip/runtimes/contract
  - skills/stageflip/clips/catalog
---

# Runtimes — Index

**Auto-generated from `@stageflip/runtimes-contract`'s runtime
registry.** Do NOT edit by hand — run `pnpm skills-sync` after
adding or removing a runtime; `pnpm skills-sync:check` fails in
CI if the committed file drifts.

6 runtimes (6 live, 0 bake); 52 clips in total.

A `ClipRuntime` owns a set of clip kinds and renders them. The
dispatcher resolves any clip via `findClip(kind)` — the first
runtime that registered the kind wins. See
`runtimes/contract/SKILL.md` for the interface.

## Tiers

### Live-tier

| Runtime | Tier | Clips |
|---|---|---|
| [`css`](./css/SKILL.md) | live | 2 |
| [`gsap`](./gsap/SKILL.md) | live | 1 |
| [`lottie`](./lottie/SKILL.md) | live | 2 |
| [`shader`](./shader/SKILL.md) | live | 4 |
| [`three`](./three/SKILL.md) | live | 1 |
| [`frame-runtime`](./frame-runtime/SKILL.md) | live | 42 |

### Bake-tier

_No runtimes in this tier._

