// packages/engine/src/handlers/fact-check/handlers.ts
// `fact-check` bundle — 2 tools that bookend the LLM's fact-checking
// loop. The bundle does NOT make HTTP calls itself — engine handlers
// are pure + deterministic. The LLM is expected to call an
// agent-orchestrator-level web-search tool (planner tier), then use
// `record_fact_check_result` to write the finding into the document.
//
//   - list_factual_claims — heuristic extractor: returns candidate
//     claims from text content and slide notes. The LLM picks which
//     to verify externally.
//   - record_fact_check_result — append a structured fact-check
//     annotation to a slide's speaker notes. Since the schema has no
//     dedicated fact-check field, we encode the result as a
//     machine-parseable block inside `slide.notes`. The block format
//     is `\n\n[fact-check:<status>]\n<claim>\n<source?>\n[/fact-check]`.

import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import { z } from 'zod';
import type { MutationContext, ToolHandler } from '../../router/types.js';

export const FACT_CHECK_BUNDLE_NAME = 'fact-check';

const NOTES_MAX_LENGTH = 5000;
const FACT_CHECK_BLOCK_RE = /\[fact-check:[^\]]+]/;

// ---------------------------------------------------------------------------
// 1 — list_factual_claims
// ---------------------------------------------------------------------------

const listInput = z.object({}).strict();
const listOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      claims: z.array(
        z
          .object({
            slideId: z.string(),
            source: z.enum(['element', 'notes']),
            elementId: z.string().optional(),
            snippet: z.string(),
          })
          .strict(),
      ),
    })
    .strict(),
  z.object({ ok: z.literal(false), reason: z.enum(['wrong_mode']) }).strict(),
]);

// Heuristic claim patterns:
//  - Numeric statements with units/percentages: "40%", "$3.2B", "120 million"
//  - Years attached to proper nouns / events: "in 2023", "by 1984"
//  - "According to <source>"
const CLAIM_PATTERNS: readonly RegExp[] = [
  /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?%/,
  /\$\d+(?:\.\d+)?\s?(?:[kmbKMB]|billion|million|thousand|trillion)?\b/,
  /\b(?:in|by|since|circa)\s+(?:19|20)\d{2}\b/i,
  /\baccording to\s+[A-Z]/,
  /\b\d+(?:\.\d+)?\s+(?:people|users|customers|employees|countries)\b/i,
];

function findClaimSnippets(text: string): string[] {
  if (!text) return [];
  const snippets = new Set<string>();
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    for (const pattern of CLAIM_PATTERNS) {
      if (pattern.test(sentence)) {
        snippets.add(sentence.trim());
        break;
      }
    }
  }
  return [...snippets];
}

function collectTextFromElement(el: Record<string, unknown>): string {
  if (el.type === 'text') {
    const runs = el.runs as Array<{ text?: string }> | undefined;
    if (Array.isArray(runs) && runs.length > 0) {
      return runs.map((r) => r.text ?? '').join(' ');
    }
    return typeof el.text === 'string' ? el.text : '';
  }
  if (el.type === 'code' && typeof el.code === 'string') {
    // code blocks usually aren't factual claims; skip
    return '';
  }
  return '';
}

const listFactualClaims: ToolHandler<
  z.infer<typeof listInput>,
  z.infer<typeof listOutput>,
  MutationContext
> = {
  name: 'list_factual_claims',
  bundle: FACT_CHECK_BUNDLE_NAME,
  description:
    "Heuristic extractor: scan every text element and slide notes for sentences containing numeric claims (percentages, dollar amounts, counts), year references, or 'according to' phrasing. Returns candidates ranked by source location; the LLM picks which to verify externally via a web-search tool (provided by the orchestrator layer, not this bundle). This tool does NOT make HTTP calls.",
  inputSchema: listInput,
  outputSchema: listOutput,
  handle: (_input, ctx) => {
    if (ctx.document.content.mode !== 'slide') return { ok: false, reason: 'wrong_mode' };
    const claims: Array<{
      slideId: string;
      source: 'element' | 'notes';
      elementId?: string;
      snippet: string;
    }> = [];
    for (const slide of ctx.document.content.slides) {
      for (const raw of slide.elements) {
        const el = raw as unknown as Record<string, unknown>;
        const text = collectTextFromElement(el);
        for (const snippet of findClaimSnippets(text)) {
          claims.push({
            slideId: slide.id,
            source: 'element',
            elementId: el.id as string,
            snippet,
          });
        }
      }
      const notes = (slide as unknown as { notes?: string }).notes ?? '';
      for (const snippet of findClaimSnippets(notes)) {
        claims.push({ slideId: slide.id, source: 'notes', snippet });
      }
    }
    return { ok: true, claims };
  },
};

