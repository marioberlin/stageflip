// packages/engine/src/bundles/types.ts
// Tool-bundle contracts per skills/stageflip/concepts/tool-bundles. Bundles
// group related tools so the Planner can reason over ~14 bundles rather
// than ~80 individual tools (I-9: ≤30 tools in any loaded context).

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';

export interface ToolBundle {
  /** Canonical bundle name, kebab-case (e.g. "create-mutate"). */
  readonly name: string;
  /** One-line description surfaced in the Planner's system prompt. */
  readonly description: string;
  /**
   * Tool definitions loaded when this bundle is selected. Empty today for
   * bundles whose handlers land in T-155+; the registry still serves as
   * the authoritative catalog so the Planner knows every bundle exists.
   */
  readonly tools: readonly LLMToolDefinition[];
}

export interface BundleSummary {
  readonly name: string;
  readonly description: string;
  readonly toolCount: number;
}

export function summarise(bundle: ToolBundle): BundleSummary {
  return {
    name: bundle.name,
    description: bundle.description,
    toolCount: bundle.tools.length,
  };
}
