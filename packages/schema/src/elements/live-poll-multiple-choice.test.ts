// packages/schema/src/elements/live-poll-multiple-choice.test.ts
// T-461 — Schema-side roundtrip + reject-malformed tests for the
// `LivePollMultipleChoiceClipElement` RIRElement variant.
//
// First audience-clip variant on the `Element` discriminated union.
// Sets the precedent for T-462..T-471 (eight sibling clip families).

import { describe, expect, it } from 'vitest';

import {
  type LivePollMultipleChoiceClipElement,
  livePollMultipleChoiceClipElementSchema,
} from './live-poll-multiple-choice.js';

const BASE = {
  id: 'el_lp_mc_001',
  transform: { x: 0, y: 0, width: 800, height: 400 },
} as const;

const VALID: LivePollMultipleChoiceClipElement = {
  ...BASE,
  visible: true,
  locked: false,
  animations: [],
  type: 'live-poll-multiple-choice',
  permissions: ['audience-network'],
  props: {
    question: 'What is your favourite colour?',
    options: ['Red', 'Green', 'Blue'],
  },
};

describe('livePollMultipleChoiceClipElementSchema (T-461)', () => {
  it('parses a minimal valid element', () => {
    const parsed = livePollMultipleChoiceClipElementSchema.parse(VALID);
    expect(parsed.type).toBe('live-poll-multiple-choice');
    expect(parsed.props.question).toBe('What is your favourite colour?');
    expect(parsed.props.options).toHaveLength(3);
    expect(parsed.permissions).toEqual(['audience-network']);
  });

  it('round-trips byte-equal', () => {
    const once = livePollMultipleChoiceClipElementSchema.parse(VALID);
    const twice = livePollMultipleChoiceClipElementSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('accepts an optional sessionId on props', () => {
    const parsed = livePollMultipleChoiceClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, sessionId: 'sess-abc' },
    });
    expect(parsed.props.sessionId).toBe('sess-abc');
  });

  it('accepts optional provenance', () => {
    const parsed = livePollMultipleChoiceClipElementSchema.parse({
      ...VALID,
      provenance: {
        provider: 'audience-native',
        sessionId: 'sess-1',
        snapshotFrame: 0,
        voterCountAtCapture: 18,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'live-poll-multiple-choice',
        aggregation: {
          kind: 'live-poll-multiple-choice',
          optionCounts: [10, 5, 3],
          totalVotes: 18,
        },
      },
    });
    expect(parsed.provenance?.aggregation.kind).toBe('live-poll-multiple-choice');
  });

  it('rejects missing question', () => {
    expect(() =>
      livePollMultipleChoiceClipElementSchema.parse({
        ...VALID,
        props: { options: ['A', 'B'] } as unknown as LivePollMultipleChoiceClipElement['props'],
      }),
    ).toThrow();
  });

  it('rejects empty question (min 1 char)', () => {
    expect(() =>
      livePollMultipleChoiceClipElementSchema.parse({
        ...VALID,
        props: { question: '', options: ['A', 'B'] },
      }),
    ).toThrow();
  });

  it('rejects fewer than 2 options', () => {
    expect(() =>
      livePollMultipleChoiceClipElementSchema.parse({
        ...VALID,
        props: { question: 'q', options: ['only'] },
      }),
    ).toThrow();
  });

  it('rejects more than 10 options', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `opt-${i}`);
    expect(() =>
      livePollMultipleChoiceClipElementSchema.parse({
        ...VALID,
        props: { question: 'q', options: eleven },
      }),
    ).toThrow();
  });

  it('rejects an empty option string (min 1 char)', () => {
    expect(() =>
      livePollMultipleChoiceClipElementSchema.parse({
        ...VALID,
        props: { question: 'q', options: ['A', ''] },
      }),
    ).toThrow();
  });

  it('rejects a wrong permissions tuple', () => {
    expect(() =>
      livePollMultipleChoiceClipElementSchema.parse({
        ...VALID,
        permissions: ['network'] as unknown as LivePollMultipleChoiceClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects extra permissions entries', () => {
    expect(() =>
      livePollMultipleChoiceClipElementSchema.parse({
        ...VALID,
        permissions: [
          'audience-network',
          'mic',
        ] as unknown as LivePollMultipleChoiceClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects unknown discriminator', () => {
    expect(() =>
      livePollMultipleChoiceClipElementSchema.parse({
        ...VALID,
        type: 'live-poll-rating' as 'live-poll-multiple-choice',
      }),
    ).toThrow();
  });

  it('rejects unknown extra fields (strict)', () => {
    expect(() =>
      livePollMultipleChoiceClipElementSchema.parse({
        ...VALID,
        unknownField: 'oops',
      } as unknown as LivePollMultipleChoiceClipElement),
    ).toThrow();
  });
});
