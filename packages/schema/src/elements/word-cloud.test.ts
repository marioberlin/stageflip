// packages/schema/src/elements/word-cloud.test.ts
// T-467 — Schema-side roundtrip + reject-malformed tests for the
// `WordCloudClipElement` RIRElement variant.
//
// Seventh audience-clip variant on the `Element` discriminated union;
// live aggregating word weights. Mirrors T-461..T-466 test layout
// verbatim, swapping the discriminator + per-kind shape.

import { describe, expect, it } from 'vitest';

import { type WordCloudClipElement, wordCloudClipElementSchema } from './word-cloud.js';

const BASE = {
  id: 'el_wc_001',
  transform: { x: 0, y: 0, width: 800, height: 400 },
} as const;

const VALID: WordCloudClipElement = {
  ...BASE,
  visible: true,
  locked: false,
  animations: [],
  type: 'word-cloud',
  permissions: ['audience-network'],
  props: {
    prompt: 'Describe today in three words',
    maxWords: 100,
    maxWordsPerVoter: 3,
  },
};

describe('wordCloudClipElementSchema (T-467)', () => {
  it('parses a minimal valid element', () => {
    const parsed = wordCloudClipElementSchema.parse(VALID);
    expect(parsed.type).toBe('word-cloud');
    expect(parsed.props.prompt).toBe('Describe today in three words');
    expect(parsed.props.maxWords).toBe(100);
    expect(parsed.props.maxWordsPerVoter).toBe(3);
    expect(parsed.permissions).toEqual(['audience-network']);
  });

  it('defaults maxWords to 100 when omitted', () => {
    const parsed = wordCloudClipElementSchema.parse({
      ...BASE,
      visible: true,
      locked: false,
      animations: [],
      type: 'word-cloud',
      permissions: ['audience-network'],
      props: {
        prompt: 'Say something',
      },
    });
    expect(parsed.props.maxWords).toBe(100);
  });

  it('defaults maxWordsPerVoter to 3 when omitted', () => {
    const parsed = wordCloudClipElementSchema.parse({
      ...BASE,
      visible: true,
      locked: false,
      animations: [],
      type: 'word-cloud',
      permissions: ['audience-network'],
      props: {
        prompt: 'Say something',
      },
    });
    expect(parsed.props.maxWordsPerVoter).toBe(3);
  });

  it('accepts a custom maxWords within bounds', () => {
    const parsed = wordCloudClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, maxWords: 250 },
    });
    expect(parsed.props.maxWords).toBe(250);
  });

  it('accepts a custom maxWordsPerVoter within bounds', () => {
    const parsed = wordCloudClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, maxWordsPerVoter: 10 },
    });
    expect(parsed.props.maxWordsPerVoter).toBe(10);
  });

  it('accepts an optional sessionId on props', () => {
    const parsed = wordCloudClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, sessionId: 'sess-abc' },
    });
    expect(parsed.props.sessionId).toBe('sess-abc');
  });

  it('round-trips byte-equal', () => {
    const once = wordCloudClipElementSchema.parse(VALID);
    const twice = wordCloudClipElementSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('accepts optional provenance', () => {
    const parsed = wordCloudClipElementSchema.parse({
      ...VALID,
      provenance: {
        provider: 'audience-native',
        sessionId: 'sess-1',
        snapshotFrame: 0,
        voterCountAtCapture: 18,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'word-cloud',
        aggregation: {
          kind: 'word-cloud',
          words: [
            { word: 'design', weight: 12 },
            { word: 'react', weight: 9 },
          ],
          totalSubmissions: 18,
        },
      },
    });
    expect(parsed.provenance?.aggregation.kind).toBe('word-cloud');
  });

  it('rejects empty prompt', () => {
    expect(() =>
      wordCloudClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, prompt: '' },
      }),
    ).toThrow();
  });

  it('rejects missing prompt', () => {
    expect(() =>
      wordCloudClipElementSchema.parse({
        ...VALID,
        props: {} as unknown as WordCloudClipElement['props'],
      }),
    ).toThrow();
  });

  it('rejects maxWords === 0', () => {
    expect(() =>
      wordCloudClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, maxWords: 0 },
      }),
    ).toThrow();
  });

  it('rejects negative maxWords', () => {
    expect(() =>
      wordCloudClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, maxWords: -5 },
      }),
    ).toThrow();
  });

  it('rejects maxWords > 500', () => {
    expect(() =>
      wordCloudClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, maxWords: 501 },
      }),
    ).toThrow();
  });

  it('rejects non-integer maxWords', () => {
    expect(() =>
      wordCloudClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, maxWords: 50.5 },
      }),
    ).toThrow();
  });

  it('rejects maxWordsPerVoter === 0', () => {
    expect(() =>
      wordCloudClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, maxWordsPerVoter: 0 },
      }),
    ).toThrow();
  });

  it('rejects maxWordsPerVoter > 20', () => {
    expect(() =>
      wordCloudClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, maxWordsPerVoter: 21 },
      }),
    ).toThrow();
  });

  it('rejects non-integer maxWordsPerVoter', () => {
    expect(() =>
      wordCloudClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, maxWordsPerVoter: 2.5 },
      }),
    ).toThrow();
  });

  it('rejects empty sessionId', () => {
    expect(() =>
      wordCloudClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, sessionId: '' },
      }),
    ).toThrow();
  });

  it('rejects a wrong permissions tuple', () => {
    expect(() =>
      wordCloudClipElementSchema.parse({
        ...VALID,
        permissions: ['network'] as unknown as WordCloudClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects extra permissions entries', () => {
    expect(() =>
      wordCloudClipElementSchema.parse({
        ...VALID,
        permissions: ['audience-network', 'mic'] as unknown as WordCloudClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects unknown discriminator', () => {
    expect(() =>
      wordCloudClipElementSchema.parse({
        ...VALID,
        type: 'live-quiz' as 'word-cloud',
      }),
    ).toThrow();
  });

  it('rejects unknown extra fields (strict)', () => {
    expect(() =>
      wordCloudClipElementSchema.parse({
        ...VALID,
        unknownField: 'oops',
      } as unknown as WordCloudClipElement),
    ).toThrow();
  });

  it('rejects unknown extra fields on props (strict)', () => {
    expect(() =>
      wordCloudClipElementSchema.parse({
        ...VALID,
        props: {
          ...VALID.props,
          unknownField: 'x',
        } as unknown as WordCloudClipElement['props'],
      }),
    ).toThrow();
  });
});
