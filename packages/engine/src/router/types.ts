// packages/engine/src/router/types.ts
// Tool-router contracts — a ToolHandler is an LLM tool's runtime half:
// input schema (Zod), handler function, output schema (Zod). Handlers
// register with a ToolRouter (see router.ts), which dispatches by name
// with bi-directional Zod validation. Paired with LLMToolDefinition
// (in @stageflip/llm-abstraction) — the LLM-facing JSONSchema half — via
// the shared `name`.

import type { z } from 'zod';

/**
 * Opaque context passed to every handler invocation. The Executor (T-152)
 * narrows this with a per-step context (document snapshot, patch
 * accumulator, audit trail) via intersection; handlers that only need the
 * AbortSignal ignore the extra fields.
 */
export interface ToolContext {
  readonly signal?: AbortSignal;
}

export interface ToolHandler<
  TInput = unknown,
  TOutput = unknown,
  TContext extends ToolContext = ToolContext,
> {
  /** Canonical tool name; matches the LLMToolDefinition the model sees. */
  readonly name: string;
  /**
   * Bundle the tool belongs to. Skill invariant (tool-bundles §"Enforcement"):
   * every tool declares exactly one bundle.
   */
  readonly bundle: string;
  readonly description: string;
  readonly inputSchema: z.ZodType<TInput>;
  readonly outputSchema: z.ZodType<TOutput>;
  handle(input: TInput, context: TContext): Promise<TOutput> | TOutput;
}

/** Erased type used by the router's internal registry. */
export type AnyToolHandler = ToolHandler<unknown, unknown, ToolContext>;
