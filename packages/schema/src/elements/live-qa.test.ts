// packages/schema/src/elements/live-qa.test.ts
// T-464 — Schema-side roundtrip + reject-malformed tests for the
// `LiveQAClipElement` RIRElement variant.
//
// Fourth audience-clip variant on the `Element` discriminated union.
// Mirrors T-461..T-463 test layout verbatim, swapping the discriminator
// + per-kind shape.

import { describe, expect, it } from 'vitest';

import { type LiveQAClipElement, liveQAClipElementSchema } from './live-qa.js';

const BASE = {
  id: 'el_lq_001',
  transform: { x: 0, y: 0, width: 800, height: 400 },
} as const;

const VALID: LiveQAClipElement = {
  ...BASE,
  visible: true,
  locked: false,
  animations: [],
  type: 'live-qa',
  permissions: ['audience-network'],
  props: {
    topic: 'Ask the speaker',
    allowUpvoting: true,
    moderationMode: 'open',
    maxLength: 500,
    topN: 100,
  },
};

describe('liveQAClipElementSchema (T-464)', () => {
  it('parses a minimal valid element', () => {
    const parsed = liveQAClipElementSchema.parse(VALID);
    expect(parsed.type).toBe('live-qa');
    expect(parsed.props.topic).toBe('Ask the speaker');
    expect(parsed.props.allowUpvoting).toBe(true);
    expect(parsed.props.moderationMode).toBe('open');
    expect(parsed.props.maxLength).toBe(500);
    expect(parsed.props.topN).toBe(100);
    expect(parsed.permissions).toEqual(['audience-network']);
  });

  it('applies defaults for allowUpvoting / moderationMode / maxLength / topN when omitted', () => {
    const parsed = liveQAClipElementSchema.parse({
      ...BASE,
      visible: true,
      locked: false,
      animations: [],
      type: 'live-qa',
      permissions: ['audience-network'],
      props: { topic: 'Ask away' },
    });
    expect(parsed.props.allowUpvoting).toBe(true);
    expect(parsed.props.moderationMode).toBe('open');
    expect(parsed.props.maxLength).toBe(500);
    expect(parsed.props.topN).toBe(100);
  });

  it('round-trips byte-equal', () => {
    const once = liveQAClipElementSchema.parse(VALID);
    const twice = liveQAClipElementSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('accepts moderationMode === "moderated"', () => {
    const parsed = liveQAClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, moderationMode: 'moderated' },
    });
    expect(parsed.props.moderationMode).toBe('moderated');
  });

  it('accepts allowUpvoting === false', () => {
    const parsed = liveQAClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, allowUpvoting: false },
    });
    expect(parsed.props.allowUpvoting).toBe(false);
  });

  it('accepts custom maxLength + topN within bounds', () => {
    const parsed = liveQAClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, maxLength: 1000, topN: 250 },
    });
    expect(parsed.props.maxLength).toBe(1000);
    expect(parsed.props.topN).toBe(250);
  });

  it('accepts an optional sessionId on props', () => {
    const parsed = liveQAClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, sessionId: 'sess-abc' },
    });
    expect(parsed.props.sessionId).toBe('sess-abc');
  });

  it('accepts optional provenance', () => {
    const parsed = liveQAClipElementSchema.parse({
      ...VALID,
      provenance: {
        provider: 'audience-native',
        sessionId: 'sess-1',
        snapshotFrame: 0,
        voterCountAtCapture: 3,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'live-qa',
        aggregation: {
          kind: 'live-qa',
          questions: [
            {
              id: 'q1',
              text: 'How do hooks work?',
              upvotes: 12,
              submittedAt: '2026-05-12T10:00:00Z',
              answered: true,
            },
          ],
          totalQuestions: 1,
        },
      },
    });
    expect(parsed.provenance?.aggregation.kind).toBe('live-qa');
  });

  it('rejects missing topic', () => {
    expect(() =>
      liveQAClipElementSchema.parse({
        ...VALID,
        props: {
          allowUpvoting: true,
          moderationMode: 'open',
          maxLength: 500,
          topN: 100,
        } as unknown as LiveQAClipElement['props'],
      }),
    ).toThrow();
  });

  it('rejects empty topic (min 1 char)', () => {
    expect(() =>
      liveQAClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, topic: '' },
      }),
    ).toThrow();
  });

  it('rejects unknown moderationMode', () => {
    expect(() =>
      liveQAClipElementSchema.parse({
        ...VALID,
        props: {
          ...VALID.props,
          moderationMode: 'closed' as unknown as 'open',
        },
      }),
    ).toThrow();
  });

  it('rejects maxLength above 2000', () => {
    expect(() =>
      liveQAClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, maxLength: 2001 },
      }),
    ).toThrow();
  });

  it('rejects maxLength === 0', () => {
    expect(() =>
      liveQAClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, maxLength: 0 },
      }),
    ).toThrow();
  });

  it('rejects non-integer maxLength', () => {
    expect(() =>
      liveQAClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, maxLength: 500.5 },
      }),
    ).toThrow();
  });

  it('rejects topN above 500', () => {
    expect(() =>
      liveQAClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, topN: 501 },
      }),
    ).toThrow();
  });

  it('rejects topN === 0', () => {
    expect(() =>
      liveQAClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, topN: 0 },
      }),
    ).toThrow();
  });

  it('rejects a wrong permissions tuple', () => {
    expect(() =>
      liveQAClipElementSchema.parse({
        ...VALID,
        permissions: ['network'] as unknown as LiveQAClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects extra permissions entries', () => {
    expect(() =>
      liveQAClipElementSchema.parse({
        ...VALID,
        permissions: ['audience-network', 'mic'] as unknown as LiveQAClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects unknown discriminator', () => {
    expect(() =>
      liveQAClipElementSchema.parse({
        ...VALID,
        type: 'live-poll-rating' as 'live-qa',
      }),
    ).toThrow();
  });

  it('rejects unknown extra fields (strict)', () => {
    expect(() =>
      liveQAClipElementSchema.parse({
        ...VALID,
        unknownField: 'oops',
      } as unknown as LiveQAClipElement),
    ).toThrow();
  });
});
