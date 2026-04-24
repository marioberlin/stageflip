// packages/agent/src/planner/planner.ts
// Planner agent — turns a user prompt + current document into an ordered
// Plan of steps keyed on tool bundles. Contracts live in
// `concepts/agent-planner/SKILL.md`; invariants in `concepts/tool-bundles`
// (≤30 tools in context, enforced by the Executor at load time).

import type { LLMContentBlock, LLMProvider, LLMRequest } from '@stageflip/llm-abstraction';
import { listBundles } from './bundles.js';
import {
  EMIT_PLAN_TOOL,
  EMIT_PLAN_TOOL_NAME,
  buildSystemPrompt,
  buildUserMessages,
} from './prompt.js';
import {
  type Plan,
  type Planner,
  type PlannerCallOptions,
  type PlannerRequest,
  planSchema,
} from './types.js';

export interface CreatePlannerOptions {
  provider: LLMProvider;
}

export class PlannerError extends Error {
  readonly kind: 'no_tool_call' | 'invalid_plan' | 'unknown_bundle';

  constructor(kind: PlannerError['kind'], message: string, options: { cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'PlannerError';
    this.kind = kind;
  }
}

export function createPlanner(options: CreatePlannerOptions): Planner {
  return {
    async plan(request: PlannerRequest, callOptions?: PlannerCallOptions): Promise<Plan> {
      const bundles = request.bundles ?? listBundles();
      const bundleNames = new Set(bundles.map((b) => b.name));

      const llmRequest: LLMRequest = {
        model: request.model,
        max_tokens: request.maxTokens ?? 2048,
        temperature: request.temperature ?? 0,
        system: buildSystemPrompt(bundles),
        messages: buildUserMessages(request.prompt, request.document),
        tools: [EMIT_PLAN_TOOL],
      };

      const response = await options.provider.complete(
        llmRequest,
        callOptions?.signal ? { signal: callOptions.signal } : {},
      );

      const toolUse = response.content.find(
        (block): block is Extract<LLMContentBlock, { type: 'tool_use' }> =>
          block.type === 'tool_use' && block.name === EMIT_PLAN_TOOL_NAME,
      );
      if (!toolUse) {
        const textHint = response.content
          .filter(
            (block): block is Extract<LLMContentBlock, { type: 'text' }> => block.type === 'text',
          )
          .map((b) => b.text)
          .join('')
          .slice(0, 200);
        throw new PlannerError(
          'no_tool_call',
          `Planner did not call ${EMIT_PLAN_TOOL_NAME}; stop_reason=${response.stop_reason}${textHint.length > 0 ? `; returned text: "${textHint}"` : ''}`,
        );
      }

      const parsed = planSchema.safeParse(toolUse.input);
      if (!parsed.success) {
        throw new PlannerError(
          'invalid_plan',
          `Planner emitted an invalid plan: ${parsed.error.message}`,
          { cause: parsed.error },
        );
      }

      const unknown = new Set<string>();
      for (const step of parsed.data.steps) {
        for (const bundle of step.bundles) {
          if (!bundleNames.has(bundle)) unknown.add(bundle);
        }
      }
      if (unknown.size > 0) {
        throw new PlannerError(
          'unknown_bundle',
          `Planner referenced unknown bundle(s): ${[...unknown].sort().join(', ')}`,
        );
      }

      return parsed.data;
    },
  };
}
