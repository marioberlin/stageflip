// packages/agent/src/executor/executor.ts
// Executor — turns a Plan into a stream of ExecutorEvents by running the
// tool-call loop one step at a time. Per-step: load the step's bundles,
// call the LLM with the loaded tool defs, dispatch any tool_use blocks
// through the router, apply patches the handlers push, feed results back,
// loop until the model stops calling tools or we hit max_iterations.
// Contracts: skills/stageflip/concepts/agent-executor/SKILL.md.

import {
  BundleLoadError,
  BundleLoader,
  type BundleRegistry,
  DEFAULT_TOOL_LIMIT,
  type DocumentSelection,
  type ToolRouter,
  ToolRouterError,
} from '@stageflip/engine';
import type { LLMContentBlock, LLMMessage, LLMProvider } from '@stageflip/llm-abstraction';
import { LLMError } from '@stageflip/llm-abstraction';
import type { Document } from '@stageflip/schema';
import { type Operation, applyPatch } from 'fast-json-patch';
import type { Plan, PlanStep } from '../planner/types.js';
import { createPatchSink } from './patch-sink.js';
import type { ExecutorContext, ExecutorEvent, JsonPatchOp, StepStatus } from './types.js';

export const DEFAULT_MAX_ITERATIONS_PER_STEP = 20;
export const DEFAULT_EXECUTOR_MAX_TOKENS = 4096;

export interface ExecutorRequest {
  plan: Plan;
  document: Document;
  model: string;
  maxTokens?: number;
  temperature?: number;
  maxIterationsPerStep?: number;
  /** Per-step I-9 budget. Defaults to {@link DEFAULT_TOOL_LIMIT} (30). */
  maxTools?: number;
  /**
   * Editor-side selection at run start. Threaded through to every handler
   * via `ExecutorContext.selection` — read-tier tools like
   * `describe_selection` rely on it. Omit when there is no selection.
   */
  selection?: DocumentSelection;
}

export interface ExecutorCallOptions {
  signal?: AbortSignal;
}

export interface Executor {
  run(request: ExecutorRequest, options?: ExecutorCallOptions): AsyncIterable<ExecutorEvent>;
}

export interface CreateExecutorOptions {
  provider: LLMProvider;
  registry: BundleRegistry;
  router: ToolRouter<ExecutorContext>;
  /** Override the executor's system prompt. Defaults to a minimal brief. */
  systemPrompt?: string;
}

export function createExecutor(options: CreateExecutorOptions): Executor {
  const { provider, registry, router, systemPrompt = DEFAULT_SYSTEM_PROMPT } = options;

  return {
    run(request, callOptions) {
      return runPlan({ provider, registry, router, systemPrompt }, request, callOptions);
    },
  };
}

// --- core loop -------------------------------------------------------------

async function* runPlan(
  deps: {
    provider: LLMProvider;
    registry: BundleRegistry;
    router: ToolRouter<ExecutorContext>;
    systemPrompt: string;
  },
  request: ExecutorRequest,
  callOptions: ExecutorCallOptions | undefined,
): AsyncIterable<ExecutorEvent> {
  const signal = callOptions?.signal;
  let document = request.document;

  for (const step of request.plan.steps) {
    yield { kind: 'step-start', stepId: step.id };

    const loader = new BundleLoader(deps.registry, {
      maxTools: request.maxTools ?? DEFAULT_TOOL_LIMIT,
    });

    let bundleLoadStatus: StepStatus | null = null;
    try {
      for (const bundleName of step.bundles) loader.load(bundleName);
    } catch (error) {
      if (error instanceof BundleLoadError && error.kind === 'limit_exceeded') {
        bundleLoadStatus = 'bundle_limit_exceeded';
      } else {
        // unknown_bundle / already_loaded are programmer errors — the
        // Planner validates bundle names before emitting a plan and the
        // loader is reset between steps, so these shouldn't happen. Throw
        // so the caller (typically the /api/agent/execute route) sees
        // them rather than silently reclassifying as a limit breach.
        throw error;
      }
    }
    if (bundleLoadStatus !== null) {
      yield { kind: 'step-end', stepId: step.id, status: bundleLoadStatus };
      continue;
    }

    const stepResult = yield* runStep(
      { ...deps, maxIterations: request.maxIterationsPerStep ?? DEFAULT_MAX_ITERATIONS_PER_STEP },
      step,
      loader,
      document,
      request,
      signal,
    );
    document = stepResult.document;
    yield { kind: 'step-end', stepId: step.id, status: stepResult.status };
  }

  yield { kind: 'plan-end', finalDocument: document };
}

