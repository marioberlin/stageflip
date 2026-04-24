---
'@stageflip/engine': minor
---

T-165 — Eleventh handler bundle shipped: `fact-check` (2 tools).

- `list_factual_claims` — heuristic extractor; scans text elements +
  slide notes for sentences with percentages, dollar amounts, year
  references, or "according to" phrasing. Returns ranked candidates.
- `record_fact_check_result` — append a machine-parseable
  `[fact-check:<status>]...[/fact-check]` block to slide notes.
  Status: verified / unverified / disputed. Optional URL source.
  Refuses `exceeds_max_length` when appended block would push notes
  past 5000 chars.

Design: engine handlers don't make HTTP calls. The LLM is expected to
use an orchestrator-tier web-search tool, then feed the finding back
via `record_fact_check_result`. Export `FACT_CHECK_BLOCK_RE` for
downstream parsers.

10 new engine tests (7 handlers + 6 register — some combined); 279
total engine tests. All 9 gates green. Skill flipped to substantive.
