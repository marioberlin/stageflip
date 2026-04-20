---
title: Rate Limits
id: skills/stageflip/concepts/rate-limits
tier: concept
status: substantive
last_updated: 2026-04-20
owner_task: T-263
related:
  - skills/stageflip/concepts/auth/SKILL.md
---

# Rate Limits

Three independent dimensions; the lowest remaining budget wins.

## The three dimensions

| Dimension | Unit of scope | Why |
|---|---|---|
| Per-user | authenticated user id | prevents a single user from drowning their org |
| Per-org | tenant | protects capacity across users sharing a plan |
| Per-key | API-key id | isolates runaway integrations from interactive use |

Every request consumes from all three applicable buckets. A bucket that hits
0 rejects with `429 Too Many Requests` plus `Retry-After` headers.

## Defaults (free tier, adjustable per-plan)

| Surface | Per-user / min | Per-org / min | Notes |
|---|---|---|---|
| Editor API (read) | 600 | 2000 | |
| Editor API (write) | 120 | 400 | |
| Agent runs | 30 | 120 | LLM cost dominates |
| Export (live runtimes) | 10 | 40 | CDP-bound |
| Export (bake runtimes, Blender) | 2 | 10 | GPU-bound |
| MCP tool calls | 600 | 2000 | mirrored from Editor API |

## Implementation

Hono middleware runs on every protected route. Counters live in
`@upstash/redis` (sliding window); the counter key is
`{dimension}:{id}:{surface}:{minute-bucket}`. Atomic INCR + EXPIRE on first
hit.

## Communicating limits

Every response carries:

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 1714598400     (unix seconds)
X-RateLimit-Dimension: per-user   (which bucket is lowest)
```

The MCP plugin uses `X-RateLimit-Dimension` to tell the user whether
upgrading the plan or switching keys would help.

## Agent-side cooperation

The Executor (T-152) monitors `X-RateLimit-Remaining` and slows down when it
falls below 20%. This prevents a single agent run from self-throttling mid-
execution.

## Related

- Auth: `concepts/auth/SKILL.md`
- Task: T-263
- Skill update required if a new protected surface is added
