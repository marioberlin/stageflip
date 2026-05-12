// packages/runtimes/audience/src/clips/audience-ai-prompt/clip-definition.test.ts
// T-471 — Unit tests for `audienceAiPromptClipDefinition`. Verifies the
// kind discriminator, the propsSchema wiring, and the empty-state
// render path (which routes to the "voting" empty state).

import type { ClipRenderContext } from '@stageflip/runtimes-contract';
import type { AudienceAiPromptClipProps } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { AUDIENCE_AI_PROMPT_KIND, audienceAiPromptClipDefinition } from './clip-definition.js';

const PROPS: AudienceAiPromptClipProps = {
  prompt: 'What should we generate next?',
  targetModality: 'video-gen',
  topN: 20,
  maxPromptLength: 200,
};

const CTX: ClipRenderContext<AudienceAiPromptClipProps> = {
  frame: 0,
  fps: 30,
  width: 800,
  height: 600,
  clipFrom: 0,
  clipDurationInFrames: 90,
  props: PROPS,
};

describe('audienceAiPromptClipDefinition', () => {
  it('declares kind === "audience-ai-prompt"', () => {
    expect(audienceAiPromptClipDefinition.kind).toBe('audience-ai-prompt');
    expect(AUDIENCE_AI_PROMPT_KIND).toBe('audience-ai-prompt');
  });

  it('exposes a propsSchema that accepts a valid props value', () => {
    const schema = audienceAiPromptClipDefinition.propsSchema;
    expect(schema).toBeDefined();
    const parsed = schema?.parse(PROPS) as AudienceAiPromptClipProps | undefined;
    expect(parsed?.prompt).toBe('What should we generate next?');
    expect(parsed?.targetModality).toBe('video-gen');
  });

  it('propsSchema rejects empty prompt', () => {
    const schema = audienceAiPromptClipDefinition.propsSchema;
    expect(() => schema?.parse({ ...PROPS, prompt: '' })).toThrow();
  });

  it('propsSchema rejects unknown targetModality', () => {
    const schema = audienceAiPromptClipDefinition.propsSchema;
    expect(() =>
      schema?.parse({
        ...PROPS,
        targetModality: 'unknown' as AudienceAiPromptClipProps['targetModality'],
      }),
    ).toThrow();
  });

  it('propsSchema rejects topN > 100', () => {
    const schema = audienceAiPromptClipDefinition.propsSchema;
    expect(() => schema?.parse({ ...PROPS, topN: 101 })).toThrow();
  });

  it('render returns a React tree (the "voting" empty state for empty data)', () => {
    const out = audienceAiPromptClipDefinition.render(CTX);
    expect(out).not.toBeNull();
    if (out === null) return;
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe(
      'audience-ai-prompt',
    );
    expect((out.props as { 'data-state': string })['data-state']).toBe('voting');
  });

  it('render forwards targetModality to the data attribute', () => {
    const out = audienceAiPromptClipDefinition.render(CTX);
    if (out === null) throw new Error('expected element');
    expect((out.props as { 'data-modality': string })['data-modality']).toBe('video-gen');
  });
});
