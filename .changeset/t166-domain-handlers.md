---
'@stageflip/engine': minor
---

T-166 — Twelfth handler bundle shipped: `domain-finance-sales-okr` (27
tools). Largest bundle in the suite — hits the 27-tool ceiling (I-9 cap
is 30). Split into three sub-modules of 9 tools each:

- **Finance (9)**: KPI strip, revenue chart, expense breakdown,
  cashflow, runway callout, ARR/MRR snapshot, funding timeline,
  balance-sheet summary, margin callout.
- **Sales (9)**: pipeline funnel, quota attainment, win/loss,
  pipeline coverage, top opportunities, rep leaderboard, sales cycle,
  territory summary, close-rate callout.
- **OKR (9)**: OKR slide, quarterly summary, objective hero, weekly
  check-in, retro, quarterly roadmap, scorecard, divider, grading
  rubric. Status colors: `#22c55e` / `#f59e0b` / `#ef4444`.

Each tool inserts one fully-formed slide via a single
`add /content/slides/-` JSON-Patch op. Shared element builders
(`builders.ts`) emit metric cards, progress bars, charts, hero numbers,
and horizontal strip layouts at the 1920×1080 reference canvas. Slide
ids use `nextSlideId` from create-mutate/ids.ts so composites chain
cleanly with downstream edits.

Internal sub-module split (finance.ts / sales.ts / okr.ts) keeps each
file under ~700 LOC for reviewability; the public surface is
`DOMAIN_HANDLERS` / `DOMAIN_TOOL_DEFINITIONS` / `registerDomainBundle`.

35 new engine tests (27 handler happy-paths + 7 register + 1 loop
mode-guard across all 27); 317 total engine tests. All 9 gates green.
Skill `tools/domain-finance-sales-okr/SKILL.md` flipped from
placeholder to substantive.
