// apps/stageflip-slide/src/app/api/agent/execute/orchestrator.ts
// Wiring layer between the Next.js route handler and the
// Planner / Executor / Validator triad. Populates the engine's
// registry with all 14 handler bundles, constructs a shared
// ToolRouter, and exposes a single `runAgent` entrypoint the route
// calls. Kept out of the route file so unit tests can exercise the
// pipeline without mounting Next.
//
// Environment: `ANTHROPIC_API_KEY` is read lazily at request time
// (Next.js may reuse the server process across many requests). When
// unset, `runAgent` throws `OrchestratorNotConfigured`, which the
// route translates into a 503 response — distinct from the Phase-6
// 501 "not wired" sentinel the old stub used.

import {
  type Executor,
  type ExecutorEvent,
  type Plan,
  type Planner,
  type ValidationResult,
  type Validator,
  createExecutor,
  createPatchSink,
  createPlanner,
  createValidator,
} from '@stageflip/agent';
import type { ExecutorContext } from '@stageflip/agent';
import {
  type BundleRegistry,
  type DocumentSelection,
  ToolRouter,
  createCanonicalRegistry,
  registerClipAnimationBundle,
  registerCreateMutateBundle,
  registerDataSourceBindingsBundle,
  registerDomainBundle,
  registerElementCm1Bundle,
  registerFactCheckBundle,
  registerLayoutBundle,
  registerQcExportBulkBundle,
  registerReadBundle,
  registerSemanticLayoutBundle,
  registerSlideCm1Bundle,
  registerTableCm1Bundle,
  registerTimingBundle,
  registerValidateBundle,
} from '@stageflip/engine';
import { type LLMProvider, createAnthropicProvider } from '@stageflip/llm-abstraction';
import type { Document } from '@stageflip/schema';

export class OrchestratorNotConfigured extends Error {
  readonly reason: 'missing_api_key';
  constructor(reason: 'missing_api_key' = 'missing_api_key') {
    super(`orchestrator not configured: ${reason}`);
    this.name = 'OrchestratorNotConfigured';
    this.reason = reason;
  }
}

/** Default models for the triad. Overridable per request. */
const DEFAULT_PLANNER_MODEL = 'claude-sonnet-4-6';
const DEFAULT_EXECUTOR_MODEL = 'claude-sonnet-4-6';
const DEFAULT_VALIDATOR_MODEL = 'claude-sonnet-4-6';

export interface RunAgentRequest {
  prompt: string;
  document: Document;
  selection?: DocumentSelection;
  plannerModel?: string;
  executorModel?: string;
  validatorModel?: string;
  /** Injected only in tests — production path builds a real provider. */
  providerOverride?: LLMProvider;
}

export interface RunAgentResult {
  plan: Plan;
  events: ExecutorEvent[];
  finalDocument: Document;
  validation: ValidationResult;
}

export interface OrchestratorDeps {
  provider: LLMProvider;
  registry: BundleRegistry;
  router: ToolRouter<ExecutorContext>;
  planner: Planner;
  executor: Executor;
  validator: Validator;
}

function populate(registry: BundleRegistry, router: ToolRouter<ExecutorContext>): void {
  registerReadBundle(registry, router);
  registerCreateMutateBundle(registry, router);
  registerTimingBundle(registry, router);
  registerLayoutBundle(registry, router);
  registerValidateBundle(registry, router);
  registerClipAnimationBundle(registry, router);
  registerElementCm1Bundle(registry, router);
  registerSlideCm1Bundle(registry, router);
  registerTableCm1Bundle(registry, router);
  registerQcExportBulkBundle(registry, router);
  registerFactCheckBundle(registry, router);
  registerDomainBundle(registry, router);
  registerDataSourceBindingsBundle(registry, router);
  registerSemanticLayoutBundle(registry, router);
}

/**
 * Build the full dependency graph. Exported so tests can inject a fake
 * provider while the registry + router + triad factories still run
 * through their real code paths.
 */
export function createOrchestrator(provider: LLMProvider): OrchestratorDeps {
  const registry = createCanonicalRegistry();
  const router = new ToolRouter<ExecutorContext>();
  populate(registry, router);

  const planner = createPlanner({ provider, registry });
  const executor = createExecutor({ provider, registry, router });
  const validator = createValidator({ provider });
  return { provider, registry, router, planner, executor, validator };
}

/**
 * Read the Anthropic API key from env and return a live provider, or
 * throw `OrchestratorNotConfigured` when the key is absent.
 */
export function buildProviderFromEnv(): LLMProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length === 0) {
    throw new OrchestratorNotConfigured('missing_api_key');
  }
  return createAnthropicProvider({ apiKey });
}

/**
 * Orchestrate a single user prompt end-to-end:
 *   1. Planner produces a Plan.
 *   2. Executor runs each step through the tool-call loop, applying
 *      patches as it goes.
 *   3. Validator reviews the final document.
 *
 * Returns the plan, the full event log, the final patched document,
 * and the validation verdict.
 */
export async function runAgent(request: RunAgentRequest): Promise<RunAgentResult> {
  const provider = request.providerOverride ?? buildProviderFromEnv();
  const { planner, executor, validator } = createOrchestrator(provider);

  const plan = await planner.plan({
    prompt: request.prompt,
    document: request.document,
    model: request.plannerModel ?? DEFAULT_PLANNER_MODEL,
  });

  const events: ExecutorEvent[] = [];
  let finalDocument = request.document;
  for await (const event of executor.run({
    plan,
    document: request.document,
    model: request.executorModel ?? DEFAULT_EXECUTOR_MODEL,
    ...(request.selection ? { selection: request.selection } : {}),
  })) {
    events.push(event);
    if (event.kind === 'plan-end') {
      finalDocument = event.finalDocument;
    }
  }

  const validation = await validator.validate({
    document: finalDocument,
    model: request.validatorModel ?? DEFAULT_VALIDATOR_MODEL,
  });

  // Surface the patch sink import so tree-shaking doesn't drop it; tests
  // that exercise the Executor pipeline sometimes import it directly.
  void createPatchSink;

  return { plan, events, finalDocument, validation };
}
