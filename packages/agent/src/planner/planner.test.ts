// packages/agent/src/planner/planner.test.ts

import type {
  LLMContentBlock,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamEvent,
} from '@stageflip/llm-abstraction';
import { describe, expect, it, vi } from 'vitest';
import { listBundles } from './bundles.js';
import { PlannerError, createPlanner } from './planner.js';
import { EMIT_PLAN_TOOL_NAME } from './prompt.js';

function fakeProvider(response: Partial<LLMResponse>): {
  provider: LLMProvider;
  completeSpy: ReturnType<typeof vi.fn>;
} {
  const fullResponse: LLMResponse = {
    id: 'msg_1',
    model: 'claude-opus-4-7',
    role: 'assistant',
    content: [],
    stop_reason: 'end_turn',
    usage: { input_tokens: 0, output_tokens: 0 },
    ...response,
  };
  const completeSpy = vi.fn(async () => fullResponse);
  const provider: LLMProvider = {
    name: 'anthropic',
    complete: completeSpy as unknown as LLMProvider['complete'],
    stream: (() => {
      throw new Error('stream not used');
    }) as unknown as (req: LLMRequest) => AsyncIterable<LLMStreamEvent>,
  };
  return { provider, completeSpy };
}

function toolUseBlock(input: unknown): LLMContentBlock {
  return {
    type: 'tool_use',
    id: 'toolu_1',
    name: EMIT_PLAN_TOOL_NAME,
    input,
  };
}

describe('createPlanner', () => {
  it('returns the parsed plan when the LLM emits a valid emit_plan call', async () => {
    const { provider } = fakeProvider({
      stop_reason: 'tool_use',
      content: [
        toolUseBlock({
          justification: 'read then validate',
          steps: [
            { id: 's1', description: 'inspect', bundles: ['read'] },
            { id: 's2', description: 'validate', bundles: ['validate'], dependsOn: ['s1'] },
          ],
        }),
      ],
    });

    const planner = createPlanner({ provider });
    const plan = await planner.plan({
      prompt: 'check the deck',
      model: 'claude-opus-4-7',
    });

    expect(plan.justification).toBe('read then validate');
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0]?.bundles).toEqual(['read']);
  });

  it('passes system prompt + tools + zero-temp defaults to the provider', async () => {
    const { provider, completeSpy } = fakeProvider({
      stop_reason: 'tool_use',
      content: [
        toolUseBlock({
          justification: 'ok',
          steps: [{ id: 's1', description: 'x', bundles: ['read'] }],
        }),
      ],
    });

    const planner = createPlanner({ provider });
    await planner.plan({ prompt: 'hello', model: 'claude-opus-4-7' });

    const [req] = completeSpy.mock.calls[0] ?? [];
    expect(req).toMatchObject({
      model: 'claude-opus-4-7',
      max_tokens: 2048,
      temperature: 0,
    });
    expect((req as LLMRequest).system).toContain(EMIT_PLAN_TOOL_NAME);
    expect((req as LLMRequest).tools?.[0]?.name).toBe(EMIT_PLAN_TOOL_NAME);
  });

  it('forwards AbortSignal to the provider', async () => {
    const { provider, completeSpy } = fakeProvider({
      stop_reason: 'tool_use',
      content: [
        toolUseBlock({
          justification: 'ok',
          steps: [{ id: 's1', description: 'x', bundles: ['read'] }],
        }),
      ],
    });

    const planner = createPlanner({ provider });
    const controller = new AbortController();
    await planner.plan(
      { prompt: 'hello', model: 'claude-opus-4-7' },
      { signal: controller.signal },
    );
    expect(completeSpy.mock.calls[0]?.[1]).toEqual({ signal: controller.signal });
  });

  it('throws PlannerError(no_tool_call) when the LLM returns only text', async () => {
    const { provider } = fakeProvider({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'here is a plan...' }],
    });

    const planner = createPlanner({ provider });
    const err = await planner.plan({ prompt: 'x', model: 'claude-opus-4-7' }).catch((e) => e);

    expect(err).toBeInstanceOf(PlannerError);
    expect(err.kind).toBe('no_tool_call');
  });

  it('throws PlannerError(invalid_plan) when emit_plan input fails schema', async () => {
    const { provider } = fakeProvider({
      stop_reason: 'tool_use',
      content: [toolUseBlock({ steps: [], justification: 'bad' })],
    });

    const planner = createPlanner({ provider });
    const err = await planner.plan({ prompt: 'x', model: 'claude-opus-4-7' }).catch((e) => e);

    expect(err).toBeInstanceOf(PlannerError);
    expect(err.kind).toBe('invalid_plan');
  });

  it('throws PlannerError(unknown_bundle) when a step references an unknown bundle', async () => {
    const { provider } = fakeProvider({
      stop_reason: 'tool_use',
      content: [
        toolUseBlock({
          justification: 'ok',
          steps: [
            { id: 's1', description: 'x', bundles: ['read', 'not-a-bundle'] },
            { id: 's2', description: 'y', bundles: ['also-unknown'] },
          ],
        }),
      ],
    });

    const planner = createPlanner({ provider });
    const err = await planner.plan({ prompt: 'x', model: 'claude-opus-4-7' }).catch((e) => e);

    expect(err).toBeInstanceOf(PlannerError);
    expect(err.kind).toBe('unknown_bundle');
    expect(err.message).toContain('also-unknown');
    expect(err.message).toContain('not-a-bundle');
  });

  it('respects an explicit bundles override (e.g. a profile scoping planner context)', async () => {
    const { provider } = fakeProvider({
      stop_reason: 'tool_use',
      content: [
        toolUseBlock({
          justification: 'ok',
          steps: [{ id: 's1', description: 'x', bundles: ['read'] }],
        }),
      ],
    });

    // Override the catalog to exclude `create-mutate`; the planner should
    // accept only `read` as valid.
    const planner = createPlanner({ provider });
    await expect(
      planner.plan({
        prompt: 'x',
        model: 'claude-opus-4-7',
        bundles: [{ name: 'read', description: 'read-only', toolCount: 5 }],
      }),
    ).resolves.toMatchObject({
      steps: [expect.objectContaining({ bundles: ['read'] })],
    });

    const other = fakeProvider({
      stop_reason: 'tool_use',
      content: [
        toolUseBlock({
          justification: 'uses create',
          steps: [{ id: 's1', description: 'x', bundles: ['create-mutate'] }],
        }),
      ],
    });
    const scoped = createPlanner({ provider: other.provider });
    const rejected = await scoped
      .plan({
        prompt: 'x',
        model: 'claude-opus-4-7',
        bundles: [{ name: 'read', description: 'read-only', toolCount: 5 }],
      })
      .catch((e) => e);
    expect(rejected).toBeInstanceOf(PlannerError);
    expect(rejected.kind).toBe('unknown_bundle');
  });

  it('defaults to the full bundle catalog when bundles is omitted', async () => {
    const { provider, completeSpy } = fakeProvider({
      stop_reason: 'tool_use',
      content: [
        toolUseBlock({
          justification: 'ok',
          steps: [{ id: 's1', description: 'x', bundles: ['semantic-layout'] }],
        }),
      ],
    });

    const planner = createPlanner({ provider });
    await planner.plan({ prompt: 'x', model: 'claude-opus-4-7' });

    const [req] = completeSpy.mock.calls[0] ?? [];
    const system = (req as LLMRequest).system ?? '';
    for (const b of listBundles()) {
      expect(system).toContain(b.name);
    }
  });
});
