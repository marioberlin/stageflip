// packages/agent/src/validator/qualitative.ts
// LLM-backed qualitative checks. Each check is one provider.complete()
// call with a single `emit_qualitative_verdict` tool; the model must
// invoke the tool exactly once. Verdicts are strings (not booleans) so
// the LLM can qualify its answer with nuance — "looks fine, but the KPI
// callout is terser than the rest of the deck" reads better than a flat
// fail.

import type {
  LLMContentBlock,
  LLMProvider,
  LLMRequest,
  LLMToolDefinition,
} from '@stageflip/llm-abstraction';
import type { Document } from '@stageflip/schema';
import { z } from 'zod';
import {
  type QualitativeCheckName,
  type QualitativeCheckResult,
  qualitativeCheckResultSchema,
} from './types.js';

export const EMIT_QUALITATIVE_VERDICT_TOOL_NAME = 'emit_qualitative_verdict';

export const EMIT_QUALITATIVE_VERDICT_TOOL: LLMToolDefinition = {
  name: EMIT_QUALITATIVE_VERDICT_TOOL_NAME,
  description:
    'Emit the single verdict for this qualitative check. You MUST call this tool exactly once; do not return free text. Leave `suggestedFix` absent when the content already passes.',
  input_schema: {
    type: 'object',
    required: ['verdict', 'evidence'],
    additionalProperties: false,
    properties: {
      verdict: {
        type: 'string',
        minLength: 1,
        description: 'One-sentence verdict, e.g. "body copy is at grade 8 as targeted".',
      },
      evidence: {
        type: 'string',
        minLength: 1,
        description:
          'Concrete citations from the document supporting the verdict (slide id + element id + quote).',
      },
      suggestedFix: {
        type: 'string',
        minLength: 1,
        description:
          'Actionable fix when the verdict is non-trivial. Omit when no fix is required.',
      },
    },
  },
};

export const qualitativeToolInputSchema = z.object({
  verdict: z.string().min(1),
  evidence: z.string().min(1),
  suggestedFix: z.string().min(1).optional(),
});

export class QualitativeCheckError extends Error {
  readonly kind: 'no_tool_call' | 'invalid_verdict';
  readonly checkName: QualitativeCheckName;