async function* runStep(
  deps: {
    provider: LLMProvider;
    router: ToolRouter<ExecutorContext>;
    systemPrompt: string;
    maxIterations: number;
  },
  step: PlanStep,
  loader: BundleLoader,
  startDocument: Document,
  request: ExecutorRequest,
  signal: AbortSignal | undefined,
): AsyncGenerator<ExecutorEvent, { status: StepStatus; document: Document }> {
  let document = startDocument;
  const messages: LLMMessage[] = [
    { role: 'user', content: buildUserContent(step, request.plan, document) },
  ];

  const patchSink = createPatchSink();
  let iterations = 0;

  while (true) {
    if (signal?.aborted) return { status: 'aborted', document };

    let response: Awaited<ReturnType<typeof deps.provider.complete>>;
    try {
      response = await deps.provider.complete(
        {
          model: request.model,
          max_tokens: request.maxTokens ?? DEFAULT_EXECUTOR_MAX_TOKENS,
          temperature: request.temperature ?? 0,
          system: deps.systemPrompt,
          messages,
          tools: loader.toolDefinitions(),
        },
        signal ? { signal } : {},
      );
    } catch (error) {
      if (error instanceof LLMError && error.kind === 'aborted') {
        return { status: 'aborted', document };
      }
      throw error;
    }

    const toolUses = response.content.filter(
      (block): block is Extract<LLMContentBlock, { type: 'tool_use' }> => block.type === 'tool_use',
    );

    if (toolUses.length === 0) {
      return { status: 'ok', document };
    }

    const toolResultBlocks: LLMContentBlock[] = [];
    for (const toolUse of toolUses) {
      if (signal?.aborted) return { status: 'aborted', document };

      yield {
        kind: 'tool-call',
        stepId: step.id,
        name: toolUse.name,
        args: toolUse.input,
      };

      const callContext: ExecutorContext = {
        document,
        patchSink,
        stepId: step.id,
        ...(signal ? { signal } : {}),
        ...(request.selection !== undefined ? { selection: request.selection } : {}),
      };

      let result: unknown;
      let isError = false;
      try {
        result = await deps.router.call(toolUse.name, toolUse.input, callContext);
      } catch (error) {
        if (error instanceof ToolRouterError && error.kind === 'aborted') {
          return { status: 'aborted', document };
        }
        result = formatRouterError(error);
        isError = true;
      }

      const patches = patchSink.drain();
      if (patches.length > 0 && !isError) {
        try {
          document = applyPatch(document, patches as Operation[], false, false).newDocument;
        } catch (patchError) {
          // A handler pushed patches that fail to apply — treat as a handler
          // bug and feed the error back to the LLM without mutating document.
          result = {
            error: 'patch_apply_failed',
            message: patchError instanceof Error ? patchError.message : String(patchError),
          };
          isError = true;
        }
        if (!isError) {
          yield { kind: 'patch-applied', stepId: step.id, patch: patches };
        }
      }

      yield {
        kind: 'tool-result',
        stepId: step.id,
        name: toolUse.name,
        result,
        isError,
      };

      toolResultBlocks.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
        ...(isError ? { is_error: true } : {}),
      });
    }

    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResultBlocks });

    iterations += 1;
    if (iterations >= deps.maxIterations) {
      return { status: 'max_iterations', document };
    }
  }
}

// --- helpers ---------------------------------------------------------------

function buildUserContent(step: PlanStep, plan: Plan, document: Document): LLMContentBlock[] {
  const positionLines =
    plan.steps.length > 1
      ? [
          `Step ${plan.steps.indexOf(step) + 1} of ${plan.steps.length}: ${step.id}`,
          `Overall plan justification: ${plan.justification}`,
        ]
      : [`Step: ${step.id}`];

  if (step.rationale) positionLines.push(`Rationale: ${step.rationale}`);
  if (step.dependsOn !== undefined && step.dependsOn.length > 0) {
    positionLines.push(`Depends on prior steps: ${step.dependsOn.join(', ')}`);
  }

  return [
    {
      type: 'text',
      text: [
        positionLines.join('\n'),
        '',
        `Description: ${step.description}`,
        '',
        `Loaded bundles: ${step.bundles.join(', ')}`,
        '',
        `Document id: ${document.meta.id} (mode: ${document.content.mode})`,
      ].join('\n'),
    },
  ];
}

function formatRouterError(error: unknown): {
  error: string;
  kind: string;
  message: string;
  issues?: unknown;
} {
  if (error instanceof ToolRouterError) {
    return {
      error: 'tool_router_error',
      kind: error.kind,
      message: error.message,
      ...(error.issues ? { issues: error.issues } : {}),
    };
  }
  return {
    error: 'unexpected',
    kind: 'unknown',
    message: error instanceof Error ? error.message : String(error),
  };
}

// Re-export for tests that want to construct fake patches.
export type { JsonPatchOp };

const DEFAULT_SYSTEM_PROMPT = [
  'You are the StageFlip Executor.',
  '',
  'You execute ONE step of a plan by calling the loaded tools. Call tools until the step is complete, then stop. Do not emit a final free-text summary; silence signals completion.',
  '',
  'If a tool returns an error, read the kind + message + issues and try a corrected call.',
  '',
  'Stay within the loaded tool set — do not reference tools outside it.',
].join('\n');
