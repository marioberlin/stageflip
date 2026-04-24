// packages/agent/src/executor/executor.test.ts

import {
  BundleRegistry,
  type ToolHandler,
  ToolRouter,
  createCanonicalRegistry,
} from '@stageflip/engine';
import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamEvent,
  LLMToolDefinition,
} from '@stageflip/llm-abstraction';
import { LLMError } from '@stageflip/llm-abstraction';
import type { Document } from '@stageflip/schema';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Plan } from '../planner/types.js';
import { createExecutor } from './executor.js';
import type { ExecutorContext, ExecutorEvent, JsonPatchOp } from './types.js';

// --- fixtures --------------------------------------------------------------

const doc: Document = {
  meta: {
    id: 'doc-1',
    version: 1,
    createdAt: '2026-04-24T00:00:00.000Z',
    updatedAt: '2026-04-24T00:00:00.000Z',
    locale: 'en',
    schemaVersion: 1,
  },
  content: { mode: 'slide', slides: [{ id: 's1' }] },
} as unknown as Document;

function singleStepPlan(bundles: string[] = ['read'], stepId = 's1'): Plan {
  return {
    justification: 'test',
    steps: [{ id: stepId, description: 'do the thing', bundles }],
  };
}

function response(
  content: LLMResponse['content'],
  stopReason: LLMResponse['stop_reason'],
): LLMResponse {
  return {
    id: 'msg',
    model: 'claude-opus-4-7',
    role: 'assistant',
    content,
    stop_reason: stopReason,
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

function scriptedProvider(responses: LLMResponse[]): {
  provider: LLMProvider;
  spy: ReturnType<typeof vi.fn>;
} {
  let index = 0;
  const spy = vi.fn(
    async (_req: LLMRequest, _opts?: { signal?: AbortSignal }): Promise<LLMResponse> => {
      const next = responses[index++];
      if (!next) throw new Error('scriptedProvider: ran out of responses');
      return next;
    },
  );
  const provider: LLMProvider = {
    name: 'anthropic',
    complete: spy as unknown as LLMProvider['complete'],
    stream: (() => {
      throw new Error('stream not used');
    }) as unknown as (req: LLMRequest) => AsyncIterable<LLMStreamEvent>,
  };
  return { provider, spy };
}

function declareTool(name: string, bundle = 'read'): LLMToolDefinition {
  return { name, description: `d-${name}`, input_schema: { type: 'object' } };
}

function basicHandler(
  name: string,
  opts: {
    bundle?: string;
    run?: (input: unknown, ctx: ExecutorContext) => unknown | Promise<unknown>;
  } = {},
): ToolHandler<Record<string, unknown>, unknown, ExecutorContext> {
  return {
    name,
    bundle: opts.bundle ?? 'read',
    description: `d-${name}`,
    inputSchema: z.record(z.unknown()),
    outputSchema: z.unknown(),
    handle: opts.run ?? (() => ({ ok: true })),
  };
}

async function collect(stream: AsyncIterable<ExecutorEvent>): Promise<ExecutorEvent[]> {
  const out: ExecutorEvent[] = [];
  for await (const event of stream) out.push(event);
  return out;
}

// --- tests -----------------------------------------------------------------

describe('Executor — shape', () => {
  it('emits only plan-end for an empty-steps plan', async () => {
    // planSchema rejects empty steps so we bypass with a cast — the executor
    // itself handles the degenerate case by never entering the for-loop.
    const plan = { justification: 'none', steps: [] } as unknown as Plan;
    const { provider } = scriptedProvider([]);
    const executor = createExecutor({
      provider,
      registry: createCanonicalRegistry(),
      router: new ToolRouter<ExecutorContext>(),
    });
    const events = await collect(executor.run({ plan, document: doc, model: 'claude-opus-4-7' }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'plan-end' });
  });

  it('passes step through without tool calls when model returns end_turn with no tool_use', async () => {
    const { provider } = scriptedProvider([
      response([{ type: 'text', text: 'nothing to do' }], 'end_turn'),
    ]);
    const executor = createExecutor({
      provider,
      registry: createCanonicalRegistry(),
      router: new ToolRouter<ExecutorContext>(),
    });
    const events = await collect(
      executor.run({ plan: singleStepPlan(), document: doc, model: 'claude-opus-4-7' }),
    );
    expect(events.map((e) => e.kind)).toEqual(['step-start', 'step-end', 'plan-end']);
    const end = events[1] as Extract<ExecutorEvent, { kind: 'step-end' }>;
    expect(end.status).toBe('ok');
  });
});

describe('Executor — tool-call loop', () => {
  it('emits tool-call then tool-result for a successful call, then step-end(ok) when model stops', async () => {
    const registry = new BundleRegistry();
    registry.register({ name: 'read', description: 'r', tools: [declareTool('ping')] });
    const router = new ToolRouter<ExecutorContext>();
    router.register(basicHandler('ping', { run: () => ({ pong: true }) }));

    const { provider } = scriptedProvider([
      response([{ type: 'tool_use', id: 'tu_1', name: 'ping', input: {} }], 'tool_use'),
      response([{ type: 'text', text: 'done' }], 'end_turn'),
    ]);

    const executor = createExecutor({ provider, registry, router });
    const events = await collect(
      executor.run({ plan: singleStepPlan(), document: doc, model: 'claude-opus-4-7' }),
    );

    expect(events.map((e) => e.kind)).toEqual([
      'step-start',
      'tool-call',
      'tool-result',
      'step-end',
      'plan-end',
    ]);
    const call = events[1] as Extract<ExecutorEvent, { kind: 'tool-call' }>;
    const result = events[2] as Extract<ExecutorEvent, { kind: 'tool-result' }>;
    expect(call.name).toBe('ping');
    expect(result.isError).toBe(false);
    expect(result.result).toEqual({ pong: true });
  });

  it('emits patch-applied between tool-call and tool-result when handler pushes patches', async () => {
    const registry = new BundleRegistry();
    registry.register({ name: 'read', description: 'r', tools: [declareTool('tag')] });
    const router = new ToolRouter<ExecutorContext>();
    router.register(
      basicHandler('tag', {
        run: (_input, ctx) => {
          const op: JsonPatchOp = { op: 'add', path: '/meta/title', value: 'Tagged' };
          ctx.patchSink.push(op);
          return { applied: 1 };
        },
      }),
    );

    const { provider } = scriptedProvider([
      response([{ type: 'tool_use', id: 'tu_1', name: 'tag', input: {} }], 'tool_use'),
      response([{ type: 'text', text: 'done' }], 'end_turn'),
    ]);

    const executor = createExecutor({ provider, registry, router });
    const events = await collect(
      executor.run({ plan: singleStepPlan(), document: doc, model: 'claude-opus-4-7' }),
    );

    expect(events.map((e) => e.kind)).toEqual([
      'step-start',
      'tool-call',
      'patch-applied',
      'tool-result',
      'step-end',
      'plan-end',
    ]);
    const planEnd = events.at(-1) as Extract<ExecutorEvent, { kind: 'plan-end' }>;
    expect(planEnd.finalDocument.meta.title).toBe('Tagged');
  });

  it('feeds tool errors back to the LLM as is_error tool_result, letting it retry', async () => {
    const registry = new BundleRegistry();
    registry.register({ name: 'read', description: 'r', tools: [declareTool('strict')] });
    const router = new ToolRouter<ExecutorContext>();
    router.register({
      name: 'strict',
      bundle: 'read',
      description: 'strict tool',
      inputSchema: z.object({ n: z.number() }).strict(),
      outputSchema: z.object({ ok: z.boolean() }),
      handle: ({ n }) => ({ ok: n > 0 }),
    });

    const { provider, spy } = scriptedProvider([
      response([{ type: 'tool_use', id: 'tu_1', name: 'strict', input: { bogus: 1 } }], 'tool_use'),
      response([{ type: 'tool_use', id: 'tu_2', name: 'strict', input: { n: 5 } }], 'tool_use'),
      response([{ type: 'text', text: 'done' }], 'end_turn'),
    ]);

    const executor = createExecutor({ provider, registry, router });
    const events = await collect(
      executor.run({ plan: singleStepPlan(), document: doc, model: 'claude-opus-4-7' }),
    );

    const results = events.filter(
      (e): e is Extract<ExecutorEvent, { kind: 'tool-result' }> => e.kind === 'tool-result',
    );
    expect(results).toHaveLength(2);
    expect(results[0]?.isError).toBe(true);
    expect(results[1]?.isError).toBe(false);

    // Somewhere in the LLM's message history there must be a tool_result
    // block flagged is_error:true, so the model could see the failure and
    // retry. (Note: the spy captures the messages array by reference, so
    // we scan across the final state rather than indexing by call index.)
    const lastRequest = spy.mock.calls.at(-1)?.[0] as LLMRequest;
    const errBlock = lastRequest.messages
      .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
      .find(
        (b): b is Extract<typeof b, { type: 'tool_result' }> =>
          b.type === 'tool_result' && b.is_error === true,
      );
    expect(errBlock).toBeDefined();
    expect(errBlock?.tool_use_id).toBe('tu_1');
  });
});

describe('Executor — safety valves', () => {
  it('emits step-end(max_iterations) when the tool loop never converges', async () => {
    const registry = new BundleRegistry();
    registry.register({ name: 'read', description: 'r', tools: [declareTool('spin')] });
    const router = new ToolRouter<ExecutorContext>();
    router.register(basicHandler('spin', { run: () => ({ spun: true }) }));

    const spinForever = response(
      [{ type: 'tool_use', id: 'tu', name: 'spin', input: {} }],
      'tool_use',
    );
    // Three iterations max; provider will be asked 4 times if we don't stop.
    const { provider } = scriptedProvider([spinForever, spinForever, spinForever, spinForever]);

    const executor = createExecutor({ provider, registry, router });
    const events = await collect(
      executor.run({
        plan: singleStepPlan(),
        document: doc,
        model: 'claude-opus-4-7',
        maxIterationsPerStep: 3,
      }),
    );

    const end = events.find(
      (e): e is Extract<ExecutorEvent, { kind: 'step-end' }> => e.kind === 'step-end',
    );
    expect(end?.status).toBe('max_iterations');
  });

  it('emits step-end(bundle_limit_exceeded) when loading the step bundles would exceed the cap', async () => {
    const registry = new BundleRegistry();
    registry.register({
      name: 'big',
      description: 'too many',
      tools: Array.from({ length: 20 }, (_, i) => declareTool(`t${i}`)),
    });
    registry.register({
      name: 'also-big',
      description: 'too many',
      tools: Array.from({ length: 15 }, (_, i) => declareTool(`u${i}`)),
    });

    const { provider } = scriptedProvider([]); // should never be called
    const executor = createExecutor({
      provider,
      registry,
      router: new ToolRouter<ExecutorContext>(),
    });

    const plan: Plan = {
      justification: 'test',
      steps: [{ id: 's1', description: 'overload', bundles: ['big', 'also-big'] }],
    };
    const events = await collect(executor.run({ plan, document: doc, model: 'claude-opus-4-7' }));

    const end = events.find(
      (e): e is Extract<ExecutorEvent, { kind: 'step-end' }> => e.kind === 'step-end',
    );
    expect(end?.status).toBe('bundle_limit_exceeded');
    expect(events.map((e) => e.kind)).toEqual(['step-start', 'step-end', 'plan-end']);
  });

  it('emits step-end(aborted) when the signal fires before the LLM call', async () => {
    const { provider } = scriptedProvider([]);
    const executor = createExecutor({
      provider,
      registry: createCanonicalRegistry(),
      router: new ToolRouter<ExecutorContext>(),
    });
    const controller = new AbortController();
    controller.abort();

    const events = await collect(
      executor.run(
        { plan: singleStepPlan(), document: doc, model: 'claude-opus-4-7' },
        { signal: controller.signal },
      ),
    );
    const end = events.find(
      (e): e is Extract<ExecutorEvent, { kind: 'step-end' }> => e.kind === 'step-end',
    );
    expect(end?.status).toBe('aborted');
  });

  it('emits step-end(aborted) when the provider throws LLMError(aborted)', async () => {
    const registry = createCanonicalRegistry();
    const provider: LLMProvider = {
      name: 'anthropic',
      complete: (async () => {
        throw new LLMError('user cancelled', { kind: 'aborted', provider: 'anthropic' });
      }) as unknown as LLMProvider['complete'],
      stream: (() => {
        throw new Error('stream not used');
      }) as unknown as LLMProvider['stream'],
    };
    const executor = createExecutor({
      provider,
      registry,
      router: new ToolRouter<ExecutorContext>(),
    });

    const events = await collect(
      executor.run({ plan: singleStepPlan(), document: doc, model: 'claude-opus-4-7' }),
    );
    const end = events.find(
      (e): e is Extract<ExecutorEvent, { kind: 'step-end' }> => e.kind === 'step-end',
    );
    expect(end?.status).toBe('aborted');
  });
});

describe('Executor — multi-step plans', () => {
  it('runs steps sequentially and threads the document through', async () => {
    const registry = new BundleRegistry();
    registry.register({ name: 'read', description: 'r', tools: [declareTool('mark')] });
    const router = new ToolRouter<ExecutorContext>();
    let markCount = 0;
    router.register(
      basicHandler('mark', {
        run: (_input, ctx) => {
          markCount += 1;
          ctx.patchSink.push({
            op: 'add',
            path: '/meta/title',
            value: `marked-${markCount}`,
          });
          return { markCount };
        },
      }),
    );

    const { provider } = scriptedProvider([
      response([{ type: 'tool_use', id: 'tu1', name: 'mark', input: {} }], 'tool_use'),
      response([{ type: 'text', text: 'done step 1' }], 'end_turn'),
      response([{ type: 'tool_use', id: 'tu2', name: 'mark', input: {} }], 'tool_use'),
      response([{ type: 'text', text: 'done step 2' }], 'end_turn'),
    ]);

    const plan: Plan = {
      justification: 'two-step',
      steps: [
        { id: 's1', description: 'first', bundles: ['read'] },
        { id: 's2', description: 'second', bundles: ['read'], dependsOn: ['s1'] },
      ],
    };

    const executor = createExecutor({ provider, registry, router });
    const events = await collect(executor.run({ plan, document: doc, model: 'claude-opus-4-7' }));

    const startKinds = events
      .filter((e) => e.kind === 'step-start')
      .map((e) => (e as Extract<ExecutorEvent, { kind: 'step-start' }>).stepId);
    expect(startKinds).toEqual(['s1', 's2']);

    const planEnd = events.at(-1) as Extract<ExecutorEvent, { kind: 'plan-end' }>;
    expect(planEnd.finalDocument.meta.title).toBe('marked-2');
  });
});