  constructor(
    kind: QualitativeCheckError['kind'],
    checkName: QualitativeCheckName,
    message: string,
    options: { cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'QualitativeCheckError';
    this.kind = kind;
    this.checkName = checkName;
  }
}

interface QualitativeCheckSpec {
  readonly name: QualitativeCheckName;
  buildSystemPrompt(document: Document): string;
  buildUserContent(document: Document): string;
}

export const QUALITATIVE_CHECKS: Readonly<Record<QualitativeCheckName, QualitativeCheckSpec>> = {
  brand_voice: {
    name: 'brand_voice',
    buildSystemPrompt: () =>
      [
        'You are a brand-voice auditor for StageFlip documents.',
        'Read the document and decide whether its tone, diction, and claim style are consistent across slides. A single off-key slide is worth flagging.',
        'Emit your verdict via the `emit_qualitative_verdict` tool. Never return free text.',
      ].join('\n'),
    buildUserContent: documentContentForLLM,
  },
  claim_plausibility: {
    name: 'claim_plausibility',
    buildSystemPrompt: () =>
      [
        'You are a claim plausibility checker for StageFlip documents.',
        'Examine numeric claims (revenue, growth, counts, percentages) and named facts. Flag claims that are internally inconsistent, implausibly precise, or contradict another slide in the same deck.',
        'Do not fact-check against the outside world — only against the document itself. Emit your verdict via `emit_qualitative_verdict`.',
      ].join('\n'),
    buildUserContent: documentContentForLLM,
  },
  reading_level: {
    name: 'reading_level',
    buildSystemPrompt: () =>
      [
        'You are a reading-level auditor for StageFlip documents.',
        'Estimate the effective grade level of body copy (non-title text). Target: roughly grade 8. Flag copy that drifts above grade 11 without a domain-specific reason.',
        'Emit your verdict via `emit_qualitative_verdict`. Populate `suggestedFix` only if at least one piece of copy is meaningfully too complex.',
      ].join('\n'),
    buildUserContent: documentContentForLLM,
  },
};

function documentContentForLLM(document: Document): string {
  const lines: string[] = [
    `Document id: ${document.meta.id}`,
    `Mode: ${document.content.mode}`,
    `Locale: ${document.meta.locale}`,
  ];
  if (document.meta.title) lines.push(`Title: ${document.meta.title}`);

  if (document.content.mode === 'slide') {
    for (const [index, slide] of document.content.slides.entries()) {
      lines.push('', `--- Slide ${index + 1} (id: ${slide.id}) ---`);
      if (slide.title) lines.push(`Title: ${slide.title}`);
      for (const element of slide.elements) {
        const snippet = extractTextSnippet(element);
        if (snippet) lines.push(`[${element.type}#${element.id}] ${snippet}`);
      }
      if (slide.notes) lines.push(`Notes: ${slide.notes}`);
    }
  } else if (document.content.mode === 'video') {
    lines.push('', '(video-mode summary: tracks, caption text TBD)');
  } else {
    lines.push('', '(display-mode summary: banner sizes TBD)');
  }

  return lines.join('\n');
}

function extractTextSnippet(element: { type: string } & Record<string, unknown>): string {
  // Text-element runs carry the primary copy. Fall back to a shape/image
  // description if the element type has no text attached.
  const maybeRuns = (element as { runs?: Array<{ text?: string }> }).runs;
  if (Array.isArray(maybeRuns)) {
    const joined = maybeRuns
      .map((r) => r?.text ?? '')
      .join('')
      .trim();
    if (joined.length > 0) return joined.slice(0, 400);
  }
  const maybeText = (element as { text?: string }).text;
  if (typeof maybeText === 'string' && maybeText.length > 0) {
    return maybeText.slice(0, 400);
  }
  return '';
}

export interface RunQualitativeCheckOptions {
  signal?: AbortSignal;
  maxTokens: number;
  temperature: number;
}

export async function runQualitativeCheck(
  provider: LLMProvider,
  model: string,
  document: Document,
  checkName: QualitativeCheckName,
  options: RunQualitativeCheckOptions,
): Promise<QualitativeCheckResult> {
  // Qualitative checks currently only reason over slide-mode copy. Video
  // + display modes carry no consumable text surface through
  // `extractTextSnippet` today; sending a near-empty payload to the LLM
  // produces confidently-wrong "looks fine" verdicts. Skip cleanly.
  if (document.content.mode !== 'slide') {
    return {
      name: checkName,
      verdict: `skipped: mode=${document.content.mode} is not supported for qualitative checks yet`,
      evidence: 'Validator qualitative-check coverage is slide-only (T-153).',
    };
  }

  const spec = QUALITATIVE_CHECKS[checkName];
  const request: LLMRequest = {
    model,
    max_tokens: options.maxTokens,
    temperature: options.temperature,
    system: spec.buildSystemPrompt(document),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Document to audit:\n\n${spec.buildUserContent(document)}`,
          },
        ],
      },
    ],
    tools: [EMIT_QUALITATIVE_VERDICT_TOOL],
  };

  const response = await provider.complete(
    request,
    options.signal ? { signal: options.signal } : {},
  );

  const toolUse = response.content.find(
    (block): block is Extract<LLMContentBlock, { type: 'tool_use' }> =>
      block.type === 'tool_use' && block.name === EMIT_QUALITATIVE_VERDICT_TOOL_NAME,
  );
  if (!toolUse) {
    throw new QualitativeCheckError(
      'no_tool_call',
      checkName,
      `Qualitative check ${checkName} did not emit ${EMIT_QUALITATIVE_VERDICT_TOOL_NAME}; stop_reason=${response.stop_reason}`,
    );
  }

  const parsed = qualitativeToolInputSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new QualitativeCheckError(
      'invalid_verdict',
      checkName,
      `Qualitative check ${checkName} emitted an invalid verdict: ${parsed.error.message}`,
      { cause: parsed.error },
    );
  }

  const result: QualitativeCheckResult = {
    name: checkName,
    verdict: parsed.data.verdict,
    evidence: parsed.data.evidence,
    ...(parsed.data.suggestedFix !== undefined ? { suggestedFix: parsed.data.suggestedFix } : {}),
  };
  return qualitativeCheckResultSchema.parse(result);
}
