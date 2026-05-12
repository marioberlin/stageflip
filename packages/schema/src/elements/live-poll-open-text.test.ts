// packages/schema/src/elements/live-poll-open-text.test.ts
// T-462 — Schema-side roundtrip + reject-malformed tests for the
// `LivePollOpenTextClipElement` RIRElement variant.
//
// Second audience-clip variant on the `Element` discriminated union.
// Mirrors T-461's test layout verbatim, swapping the discriminator +
// per-kind shape.

import { describe, expect, it } from 'vitest';

import {
  type LivePollOpenTextClipElement,
  livePollOpenTextClipElementSchema,
} from './live-poll-open-text.js';

const BASE = {
  id: 'el_lp_ot_001',
  transform: { x: 0, y: 0, width: 800, height: 400 },
} as const;

const VALID: LivePollOpenTextClipElement = {
  ...BASE,
  visible: true,
  locked: false,
  animations: [],
  type: 'live-poll-open-text',
  permissions: ['audience-network'],
  props: {
    question: 'What did you think of the talk?',
    maxLength: 280,
  },
};

describe('livePollOpenTextClipElementSchema (T-462)', () => {
  it('parses a minimal valid element', () => {
    const parsed = livePollOpenTextClipElementSchema.parse(VALID);
    expect(parsed.type).toBe('live-poll-open-text');
    expect(parsed.props.question).toBe('What did you think of the talk?');
    expect(parsed.props.maxLength).toBe(280);
    expect(parsed.permissions).toEqual(['audience-network']);
  });

  it('round-trips byte-equal', () => {
    const once = livePollOpenTextClipElementSchema.parse(VALID);
    const twice = livePollOpenTextClipElementSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('applies the default maxLength of 280 when omitted', () => {
    const parsed = livePollOpenTextClipElementSchema.parse({
      ...VALID,
      props: { question: 'Q?' },
    });
    expect(parsed.props.maxLength).toBe(280);
  });

  it('accepts a custom maxLength within bounds', () => {
    const parsed = livePollOpenTextClipElementSchema.parse({
      ...VALID,
      props: { question: 'Q?', maxLength: 1000 },
    });
    expect(parsed.props.maxLength).toBe(1000);
  });

  it('accepts an optional sessionId on props', () => {
    const parsed = livePollOpenTextClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, sessionId: 'sess-abc' },
    });
    expect(parsed.props.sessionId).toBe('sess-abc');
  });

  it('accepts optional provenance', () => {
    const parsed = livePollOpenTextClipElementSchema.parse({
      ...VALID,
      provenance: {
        provider: 'audience-native',
        sessionId: 'sess-1',
        snapshotFrame: 0,
        voterCountAtCapture: 10,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'live-poll-open-text',
        aggregation: {
          kind: 'live-poll-open-text',
          entries: [
            { text: 'great talk', count: 5 },
            { text: 'more demos!', count: 3 },
          ],
          totalVotes: 8,
        },
      },
    });
    expect(parsed.provenance?.aggregation.kind).toBe('live-poll-open-text');
  });

  it('rejects missing question', () => {
    expect(() =>
      livePollOpenTextClipElementSchema.parse({
        ...VALID,
        props: { maxLength: 280 } as unknown as LivePollOpenTextClipElement['props'],
      }),
    ).toThrow();
  });

  it('rejects empty question (min 1 char)', () => {
    expect(() =>
      livePollOpenTextClipElementSchema.parse({
        ...VALID,
        props: { question: '', maxLength: 280 },
      }),
    ).toThrow();
  });

  it('rejects maxLength of 0 (must be positive)', () => {
    expect(() =>
      livePollOpenTextClipElementSchema.parse({
        ...VALID,
        props: { question: 'q', maxLength: 0 },
      }),
    ).toThrow();
  });

  it('rejects negative maxLength', () => {
    expect(() =>
      livePollOpenTextClipElementSchema.parse({
        ...VALID,
        props: { question: 'q', maxLength: -1 },
      }),
    ).toThrow();
  });

  it('rejects non-integer maxLength', () => {
    expect(() =>
      livePollOpenTextClipElementSchema.parse({
        ...VALID,
        props: { question: 'q', maxLength: 100.5 },
      }),
    ).toThrow();
  });

  it('rejects maxLength above the 2000 cap', () => {
    expect(() =>
      livePollOpenTextClipElementSchema.parse({
        ...VALID,
        props: { question: 'q', maxLength: 2001 },
      }),
    ).toThrow();
  });

  it('rejects a wrong permissions tuple', () => {
    expect(() =>
      livePollOpenTextClipElementSchema.parse({
        ...VALID,
        permissions: ['network'] as unknown as LivePollOpenTextClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects extra permissions entries', () => {
    expect(() =>
      livePollOpenTextClipElementSchema.parse({
        ...VALID,
        permissions: [
          'audience-network',
          'mic',
        ] as unknown as LivePollOpenTextClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects unknown discriminator', () => {
    expect(() =>
      livePollOpenTextClipElementSchema.parse({
        ...VALID,
        type: 'live-poll-rating' as 'live-poll-open-text',
      }),
    ).toThrow();
  });

  it('rejects unknown extra fields (strict)', () => {
    expect(() =>
      livePollOpenTextClipElementSchema.parse({
        ...VALID,
        unknownField: 'oops',
      } as unknown as LivePollOpenTextClipElement),
    ).toThrow();
  });
});
