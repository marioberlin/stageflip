// packages/agent/src/planner/types.ts
// Planner agent contracts — PlanStep, Plan per
// `concepts/agent-planner/SKILL.md`. `BundleSummary` + `BundleRegistry`
// live in `@stageflip/engine` (T-151a); this module re-exports the type
// for callers who only need the Planner surface.

import type { BundleSummary } from '@stageflip/engine';
import type { Document } from '@stageflip/schema';
import { z } from 'zod';

export type { BundleSummary };

/**
 * Zod mirror of `BundleSummary` for runtime validation of registry entries
 * supplied by callers (e.g. when a mode-specific profile hand-assembles a
 * subset). The compile-time type is the engine's interface.
 */
export const bundleSummarySchema = z.object({
  name: z.string(),
  description: z.string(),
  toolCount: z.number().int().nonnegative(),
});

export const planStepSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  bundles: z.array(z.string().min(1)).min(1),
  rationale: z.string().min(1).optional(),
  dependsOn: z.array(z.string().min(1)).optional(),
});
export type PlanStep = z.infer<typeof planStepSchema>;

export const planSchema = z.object({
  steps: z.array(planStepSchema).min(1),
  justification: z.string().min(1),
});
export type Plan = z.infer<typeof planSchema>;

export interface PlannerRequest {
  /** Natural-language intent the user gave to the editor. */
  prompt: string;
  /** Current document state; omitted for new-deck prompts. */
  document?: Document;
  /**
   * Bundles the Planner may reference. Defaults to `listBundles()` — pass
   * a filtered subset only when the caller has already narrowed scope
   * (e.g. a profile-specific mode).
   */
  bundles?: BundleSummary[];
  /** Model id. Provider-specific; caller picks. */
  model: string;
  /** Budget for the Planner turn. Defaults to 2048. */
  maxTokens?: number;
  /** Defaults to 0 — deterministic planning is the goal. */
  temperature?: number;
}

export interface PlannerCallOptions {
  signal?: AbortSignal;
}

export interface Planner {
  plan(request: PlannerRequest, options?: PlannerCallOptions): Promise<Plan>;
}
