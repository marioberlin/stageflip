// packages/agent/src/planner/prompt.test.ts

import { describe, expect, it } from 'vitest';
import {
  EMIT_PLAN_TOOL,
  EMIT_PLAN_TOOL_NAME,
  buildSystemPrompt,
  buildUserMessages,
} from './prompt.js';
import type { BundleSummary } from './types.js';

const bundles: BundleSummary[] = [
  { name: 'read', description: 'read-only', toolCount: 5 },
  { name: 'create-mutate', description: 'add/update', toolCount: 8 },
];

describe('EMIT_PLAN_TOOL', () => {
  it('names the tool emit_plan', () => {
    expect(EMIT_PLAN_TOOL.name).toBe(EMIT_PLAN_TOOL_NAME);
  });

  it('declares steps + justification as required top-level fields', () => {
    const schema = EMIT_PLAN_TOOL.input_schema as {
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(schema.required).toEqual(['steps', 'justification']);
    expect(schema.properties).toHaveProperty('steps');
    expect(schema.properties).toHaveProperty('justification');
  });

  it('declares id/description/bundles as required on every step', () => {
    const schema = EMIT_PLAN_TOOL.input_schema as {
      properties: {
        steps: { items: { required: string[] } };
      };
    };
    expect(schema.properties.steps.items.required).toEqual(['id', 'description', 'bundles']);
  });
});

describe('buildSystemPrompt', () => {
  it('enumerates every bundle name and tool count', () => {
    const out = buildSystemPrompt(bundles);
    expect(out).toContain('read (5 tools)');
    expect(out).toContain('create-mutate (8 tools)');
  });

  it('forbids free-text responses', () => {
    const out = buildSystemPrompt(bundles);
    expect(out.toLowerCase()).toContain('emit_plan');
    expect(out.toLowerCase()).toContain('tool call');
  });

  it('mentions the ≤30-tool invariant (I-9)', () => {
    const out = buildSystemPrompt(bundles);
    expect(out).toContain('30');
  });
});

describe('buildUserMessages', () => {
  it('renders a "new deck" hint when no document is supplied', () => {
    const messages = buildUserMessages('Make me a 3-slide deck', undefined);
    expect(messages).toHaveLength(1);
    const content = messages[0]?.content;
    expect(Array.isArray(content)).toBe(true);
    const texts = (content as Array<{ type: 'text'; text: string }>).map((b) => b.text);
    expect(texts[0]).toContain('Make me a 3-slide deck');
    expect(texts[1]).toContain('no current document');
  });

  it('summarises an existing slide document', () => {
    const messages = buildUserMessages('Apply dark theme', {
      meta: { id: 'doc-1', title: 'Q3 Review' },
      content: {
        mode: 'slide',
        slides: [{ id: 's1' }, { id: 's2' }],
      },
    } as never);

    const content = messages[0]?.content;
    const summary = (content as Array<{ type: 'text'; text: string }>).at(1)?.text ?? '';
    expect(summary).toContain('id: doc-1');
    expect(summary).toContain('slides: 2');
    expect(summary).toContain('mode: slide');
    expect(summary).toContain('title: Q3 Review');
  });

  it('summarises video and display modes with mode-specific counts', () => {
    const video = buildUserMessages('make a 16:9 cut', {
      meta: { id: 'v1' },
      content: { mode: 'video', tracks: [{}, {}], durationMs: 30000 },
    } as never);
    expect(
      (video[0]?.content as Array<{ type: 'text'; text: string }>).at(1)?.text ?? '',
    ).toContain('tracks: 2');

    const display = buildUserMessages('300x250 + 728x90', {
      meta: { id: 'd1' },
      content: { mode: 'display', sizes: [{}], elements: [{}, {}, {}] },
    } as never);
    expect(
      (display[0]?.content as Array<{ type: 'text'; text: string }>).at(1)?.text ?? '',
    ).toContain('sizes: 1');
    expect(
      (display[0]?.content as Array<{ type: 'text'; text: string }>).at(1)?.text ?? '',
    ).toContain('elements: 3');
  });
});