// ---------------------------------------------------------------------------
// 2 — record_fact_check_result
// ---------------------------------------------------------------------------

const recordInput = z
  .object({
    slideId: z.string().min(1),
    status: z.enum(['verified', 'unverified', 'disputed']),
    claim: z.string().min(1).max(500),
    source: z.string().url().optional(),
  })
  .strict();
const recordOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      slideId: z.string(),
      status: z.enum(['verified', 'unverified', 'disputed']),
      notesLength: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['wrong_mode', 'slide_not_found', 'exceeds_max_length']),
      detail: z.string().optional(),
    })
    .strict(),
]);

function formatFactCheckBlock(
  status: 'verified' | 'unverified' | 'disputed',
  claim: string,
  source?: string,
): string {
  const lines = [`[fact-check:${status}]`, claim];
  if (source) lines.push(source);
  lines.push('[/fact-check]');
  return lines.join('\n');
}

const recordFactCheckResult: ToolHandler<
  z.infer<typeof recordInput>,
  z.infer<typeof recordOutput>,
  MutationContext
> = {
  name: 'record_fact_check_result',
  bundle: FACT_CHECK_BUNDLE_NAME,
  description:
    "Append a structured fact-check annotation to a slide's speaker notes. The block format is a machine-parseable `[fact-check:<status>]\\n<claim>\\n<source?>\\n[/fact-check]` so downstream consumers (audit pipelines, export renderers) can extract findings. Status is `verified` / `unverified` / `disputed`. `source` must be a valid URL when provided. Refuses `exceeds_max_length` when the appended block would push notes over the 5000-char schema limit.",
  inputSchema: recordInput,
  outputSchema: recordOutput,
  handle: (input, ctx) => {
    if (ctx.document.content.mode !== 'slide') return { ok: false, reason: 'wrong_mode' };
    const slideIndex = ctx.document.content.slides.findIndex((s) => s.id === input.slideId);
    if (slideIndex === -1) return { ok: false, reason: 'slide_not_found' };
    const slide = ctx.document.content.slides[slideIndex];
    if (!slide) return { ok: false, reason: 'slide_not_found' };

    const existing = typeof slide.notes === 'string' ? slide.notes : '';
    const block = formatFactCheckBlock(input.status, input.claim, input.source);
    const joined = existing.length === 0 ? block : `${existing}\n\n${block}`;
    if (joined.length > NOTES_MAX_LENGTH) {
      return {
        ok: false,
        reason: 'exceeds_max_length',
        detail: `total would be ${joined.length} chars (limit ${NOTES_MAX_LENGTH})`,
      };
    }
    ctx.patchSink.push({
      op: existing.length > 0 ? 'replace' : 'add',
      path: `/content/slides/${slideIndex}/notes`,
      value: joined,
    });
    return {
      ok: true,
      slideId: input.slideId,
      status: input.status,
      notesLength: joined.length,
    };
  },
};

// Surface the block detector for downstream parsers that need to find
// existing fact-check markers inside notes.
export { FACT_CHECK_BLOCK_RE };

// ---------------------------------------------------------------------------
// Barrel
// ---------------------------------------------------------------------------

export const FACT_CHECK_HANDLERS: readonly ToolHandler<unknown, unknown, MutationContext>[] = [
  listFactualClaims,
  recordFactCheckResult,
] as unknown as readonly ToolHandler<unknown, unknown, MutationContext>[];

const nonEmptyString = { type: 'string' as const, minLength: 1 };

export const FACT_CHECK_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'list_factual_claims',
    description: listFactualClaims.description,
    input_schema: { type: 'object', additionalProperties: false },
  },
  {
    name: 'record_fact_check_result',
    description: recordFactCheckResult.description,
    input_schema: {
      type: 'object',
      required: ['slideId', 'status', 'claim'],
      additionalProperties: false,
      properties: {
        slideId: nonEmptyString,
        status: { type: 'string', enum: ['verified', 'unverified', 'disputed'] },
        claim: { type: 'string', minLength: 1, maxLength: 500 },
        source: { type: 'string', format: 'uri' },
      },
    },
  },
];
