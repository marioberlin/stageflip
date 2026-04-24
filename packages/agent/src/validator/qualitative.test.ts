// packages/agent/src/validator/qualitative.test.ts

import type {
  LLMContentBlock,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamEvent,
} from '@stageflip/llm-abstraction';
import type { Document } from '@stageflip/schema';
import { describe, expect, it, vi } from 'vitest';
import {
  EMIT_QUALITATIVE_VERDICT_TOOL,
  EMIT_QUALITATIVE_VERDICT_TOOL_NAME,
  QUALITATIVE_CHECKS,
  QualitativeCheckError,
  runQualitativeCheck,
} from './qualitative.js';

function response(
  input: Record<string, unknown> | null,
  stopReason: LLMResponse['stop_reason'] = 'tool_use',
): LLMResponse {
  const content: LLMContentBlock[] = input
    ? [
        {
          type: 'tool_use',
          id: 'tu',
          name: EMIT_QUALITATIVE_VERDICT_TOOL_NAME,
          input,
        },
      ]
    : [{ type: 'text', text: 'free text instead of a tool call' }];
  return {
    id: 'msg',
    model: 'claude-opus-4-7',
    role: 'assistant',
    content,
    stop_reason: stopReason,
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

function fakeProvider(respond: (req: LLMRequest) => LLMResponse): {
  provider: LLMProvider;
  spy: ReturnType<typeof vi.fn>;
} {
  const spy = vi.fn(async (req: LLMRequest) => respond(req));
  const provider: LLMProvider = {
    name: 'anthropic',
    complete: spy as unknown as LLMProvider['complete'],
    stream: (() => {
      throw new Error('stream not used');
    }) as unknown as (req: LLMRequest) => AsyncIterable<LLMStreamEvent>,
  };
  return { provider, spy };
}

function doc(title = 'Q3 review'): Document {
  return {
    meta: {
      id: 'doc-1',
      version: 1,
      createdAt: '2026-04-24T00:00:00.000Z',
      updatedAt: '2026-04-24T00:00:00.000Z',
      schemaVersion: 1,
      locale: 'en',
      title,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    content: {
      mode: 'slide',
      slides: [
        {
          id: 's1',
          elements: [{ id: 'el-a', type: 'text', runs: [{ text: 'Hello world' }] } as never],
        },
      ],
    },
  } as Document;
}

describe('EMIT_QUALITATIVE_VERDICT_TOOL', () => {
  it('requires verdict + evidence; suggestedFix optional', () => {
    const schema = EMIT_QUALITATIVE_VERDICT_TOOL.input_schema as {
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(schema.required).toEqual(['verdict', 'evidence']);
    expect(schema.properties).toHaveProperty('suggestedFix');
  });
});

describe('QUALITATIVE_CHECKS catalog', () => {
  it('covers brand_voice / claim_plausibility / reading_level', () => {
    expect(Object.keys(QUALITATIVE_CHECKS).sort()).toEqual([
      'brand_voice',
      'claim_plausibility',
      'reading_level',
    ]);
  });

  it('every system prompt forbids free-text responses', () => {
    for (const spec of Object.values(QUALITATIVE_CHECKS)) {
      const sys = spec.buildSystemPrompt({} as Document);
      expect(sys).toContain(EMIT_QUALITATIVE_VERDICT_TOOL_NAME);
    }
  });

  it('user content lists slide ids + element text snippets for slide-mode docs', () => {
    const out = QUALITATIVE_CHECKS.brand_voice.buildUserContent(doc());
    expect(out).toContain('id: doc-1');
    expect(out).toContain('Slide 1');
    expect(out).toContain('s1');
    expect(out).toContain('Hello world');
  });
});

describe('runQualitativeCheck', () => {
  it('returns a validated QualitativeCheckResult on a well-formed verdict', async () => {
    const { provider } = fakeProvider(() =>
      response({
        verdict: 'body copy reads at grade 8',
        evidence: 'slide s1 element el-a: "Hello world"',
      }),
    );
    const result = await runQualitativeCheck(provider, 'claude-opus-4-7', doc(), 'reading_level', {
      maxTokens: 1024,
      temperature: 0,
    });
    expect(result).toEqual({
      name: 'reading_level',
      verdict: 'body copy reads at grade 8',
      evidence: 'slide s1 element el-a: "Hello world"',
    });
  });

  it('propagates suggestedFix into the result when populated', async () => {
    const { provider } = fakeProvider(() =>
      response({
        verdict: 'slide 1 body drifts to grade 12',
        evidence: 'el-a: "Hello world" (effective grade 12)',
        suggestedFix: 'Shorten sentences on el-a.',
      }),
    );
    const result = await runQualitativeCheck(provider, 'claude-opus-4-7', doc(), 'reading_level', {
      maxTokens: 1024,
      temperature: 0,
    });
    expect(result.suggestedFix).toBe('Shorten sentences on el-a.');
  });

  it('throws QualitativeCheckError(no_tool_call) when the model returns free text', async () => {
    const { provider } = fakeProvider(() => response(null, 'end_turn'));
    const err = await runQualitativeCheck(provider, 'claude-opus-4-7', doc(), 'brand_voice', {
      maxTokens: 1024,
      temperature: 0,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(QualitativeCheckError);
    expect(err.kind).toBe('no_tool_call');
    expect(err.checkName).toBe('brand_voice');
  });

  it('throws QualitativeCheckError(invalid_verdict) when tool input fails schema', async () => {
    const { provider } = fakeProvider(() => response({ verdict: '', evidence: '' }));
    const err = await runQualitativeCheck(
      provider,
      'claude-opus-4-7',
      doc(),
      'claim_plausibility',
      { maxTokens: 1024, temperature: 0 },
    ).catch((e) => e);
    expect(err).toBeInstanceOf(QualitativeCheckError);
    expect(err.kind).toBe('invalid_verdict');
  });

  it('forwards AbortSignal to the provider', async () => {
    const { provider, spy } = fakeProvider(() => response({ verdict: 'ok', evidence: 'ok' }));
    const controller = new AbortController();
    await runQualitativeCheck(provider, 'claude-opus-4-7', doc(), 'brand_voice', {
      maxTokens: 1024,
      temperature: 0,
      signal: controller.signal,
    });
    expect(spy.mock.calls[0]?.[1]).toEqual({ signal: controller.signal });
  });

  it('passes the single emit_qualitative_verdict tool + matching system prompt', async () => {
    const { provider, spy } = fakeProvider(() => response({ verdict: 'ok', evidence: 'ok' }));
    await runQualitativeCheck(provider, 'claude-opus-4-7', doc(), 'brand_voice', {
      maxTokens: 1024,
      temperature: 0,
    });
    const req = spy.mock.calls[0]?.[0] as LLMRequest;
    expect(req.tools).toHaveLength(1);
    expect(req.tools?.[0]?.name).toBe(EMIT_QUALITATIVE_VERDICT_TOOL_NAME);
    expect(req.system).toContain('brand-voice');
  });
});
