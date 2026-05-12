// packages/schema/src/elements/audience-ai-prompt.test.ts
// T-471 — Schema-side roundtrip + reject-malformed tests for the
// `AudienceAiPromptClipElement` RIRElement variant. Eleventh + FINAL
// audience-clip variant on the `Element` discriminated union; THIRD
// marquee differentiator (audience-driven AI generation).

import { describe, expect, it } from 'vitest';

import {
  AUDIENCE_AI_PROMPT_TARGET_MODALITIES,
  type AudienceAiPromptClipElement,
  audienceAiPromptClipElementSchema,
} from './audience-ai-prompt.js';

const BASE = {
  id: 'el_aip_001',
  transform: { x: 0, y: 0, width: 800, height: 600 },
} as const;

const VALID: AudienceAiPromptClipElement = {
  ...BASE,
  visible: true,
  locked: false,
  animations: [],
  type: 'audience-ai-prompt',
  permissions: ['audience-network'],
  props: {
    prompt: 'What should we generate next?',
    targetModality: 'video-gen',
    topN: 20,
    maxPromptLength: 200,
  },
};

describe('audienceAiPromptClipElementSchema (T-471)', () => {
  it('parses a minimal valid element using schema defaults', () => {
    const parsed = audienceAiPromptClipElementSchema.parse({
      ...BASE,
      visible: true,
      locked: false,
      animations: [],
      type: 'audience-ai-prompt',
      permissions: ['audience-network'],
      props: {
        prompt: 'Pick a prompt',
        targetModality: 'video-gen',
      },
    });
    expect(parsed.type).toBe('audience-ai-prompt');
    expect(parsed.props.topN).toBe(20);
    expect(parsed.props.maxPromptLength).toBe(200);
    expect(parsed.props.targetModality).toBe('video-gen');
    expect(parsed.permissions).toEqual(['audience-network']);
  });

  it('parses a fully-specified element', () => {
    const parsed = audienceAiPromptClipElementSchema.parse(VALID);
    expect(parsed.props.prompt).toBe('What should we generate next?');
    expect(parsed.props.topN).toBe(20);
    expect(parsed.props.maxPromptLength).toBe(200);
  });

  it('accepts every supported targetModality', () => {
    expect(AUDIENCE_AI_PROMPT_TARGET_MODALITIES).toEqual([
      'video-gen',
      'music-gen',
      'image-gen',
      'tts',
    ]);
    for (const modality of AUDIENCE_AI_PROMPT_TARGET_MODALITIES) {
      const parsed = audienceAiPromptClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, targetModality: modality },
      });
      expect(parsed.props.targetModality).toBe(modality);
    }
  });

  it('accepts an optional sessionId on props', () => {
    const parsed = audienceAiPromptClipElementSchema.parse({
      ...VALID,
      props: { ...VALID.props, sessionId: 'sess-abc' },
    });
    expect(parsed.props.sessionId).toBe('sess-abc');
  });

  it('round-trips byte-equal', () => {
    const once = audienceAiPromptClipElementSchema.parse(VALID);
    const twice = audienceAiPromptClipElementSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('accepts optional provenance with audience-ai-prompt aggregation', () => {
    const parsed = audienceAiPromptClipElementSchema.parse({
      ...VALID,
      provenance: {
        provider: 'audience-native',
        sessionId: 'sess-1',
        snapshotFrame: 0,
        voterCountAtCapture: 12,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'audience-ai-prompt',
        aggregation: {
          kind: 'audience-ai-prompt',
          prompts: [{ id: 'p1', text: 'A sunset', upvotes: 5 }],
          winnerPromptId: 'p1',
          generatedAssetCacheKey: 'cache://video/abc',
        },
      },
    });
    expect(parsed.provenance?.aggregation.kind).toBe('audience-ai-prompt');
  });

  // --- malformed rejection ---

  it('rejects empty prompt', () => {
    expect(() =>
      audienceAiPromptClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, prompt: '' },
      }),
    ).toThrow();
  });

  it('rejects unknown targetModality', () => {
    expect(() =>
      audienceAiPromptClipElementSchema.parse({
        ...VALID,
        props: {
          ...VALID.props,
          targetModality: 'speech-to-text' as unknown as 'tts',
        },
      }),
    ).toThrow();
  });

  it('rejects topN of 0', () => {
    expect(() =>
      audienceAiPromptClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, topN: 0 },
      }),
    ).toThrow();
  });

  it('rejects topN > 100', () => {
    expect(() =>
      audienceAiPromptClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, topN: 101 },
      }),
    ).toThrow();
  });

  it('rejects non-integer topN', () => {
    expect(() =>
      audienceAiPromptClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, topN: 3.5 },
      }),
    ).toThrow();
  });

  it('rejects maxPromptLength of 0', () => {
    expect(() =>
      audienceAiPromptClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, maxPromptLength: 0 },
      }),
    ).toThrow();
  });

  it('rejects maxPromptLength > 500', () => {
    expect(() =>
      audienceAiPromptClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, maxPromptLength: 501 },
      }),
    ).toThrow();
  });

  it('rejects empty sessionId', () => {
    expect(() =>
      audienceAiPromptClipElementSchema.parse({
        ...VALID,
        props: { ...VALID.props, sessionId: '' },
      }),
    ).toThrow();
  });

  it('rejects a wrong permissions tuple', () => {
    expect(() =>
      audienceAiPromptClipElementSchema.parse({
        ...VALID,
        permissions: ['network'] as unknown as AudienceAiPromptClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects extra permissions entries', () => {
    expect(() =>
      audienceAiPromptClipElementSchema.parse({
        ...VALID,
        permissions: [
          'audience-network',
          'mic',
        ] as unknown as AudienceAiPromptClipElement['permissions'],
      }),
    ).toThrow();
  });

  it('rejects unknown top-level discriminator', () => {
    expect(() =>
      audienceAiPromptClipElementSchema.parse({
        ...VALID,
        type: 'heatmap' as 'audience-ai-prompt',
      }),
    ).toThrow();
  });

  it('rejects unknown extra fields (strict)', () => {
    expect(() =>
      audienceAiPromptClipElementSchema.parse({
        ...VALID,
        unknownField: 'oops',
      } as unknown as AudienceAiPromptClipElement),
    ).toThrow();
  });

  it('rejects unknown extra fields on props (strict)', () => {
    expect(() =>
      audienceAiPromptClipElementSchema.parse({
        ...VALID,
        props: {
          ...VALID.props,
          unknownField: 'x',
        } as unknown as AudienceAiPromptClipElement['props'],
      }),
    ).toThrow();
  });
});
