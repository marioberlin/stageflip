// packages/agent/src/planner/prompt.ts
// System + user prompt construction for the Planner. The Planner is the
// only agent that reasons about _which_ tools (via bundles) to load — it
// never calls tools directly. Its sole output is a call to the `emit_plan`
// tool whose input_schema mirrors the Plan Zod shape.

import type { LLMMessage, LLMToolDefinition } from '@stageflip/llm-abstraction';
import type { Document } from '@stageflip/schema';
import type { BundleSummary } from './types.js';

export const EMIT_PLAN_TOOL_NAME = 'emit_plan';

/**
 * Tool schema that mirrors Plan. Defined inline (not imported from
 * `types.ts`) because Zod → JSONSchema conversion would add a runtime dep
 * for a tiny tool shape. Keep in sync with `planSchema`.
 */
export const EMIT_PLAN_TOOL: LLMToolDefinition = {
  name: EMIT_PLAN_TOOL_NAME,
  description:
    'Emit the final ordered plan. You MUST call this tool exactly once with the complete plan; do not return natural-language text.',
  input_schema: {
    type: 'object',
    required: ['steps', 'justification'],
    additionalProperties: false,
    properties: {
      justification: {
        type: 'string',
        description:
          'One or two sentences explaining how these steps collectively satisfy the prompt.',
      },
      steps: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['id', 'description', 'bundles'],
          additionalProperties: false,
          properties: {
            id: {
              type: 'string',
              description:
                'Stable short id for this step (e.g. "s1"). Referenced by later steps in `dependsOn`.',
            },
            description: {
              type: 'string',
              description:
                'One line; agent-readable, imperative (e.g. "Apply brand theme to all slides").',
            },
            bundles: {
              type: 'array',
              minItems: 1,
              items: { type: 'string' },
              description:
                'Bundle names the Executor will need for this step. Must be a subset of the bundles listed in the system prompt.',
            },
            rationale: {
              type: 'string',
              description: 'Optional reason the bundles were chosen; helps traceability in logs.',
            },
            dependsOn: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional ids of prior steps that must finish first.',
            },
          },
        },
      },
    },
  },
};

export function buildSystemPrompt(bundles: BundleSummary[]): string {
  const catalog = bundles
    .map((b) => `- ${b.name} (${b.toolCount} tools) — ${b.description}`)
    .join('\n');

  return [
    'You are the StageFlip Planner.',
    '',
    'You convert a user intent + current document into an ordered list of steps that the Executor will carry out. Your ONLY valid response is a call to the `emit_plan` tool. Do not return natural-language text outside that tool call.',
    '',
    'Constraints:',
    '- Each step names one or more tool bundles (not individual tools). You do not pick tools; the Executor does that inside each bundle.',
    '- Prefer the smallest set of bundles per step. The Executor enforces a ≤30-tool limit on the in-context tool set per step, so overloading a step with many bundles is wasteful.',
    '- Order steps so that validation + export come last. Read-only inspection comes first when the document is non-empty.',
    "- Use `dependsOn` to mark explicit ordering when steps must be sequential; independent steps may run in parallel at the Executor's discretion.",
    '',
    'Bundle catalog (name — description):',
    catalog,
  ].join('\n');
}

export function buildUserMessages(prompt: string, document: Document | undefined): LLMMessage[] {
  const documentSummary = document
    ? summariseDocument(document)
    : '(no current document — treat this as a new deck)';

  return [
    {
      role: 'user',
      content: [
        { type: 'text', text: `User prompt:\n${prompt}` },
        { type: 'text', text: `Document state:\n${documentSummary}` },
      ],
    },
  ];
}

function summariseDocument(document: Document): string {
  const { content, meta } = document;
  const lines: string[] = [`id: ${meta.id}`, `mode: ${content.mode}`];
  switch (content.mode) {
    case 'slide':
      lines.push(`slides: ${content.slides.length}`);
      break;
    case 'video':
      lines.push(`tracks: ${content.tracks.length}`, `durationMs: ${content.durationMs}`);
      break;
    case 'display':
      lines.push(`sizes: ${content.sizes.length}`, `elements: ${content.elements.length}`);
      break;
  }
  if (meta.title) lines.push(`title: ${meta.title}`);
  return lines.join('\n');
}
