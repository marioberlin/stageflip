// packages/schema/src/elements/reaction-stream.test.ts
// T-470 — Schema-side roundtrip + reject-malformed tests for the
// `ReactionStreamClipElement` RIRElement variant. Tenth audience-clip
// variant on the `Element` discriminated union; SECOND marquee
// differentiator (emoji particle storm via the T-383 ShaderClip).

import { describe, expect, it } from 'vitest';

import {
  type ReactionStreamClipElement,
  reactionStreamClipElementSchema,
} from './reaction-stream.js';

const BASE = {
  id: 'el_rs_001',
  transform: { x: 0, y: 0, width: 800, height: 600 },
} as const;

const VALID: ReactionStreamClipElement = {
  ...BASE,
  visible: true,
  locked: false,
  animations: [],
  type: 'reaction-stream',
  permissions: ['audience-network'],
  props: {
    prompt: 'React to the talk',
    palette: [
      { emojiId: 'heart', glyph: '❤️' },
      { emojiId: 'thumbs-up', glyph: '👍' },
      { emojiId: 'fire', glyph: '🔥' },
    ],
  },
};

describe('reactionStreamClipElementSchema (T-470)', () => {
  it('parses a minimal valid element with a single palette entry', () => {
    const parsed = reactionStreamClipElementSchema.parse({
      ...BASE,
      visible: true,
      locked: false,
      animations: [],
      type: 'reaction-stream',
      permissions: ['audience-network'],
      props: {
        prompt: 'React',
        palette: [{ emojiId: 'heart', glyph: '❤️' }],
      },
    });
    expect(parsed.type).toBe('reaction-stream');
    expect(parsed.props.palette).toHaveLength(1);
    expect(parsed.permissions).toEqual(['audience-network']);
  });

  it('parses a fully-specified element', () => {
    const parsed = reactionStreamClipElementSchema.parse(VALID);
    expect(parsed.props.prompt).toBe('React to the talk');
    expect(parsed.props.palette).toHaveLength(3);
    expect(parsed.props.palette[0]?.emojiId).toBe('heart');
    expect(parsed.props.palette[0]?.glyph).toBe('❤️');
  });

  it('accepts the maximum palette size (12 entries)', () => {
    const palette = Array.from({ length: 12 }, (_, i) => ({
      emojiId: `emoji-${i}`,
      glyph: '😀',
    }));
    const parsed = reactionStreamClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, palette },
    });
    expect(parsed.props.palette).toHaveLength(12);
  });

  it('accepts an optional sessionId on props', () => {
    const parsed = reactionStreamClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, sessionId: 'sess-abc' },
    });
    expect(parsed.props.sessionId).toBe('sess-abc');
  });

  it('round-trips byte-equal', () => {
    const once = reactionStreamClipElementSchema.parse(VALID);
    const twice = reactionStreamClipElementSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('accepts optional provenance', () => {
    const parsed = reactionStreamClipElementSchema.parse({
      ...VALID,
      provenance: {
        provider: 'audience-native',
        sessionId: 'sess-1',
        snapshotFrame: 0,
        voterCountAtCapture: 12,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'reaction-stream',
        aggregation: {
          kind: 'reaction-stream',
          emojiCounts: [{ emojiId: 'heart', count: 5, recentBurst: 2 }],
          totalReactions: 5,
        },
      },
    });
    expect(parsed.provenance?.aggregation.kind).toBe('reaction-stream');
  });

  // --- malformed rejection ---

  it('rejects empty prompt', () => {
    expect(() =>
      reactionStreamClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, prompt: '' },
      }),
    ).toThrow();
  });

  it('rejects empty palette (must have at least one entry)', () => {
    expect(() =>
      reactionStreamClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, palette: [] },
      }),
    ).toThrow();
  });

  it('rejects palette with > 12 entries (matches shader compile-time loop bound)', () => {
    const palette = Array.from({ length: 13 }, (_, i) => ({
      emojiId: `emoji-${i}`,
      glyph: '😀',
    }));
    expect(() =>
      reactionStreamClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, palette },
      }),
    ).toThrow();
  });

  it('rejects a palette entry with empty emojiId', () => {
    expect(() =>
      reactionStreamClipElementSchema.parse({
        ...VALID,
        props: {
          ...VALID.props,
          palette: [{ emojiId: '', glyph: '❤️' }],
        },
      }),
    ).toThrow();
  });

  it('rejects a palette entry with empty glyph', () => {
    expect(() =>
      reactionStreamClipElementSchema.parse({
        ...VALID,
        props: {
          ...VALID.props,
          palette: [{ emojiId: 'heart', glyph: '' }],
        },
      }),
    ).toThrow();
  });

  it('rejects empty sessionId', () => {
    expect(() =>
      reactionStreamClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, sessionId: '' },
      }),
    ).toThrow();
  });

  it('rejects a wrong permissions tuple', () => {
    expect(() =>
      reactionStreamClipElementSchema.parse({
        ...VALID,
        permissions: ['network'] as unknown as ReactionStreamClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects extra permissions entries', () => {
    expect(() =>
      reactionStreamClipElementSchema.parse({
        ...VALID,
        permissions: [
          'audience-network',
          'mic',
        ] as unknown as ReactionStreamClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects unknown top-level discriminator', () => {
    expect(() =>
      reactionStreamClipElementSchema.parse({
        ...VALID,
        type: 'heatmap' as 'reaction-stream',
      }),
    ).toThrow();
  });

  it('rejects unknown extra fields (strict)', () => {
    expect(() =>
      reactionStreamClipElementSchema.parse({
        ...VALID,
        unknownField: 'oops',
      } as unknown as ReactionStreamClipElement),
    ).toThrow();
  });

  it('rejects unknown extra fields on props (strict)', () => {
    expect(() =>
      reactionStreamClipElementSchema.parse({
        ...VALID,
        props: {
          ...VALID.props,
          unknownField: 'x',
        } as unknown as ReactionStreamClipElement['props'],
      }),
    ).toThrow();
  });

  it('rejects unknown extra fields on a palette entry (strict)', () => {
    expect(() =>
      reactionStreamClipElementSchema.parse({
        ...VALID,
        props: {
          ...VALID.props,
          palette: [
            { emojiId: 'heart', glyph: '❤️', extra: 1 } as unknown as {
              emojiId: string;
              glyph: string;
            },
          ],
        },
      }),
    ).toThrow();
  });
});
