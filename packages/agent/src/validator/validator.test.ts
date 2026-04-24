// packages/agent/src/validator/validator.test.ts

import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamEvent,
} from '@stageflip/llm-abstraction';
import type { Document } from '@stageflip/schema';
import { describe, expect, it, vi } from 'vitest';
import { EMIT_QUALITATIVE_VERDICT_TOOL_NAME } from './qualitative.js';
import type { ProgrammaticCheck } from './types.js';
import { createValidator } from './validator.js';

function validDoc(): Document {
  return {
    meta: {
      id: 'doc-1',
      version: 1,
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: '2026-04-24T00:00:00.000Z',
      schemaVersion: 1,
      locale: 'en',
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    content: { mode: 'slide', slides: [{ id: 's1', elements: [] }] },
  } as Document;
}

function scriptedProvider(responses: Array<Record<string, unknown>>): {
  provider: LLMProvider;
  spy: ReturnType<typeof vi.fn>;
} {
  let i = 0;
  const spy = vi.fn(async (_req: LLMRequest): Promise<LLMResponse> => {
    const input = responses[i++];
    if (!input) throw new Error('scriptedProvider out of responses');
    return {
      id: 'msg',
      model: 'claude-opus-4-7',
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: `tu_${i}`,
          name: EMIT_QUALITATIVE_VERDICT_TOOL_NAME,
          input,
        },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 1, output_tokens: 1 },
    };
  });
  const provider: LLMProvider = {
    name: 'anthropic',
    complete: spy as unknown as LLMProvider['complete'],
    stream: (() => {
      throw new Error('stream not used');
    }) as unknown as (req: LLMRequest) => AsyncIterable<LLMStreamEvent>,
  };
  return { provider, spy };
}

describe('createValidator', () => {
  it('returns tier=pass when programmatic checks pass and no qualitative are run', async () => {
    const { provider } = scriptedProvider([]);
    const validator = createValidator({ provider });
    const result = await validator.validate({
      document: validDoc(),
      model: 'claude-opus-4-7',
    });
    expect(result.tier).toBe('pass');
    expect(result.programmatic).toHaveLength(1);
    expect(result.programmatic[0]?.status).toBe('pass');
    expect(result.qualitative).toEqual([]);
    expect(result.required_fixes).toBeUndefined();
  });

  it('returns tier=fail when any programmatic check fails', async () => {
    const broken: ProgrammaticCheck = {
      name: 'always_fails',
      run: () => ({ name: 'always_fails', status: 'fail', detail: 'nope' }),
    };
    const { provider } = scriptedProvider([]);
    const validator = createValidator({ provider, extraProgrammaticChecks: [broken] });
    const result = await validator.validate({
      document: validDoc(),
      model: 'claude-opus-4-7',
    });
    expect(result.tier).toBe('fail');
    expect(result.programmatic.map((p) => p.name)).toEqual(['schema_round_trip', 'always_fails']);
  });

  it('runs requested qualitative checks in order and attaches their results', async () => {
    const { provider, spy } = scriptedProvider([
      { verdict: 'brand voice fine', evidence: 's1 el-a' },
      { verdict: 'claims fine', evidence: 's1 el-a' },
    ]);
    const validator = createValidator({ provider });
    const result = await validator.validate({
      document: validDoc(),
      model: 'claude-opus-4-7',
      qualitativeChecks: ['brand_voice', 'claim_plausibility'],
    });
    expect(result.tier).toBe('pass');
    expect(result.qualitative.map((q) => q.name)).toEqual(['brand_voice', 'claim_plausibility']);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('promotes tier to pass-with-notes when qualitative checks return suggestedFix', async () => {
    const { provider } = scriptedProvider([
      {
        verdict: 'grade 12 on el-a',
        evidence: 's1 el-a',
        suggestedFix: 'shorten sentences',
      },
    ]);
    const validator = createValidator({ provider });
    const result = await validator.validate({
      document: validDoc(),
      model: 'claude-opus-4-7',
      qualitativeChecks: ['reading_level'],
    });
    expect(result.tier).toBe('pass-with-notes');
    expect(result.required_fixes).toEqual(['shorten sentences']);
  });

  it('stays at tier=fail even when qualitative suggests a fix (programmatic drives tier)', async () => {
    const broken: ProgrammaticCheck = {
      name: 'always_fails',
      run: () => ({ name: 'always_fails', status: 'fail' }),
    };
    const { provider } = scriptedProvider([
      {
        verdict: 'reads fine',
        evidence: 'el-a',
        suggestedFix: 'also consider X',
      },
    ]);
    const validator = createValidator({ provider, extraProgrammaticChecks: [broken] });
    const result = await validator.validate({
      document: validDoc(),
      model: 'claude-opus-4-7',
      qualitativeChecks: ['brand_voice'],
    });
    expect(result.tier).toBe('fail');
    // required_fixes still populated from qualitative even when tier=fail
    expect(result.required_fixes).toEqual(['also consider X']);
  });

  it('stops iterating qualitative checks when signal is already aborted', async () => {
    const { provider, spy } = scriptedProvider([]);
    const validator = createValidator({ provider });
    const controller = new AbortController();
    controller.abort();
    const result = await validator.validate(
      {
        document: validDoc(),
        model: 'claude-opus-4-7',
        qualitativeChecks: ['brand_voice', 'reading_level'],
      },
      { signal: controller.signal },
    );
    expect(result.qualitative).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
    // Programmatic still ran.
    expect(result.programmatic[0]?.status).toBe('pass');
  });
});
