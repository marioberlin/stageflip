// packages/engine/src/handlers/domain-finance-sales-okr/handlers.ts
// `domain-finance-sales-okr` bundle — 27 composite tools split across
// finance / sales / OKR sub-modules. Each tool inserts a fully-formed
// slide (title + themed elements) via a single `add /content/slides/-`
// JSON-Patch op.
//
// Sub-modules:
//   - ./finance.ts — 9 tools: KPI strips, revenue / expense / cashflow
//     charts, runway + ARR/MRR + margin callouts, funding timeline,
//     balance-sheet summary.
//   - ./sales.ts — 9 tools: pipeline funnel, quota attainment, win/loss,
//     pipeline coverage callout, top opps, rep leaderboard, sales-cycle
//     timeline, territory summary, close-rate callout.
//   - ./okr.ts — 9 tools: objective + key-result slide, quarterly
//     summary, objective hero, check-in, retro, quarterly roadmap,
//     scorecard, divider, grading rubric.
//
// Every handler uses the shared builders in `./builders.ts` (metric
// cards, progress bars, charts, hero numbers) so element layouts stay
// consistent across the bundle. Slide ids are auto-generated via
// `nextSlideId` from create-mutate, keeping this bundle's output
// compatible with chained downstream edits.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import { FINANCE_HANDLERS, FINANCE_TOOL_DEFINITIONS } from './finance.js';
import { OKR_HANDLERS, OKR_TOOL_DEFINITIONS } from './okr.js';
import { SALES_HANDLERS, SALES_TOOL_DEFINITIONS } from './sales.js';

export const DOMAIN_BUNDLE_NAME = 'domain-finance-sales-okr';

export const DOMAIN_HANDLERS: ReadonlyArray<ToolHandler<unknown, unknown, MutationContext>> = [
  ...FINANCE_HANDLERS,
  ...SALES_HANDLERS,
  ...OKR_HANDLERS,
];

export const DOMAIN_TOOL_DEFINITIONS: ReadonlyArray<LLMToolDefinition> = [
  ...FINANCE_TOOL_DEFINITIONS,
  ...SALES_TOOL_DEFINITIONS,
  ...OKR_TOOL_DEFINITIONS,
];
