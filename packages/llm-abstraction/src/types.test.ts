// packages/llm-abstraction/src/types.test.ts
// collectStream reassembly — covers text, tool-use, usage, stop_reason,
// interleaved deltas, and the default/empty-tool-input edge cases.

import { describe, expect, it } from 'vitest';
import { type LLMStreamEvent, collectStream } from './types.js';

async function* toAsync<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item;
}

describe('collectStream', () => {
  it('reassembles a text-only assistant message', async () => {
    const events: LLMStreamEvent[] = [
      { type: 'message_start', id: 'msg_1', model: 'claude-opus-4-7' },
      { type: 'content_block_start', index: 0, block: { type: 'text' } },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Hello ' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'world' },
      },
      { type: 'content_block_stop', index: 0 },
      {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn' },
        usage: { output_tokens: 2 },
      },
      { type: 'message_stop' },
    ];

    const response = await collectStream(toAsync(events));

    expect(response).toEqual({
      id: 'msg_1',
      model: 'claude-opus-4-7',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello world' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 0, output_tokens: 2 },
    });
  });

  it('reassembles a tool_use block from input_json_delta fragments', async () => {
    const events: LLMStreamEvent[] = [
      { type: 'message_start', id: 'msg_2', model: 'claude-opus-4-7' },
      {
        type: 'content_block_start',
        index: 0,
        block: { type: 'tool_use', id: 'toolu_1', name: 'create_slide' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '{"title":"' },
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: 'Intro"}' },
      },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'tool_use' } },
      { type: 'message_stop' },
    ];

    const response = await collectStream(toAsync(events));

    expect(response.stop_reason).toBe('tool_use');
    expect(response.content).toEqual([
      {
        type: 'tool_use',
        id: 'toolu_1',
        name: 'create_slide',
        input: { title: 'Intro' },
      },
    ]);
  });

  it('handles interleaved text and tool_use blocks', async () => {
    const events: LLMStreamEvent[] = [
      { type: 'message_start', id: 'msg_3', model: 'claude-opus-4-7' },
      { type: 'content_block_start', index: 0, block: { type: 'text' } },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Adding a slide.' },
      },
      { type: 'content_block_stop', index: 0 },
      {
        type: 'content_block_start',
        index: 1,
        block: { type: 'tool_use', id: 'toolu_2', name: 'add_slide' },
      },
      {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '{}' },
      },
      { type: 'content_block_stop', index: 1 },
      { type: 'message_delta', delta: { stop_reason: 'tool_use' } },
      { type: 'message_stop' },
    ];

    const response = await collectStream(toAsync(events));

    expect(response.content).toEqual([
      { type: 'text', text: 'Adding a slide.' },
      { type: 'tool_use', id: 'toolu_2', name: 'add_slide', input: {} },
    ]);
  });

  it('defaults stop_reason to end_turn when none is provided', async () => {
    const events: LLMStreamEvent[] = [
      { type: 'message_start', id: 'msg_4', model: 'claude-opus-4-7' },
      { type: 'message_stop' },
    ];

    const response = await collectStream(toAsync(events));
    expect(response.stop_reason).toBe('end_turn');
    expect(response.content).toEqual([]);
  });

  it('ignores deltas for unknown block indices without throwing', async () => {
    const events: LLMStreamEvent[] = [
      { type: 'message_start', id: 'msg_5', model: 'claude-opus-4-7' },
      {
        type: 'content_block_delta',
        index: 99,
        delta: { type: 'text_delta', text: 'orphan' },
      },
      { type: 'message_stop' },
    ];

    const response = await collectStream(toAsync(events));
    expect(response.content).toEqual([]);
  });
});
