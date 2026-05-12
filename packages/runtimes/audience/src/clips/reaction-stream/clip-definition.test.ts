// packages/runtimes/audience/src/clips/reaction-stream/clip-definition.test.ts
// T-470 — Unit tests for `reactionStreamClipDefinition`. Verifies the
// kind discriminator, the propsSchema wiring, and the empty-state render
// path (which routes to the "Waiting for reactions…" placeholder).

import type { ClipRenderContext } from '@stageflip/runtimes-contract';
import type { ReactionStreamClipProps } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import { REACTION_STREAM_KIND, reactionStreamClipDefinition } from './clip-definition.js';

const PROPS: ReactionStreamClipProps = {
  prompt: 'React to the talk',
  palette: [
    { emojiId: 'heart', glyph: '❤️' },
    { emojiId: 'fire', glyph: '🔥' },
  ],
};

const CTX: ClipRenderContext<ReactionStreamClipProps> = {
  frame: 0,
  fps: 30,
  width: 800,
  height: 600,
  clipFrom: 0,
  clipDurationInFrames: 90,
  props: PROPS,
};

describe('reactionStreamClipDefinition', () => {
  it('declares kind === "reaction-stream"', () => {
    expect(reactionStreamClipDefinition.kind).toBe('reaction-stream');
    expect(REACTION_STREAM_KIND).toBe('reaction-stream');
  });

  it('exposes a propsSchema that accepts a valid props value', () => {
    const schema = reactionStreamClipDefinition.propsSchema;
    expect(schema).toBeDefined();
    const parsed = schema?.parse(PROPS) as ReactionStreamClipProps | undefined;
    expect(parsed?.prompt).toBe('React to the talk');
    expect(parsed?.palette).toHaveLength(2);
  });

  it('propsSchema rejects empty prompt', () => {
    const schema = reactionStreamClipDefinition.propsSchema;
    expect(() => schema?.parse({ ...PROPS, prompt: '' })).toThrow();
  });

  it('propsSchema rejects empty palette', () => {
    const schema = reactionStreamClipDefinition.propsSchema;
    expect(() => schema?.parse({ ...PROPS, palette: [] })).toThrow();
  });

  it('propsSchema rejects palette > 12 entries', () => {
    const schema = reactionStreamClipDefinition.propsSchema;
    const palette = Array.from({ length: 13 }, (_, i) => ({
      emojiId: `emoji-${i}`,
      glyph: '😀',
    }));
    expect(() => schema?.parse({ ...PROPS, palette })).toThrow();
  });

  it('render returns a React tree (the "Waiting…" placeholder for empty state)', () => {
    const out = reactionStreamClipDefinition.render(CTX);
    expect(out).not.toBeNull();
    if (out === null) return;
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe(
      'reaction-stream',
    );
    expect((out.props as { 'data-state': string })['data-state']).toBe('waiting');
  });

  it('render forwards palette size to the data attribute', () => {
    const out = reactionStreamClipDefinition.render(CTX);
    if (out === null) throw new Error('expected element');
    expect((out.props as { 'data-palette-size': number })['data-palette-size']).toBe(2);
  });
});
