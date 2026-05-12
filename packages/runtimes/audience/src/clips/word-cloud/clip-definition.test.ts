// packages/runtimes/audience/src/clips/word-cloud/clip-definition.test.ts
// T-467 — Unit tests for `wordCloudClipDefinition`. Verifies the kind
// discriminator, the propsSchema wiring, and the empty-state render
// path (which routes to the "Waiting for submissions…" placeholder).

import type { ClipRenderContext } from '@stageflip/runtimes-contract';
import type { WordCloudClipProps } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { WORD_CLOUD_KIND, wordCloudClipDefinition } from './clip-definition.js';

const PROPS: WordCloudClipProps = {
  prompt: 'Describe today in three words',
  maxWords: 100,
  maxWordsPerVoter: 3,
};

const CTX: ClipRenderContext<WordCloudClipProps> = {
  frame: 0,
  fps: 30,
  width: 800,
  height: 400,
  clipFrom: 0,
  clipDurationInFrames: 90,
  props: PROPS,
};

describe('wordCloudClipDefinition', () => {
  it('declares kind === "word-cloud"', () => {
    expect(wordCloudClipDefinition.kind).toBe('word-cloud');
    expect(WORD_CLOUD_KIND).toBe('word-cloud');
  });

  it('exposes a propsSchema that accepts a valid props value', () => {
    const schema = wordCloudClipDefinition.propsSchema;
    expect(schema).toBeDefined();
    const parsed = schema?.parse(PROPS);
    expect(parsed?.prompt).toBe('Describe today in three words');
    expect(parsed?.maxWords).toBe(100);
    expect(parsed?.maxWordsPerVoter).toBe(3);
  });

  it('propsSchema rejects empty prompt', () => {
    const schema = wordCloudClipDefinition.propsSchema;
    expect(() => schema?.parse({ prompt: '' })).toThrow();
  });

  it('propsSchema rejects maxWords > 500', () => {
    const schema = wordCloudClipDefinition.propsSchema;
    expect(() => schema?.parse({ prompt: 'p', maxWords: 501 })).toThrow();
  });

  it('propsSchema rejects maxWordsPerVoter > 20', () => {
    const schema = wordCloudClipDefinition.propsSchema;
    expect(() => schema?.parse({ prompt: 'p', maxWordsPerVoter: 21 })).toThrow();
  });

  it('propsSchema rejects maxWordsPerVoter === 0', () => {
    const schema = wordCloudClipDefinition.propsSchema;
    expect(() => schema?.parse({ prompt: 'p', maxWordsPerVoter: 0 })).toThrow();
  });

  it('render returns a React tree (the "Waiting…" placeholder for empty state)', () => {
    const out = wordCloudClipDefinition.render(CTX);
    expect(out).not.toBeNull();
    if (out === null) return;
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe(
      'word-cloud',
    );
    expect((out.props as { 'data-state': string })['data-state']).toBe('waiting');
  });
});
