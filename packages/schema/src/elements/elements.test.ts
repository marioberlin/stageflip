// packages/schema/src/elements/elements.test.ts
// Unit tests for every element type in the canonical schema. Exhaustive
// round-trip tests (across all animations × all timings) are T-024's scope;
// this file covers shape, defaults, discrimination, and the group recursion.

import { describe, expect, it } from 'vitest';

import {
  ELEMENT_TYPES,
  type Element,
  MEDIA_PROVENANCE_KINDS,
  type MediaProvenance,
  audioElementSchema,
  chartElementSchema,
  clipElementSchema,
  codeElementSchema,
  elementSchema,
  embedElementSchema,
  groupElementSchema,
  imageElementSchema,
  mediaProvenanceSchema,
  shapeElementSchema,
  tableElementSchema,
  tenantVoiceConsentRefSchema,
  textElementSchema,
  videoElementSchema,
} from './index.js';
import { validateShapeElement } from './shape.js';

const BASE = {
  id: 'el_01abc',
  transform: { x: 0, y: 0, width: 100, height: 100 },
} as const;

describe('text element', () => {
  it('parses a minimal valid text element', () => {
    const parsed = textElementSchema.parse({ ...BASE, type: 'text', text: 'Hello' });
    expect(parsed.align).toBe('left');
    expect(parsed.visible).toBe(true);
  });
  it('rejects missing text', () => {
    expect(() => textElementSchema.parse({ ...BASE, type: 'text' })).toThrow();
  });
  it('rejects invalid align', () => {
    expect(() =>
      textElementSchema.parse({ ...BASE, type: 'text', text: 'x', align: 'crooked' }),
    ).toThrow();
  });
});

describe('image element', () => {
  it('parses a minimal valid image element', () => {
    const parsed = imageElementSchema.parse({
      ...BASE,
      type: 'image',
      src: 'asset:abc123',
    });
    expect(parsed.fit).toBe('cover');
  });
  it('rejects a non-asset src', () => {
    expect(() =>
      imageElementSchema.parse({ ...BASE, type: 'image', src: 'http://example.com/x.png' }),
    ).toThrow(/asset ref/);
  });
});

describe('video element', () => {
  it('parses minimal + enforces trim.endMs > startMs', () => {
    const ok = videoElementSchema.parse({ ...BASE, type: 'video', src: 'asset:v1' });
    expect(ok.muted).toBe(false);
    expect(() =>
      videoElementSchema.parse({
        ...BASE,
        type: 'video',
        src: 'asset:v1',
        trim: { startMs: 500, endMs: 100 },
      }),
    ).toThrow(/endMs must exceed startMs/);
  });
});

describe('audio element', () => {
  it('parses with mix defaults', () => {
    const parsed = audioElementSchema.parse({
      ...BASE,
      type: 'audio',
      src: 'asset:a1',
      mix: { gain: 2 },
    });
    expect(parsed.mix?.pan).toBe(0);
    expect(parsed.mix?.fadeInMs).toBe(0);
  });
});

describe('shape element', () => {
  it('parses rect without path', () => {
    const parsed = shapeElementSchema.parse({ ...BASE, type: 'shape', shape: 'rect' });
    expect(parsed.shape).toBe('rect');
  });
  it('parses custom-path without path at the schema level (semantic check is separate)', () => {
    const parsed = shapeElementSchema.parse({ ...BASE, type: 'shape', shape: 'custom-path' });
    expect(parsed.shape).toBe('custom-path');
    // The semantic check lives in validateShapeElement so we keep the
    // element schema compatible with z.union recursion.
    expect(validateShapeElement(parsed)).toMatch(/custom-path/);
  });
  it('validateShapeElement passes a valid custom-path shape', () => {
    const parsed = shapeElementSchema.parse({
      ...BASE,
      type: 'shape',
      shape: 'custom-path',
      path: 'M 0 0 L 10 10 Z',
    });
    expect(validateShapeElement(parsed)).toBeNull();
  });
  it('accepts theme-token fill', () => {
    const parsed = shapeElementSchema.parse({
      ...BASE,
      type: 'shape',
      shape: 'rect',
      fill: 'theme:color.primary',
    });
    expect(parsed.fill).toBe('theme:color.primary');
  });
});

describe('chart element', () => {
  it('accepts inline data', () => {
    const parsed = chartElementSchema.parse({
      ...BASE,
      type: 'chart',
      chartKind: 'bar',
      data: { labels: ['a', 'b'], series: [{ name: 's', values: [1, 2] }] },
    });
    expect(parsed.legend).toBe(true);
  });
  it('accepts ds: reference', () => {
    chartElementSchema.parse({
      ...BASE,
      type: 'chart',
      chartKind: 'line',
      data: 'ds:quarterly_revenue',
    });
  });
});

describe('table element', () => {
  it('parses rows/columns/cells', () => {
    const parsed = tableElementSchema.parse({
      ...BASE,
      type: 'table',
      rows: 2,
      columns: 2,
      cells: [{ row: 0, col: 0, content: 'hi' }],
    });
    expect(parsed.headerRow).toBe(true);
  });
});

describe('clip element', () => {
  it('carries runtime + params + optional fonts', () => {
    const parsed = clipElementSchema.parse({
      ...BASE,
      type: 'clip',
      runtime: 'gsap',
      clipName: 'motion-text',
      params: { speed: 2 },
      fonts: [{ family: 'Inter', weight: 600 }],
    });
    expect(parsed.runtime).toBe('gsap');
    expect(parsed.fonts?.[0]?.style).toBe('normal');
  });
});

describe('embed element', () => {
  it('parses with default sandbox', () => {
    const parsed = embedElementSchema.parse({
      ...BASE,
      type: 'embed',
      src: 'https://example.com/widget',
    });
    expect(parsed.sandbox).toEqual(['allow-scripts']);
    expect(parsed.allowFullscreen).toBe(false);
  });
  it('rejects invalid URL', () => {
    expect(() => embedElementSchema.parse({ ...BASE, type: 'embed', src: 'not a url' })).toThrow();
  });
});

describe('code element', () => {
  it('parses typescript with defaults', () => {
    const parsed = codeElementSchema.parse({
      ...BASE,
      type: 'code',
      code: 'const x = 1;',
      language: 'typescript',
    });
    expect(parsed.showLineNumbers).toBe(false);
  });
});

describe('group element (recursive)', () => {
  it('parses a group containing mixed children, including a nested group', () => {
    const parsed = groupElementSchema.parse({
      ...BASE,
      type: 'group',
      children: [
        { ...BASE, id: 'child1', type: 'text', text: 'A' },
        {
          ...BASE,
          id: 'child2',
          type: 'group',
          children: [{ ...BASE, id: 'grand1', type: 'text', text: 'B' }],
        },
      ],
    });
    expect(parsed.clip).toBe(false);
    expect(parsed.children).toHaveLength(2);
    const nested = parsed.children[1];
    expect(nested?.type).toBe('group');
    if (nested?.type === 'group') expect(nested.children[0]?.type).toBe('text');
  });
});

describe('elementSchema (discriminated union)', () => {
  it('discriminates on `type`', () => {
    const t: Element = elementSchema.parse({ ...BASE, type: 'text', text: 'x' });
    expect(t.type).toBe('text');
    // TS narrowing check (no runtime effect; compilation is the test)
    if (t.type === 'text') expect(t.text).toBe('x');
  });
  it('rejects unknown type', () => {
    expect(() => elementSchema.parse({ ...BASE, type: 'unicorn' })).toThrow();
  });
  it('rejects unknown field on a known type (strict)', () => {
    expect(() =>
      elementSchema.parse({ ...BASE, type: 'text', text: 'x', hairstyle: 'mohawk' }),
    ).toThrow();
  });
  it('ELEMENT_TYPES covers all discriminant values', () => {
    // Bumped from 12 to 13 in T-305 to add 'interactive-clip' (ADR-003 §D2).
    // Bumped from 13 to 14 in T-461 to add 'live-poll-multiple-choice' — first
    // audience-clip variant on the union (ADR-010 §D2).
    // Bumped from 14 to 15 in T-462 to add 'live-poll-open-text' — second
    // audience-clip variant on the union (ADR-010 §D2).
    // Bumped from 15 to 16 in T-463 to add 'live-poll-rating' — third
    // audience-clip variant on the union (ADR-010 §D2; closes the LivePoll family).
    // Bumped from 16 to 17 in T-464 to add 'live-qa' — fourth audience-clip
    // variant on the union (ADR-010 §D2; first non-LivePoll family).
    // Bumped from 17 to 18 in T-465 to add 'live-quiz' — fifth audience-clip
    // variant on the union (ADR-010 §D2; competitive multi-question quiz).
    // Bumped from 18 to 19 in T-466 to add 'leaderboard' — sixth audience-clip
    // variant on the union (ADR-010 §D2; first DERIVED clip — paired with
    // live-quiz; `LeaderboardVote = never`).
    expect(ELEMENT_TYPES).toHaveLength(19);
    expect(new Set(ELEMENT_TYPES).size).toBe(19);
  });

  it('elementSchema accepts a live-poll-multiple-choice element via the union (T-461)', () => {
    const el = elementSchema.parse({
      ...BASE,
      type: 'live-poll-multiple-choice',
      permissions: ['audience-network'],
      props: {
        question: 'What now?',
        options: ['A', 'B'],
      },
    });
    expect(el.type).toBe('live-poll-multiple-choice');
    if (el.type === 'live-poll-multiple-choice') {
      expect(el.props.options).toHaveLength(2);
      expect(el.permissions).toEqual(['audience-network']);
    }
  });

  it('elementSchema accepts a live-poll-open-text element via the union (T-462)', () => {
    const el = elementSchema.parse({
      ...BASE,
      type: 'live-poll-open-text',
      permissions: ['audience-network'],
      props: {
        question: 'Any thoughts?',
        maxLength: 280,
      },
    });
    expect(el.type).toBe('live-poll-open-text');
    if (el.type === 'live-poll-open-text') {
      expect(el.props.maxLength).toBe(280);
      expect(el.permissions).toEqual(['audience-network']);
    }
  });

  it('elementSchema accepts a live-poll-rating element via the union (T-463)', () => {
    const el = elementSchema.parse({
      ...BASE,
      type: 'live-poll-rating',
      permissions: ['audience-network'],
      props: {
        question: 'Rate the talk',
        scaleMin: 1,
        scaleMax: 5,
      },
    });
    expect(el.type).toBe('live-poll-rating');
    if (el.type === 'live-poll-rating') {
      expect(el.props.scaleMax).toBe(5);
      expect(el.props.scaleMin).toBe(1);
      expect(el.permissions).toEqual(['audience-network']);
    }
  });

  it('elementSchema accepts a live-qa element via the union (T-464)', () => {
    const el = elementSchema.parse({
      ...BASE,
      type: 'live-qa',
      permissions: ['audience-network'],
      props: {
        topic: 'Ask the speaker',
      },
    });
    expect(el.type).toBe('live-qa');
    if (el.type === 'live-qa') {
      expect(el.props.topic).toBe('Ask the speaker');
      expect(el.props.allowUpvoting).toBe(true);
      expect(el.props.moderationMode).toBe('open');
      expect(el.props.maxLength).toBe(500);
      expect(el.props.topN).toBe(100);
      expect(el.permissions).toEqual(['audience-network']);
    }
  });

  it('elementSchema accepts a live-quiz element via the union (T-465)', () => {
    const el = elementSchema.parse({
      ...BASE,
      type: 'live-quiz',
      permissions: ['audience-network'],
      props: {
        questions: [
          {
            id: 'q1',
            text: 'Capital of France?',
            options: ['London', 'Paris'],
            correctOptionIndex: 1,
          },
        ],
      },
    });
    expect(el.type).toBe('live-quiz');
    if (el.type === 'live-quiz') {
      expect(el.props.questions).toHaveLength(1);
      expect(el.props.questions[0]?.correctOptionIndex).toBe(1);
      expect(el.permissions).toEqual(['audience-network']);
    }
  });

  it('elementSchema accepts a leaderboard element via the union (T-466)', () => {
    const el = elementSchema.parse({
      ...BASE,
      type: 'leaderboard',
      permissions: ['audience-network'],
      props: {
        quizId: 'quiz-1',
      },
    });
    expect(el.type).toBe('leaderboard');
    if (el.type === 'leaderboard') {
      expect(el.props.quizId).toBe('quiz-1');
      expect(el.props.topN).toBe(10);
      expect(el.permissions).toEqual(['audience-network']);
    }
  });
});

/* ----------------------- T-421 — MediaProvenance ----------------------- */

const FULL_PROVENANCE: MediaProvenance = {
  kind: 'tts',
  provider: 'tts-kokoro',
  model: 'kokoro-82m',
  prompt: 'Hello world',
  cacheKey: 'a'.repeat(64),
  seed: 42,
  voiceProvider: 'kokoro',
  voiceId: 'af-bella',
  clonedFromConsent: {
    tenantId: 'tenant-1',
    consentId: 'consent-1',
    grantedAt: '2026-05-11T00:00:00.000Z',
  },
  researchSessionId: 'rs-abc',
  sourceIds: ['src-1', 'src-2'],
};

describe('mediaProvenanceSchema (T-421 / ADR-008 §D2)', () => {
  it('parses the minimal {kind: imported} shape', () => {
    const parsed = mediaProvenanceSchema.parse({ kind: 'imported' });
    expect(parsed.kind).toBe('imported');
    expect(parsed.provider).toBeUndefined();
  });

  it('accepts every MEDIA_PROVENANCE_KINDS literal', () => {
    // Bumped from 7 to 8 in T-438 to add 'asset-gen-pending' (the
    // optimistic-placeholder variant; ADR-008 §D2 follow-up).
    expect(MEDIA_PROVENANCE_KINDS).toHaveLength(8);
    for (const kind of MEDIA_PROVENANCE_KINDS) {
      expect(mediaProvenanceSchema.parse({ kind }).kind).toBe(kind);
    }
  });

  it('T-438: includes asset-gen-pending in the tuple', () => {
    expect(MEDIA_PROVENANCE_KINDS).toContain('asset-gen-pending');
  });

  it('T-438: parses pending variant with placeholderId + estimatedCompletionAt', () => {
    const parsed = mediaProvenanceSchema.parse({
      kind: 'asset-gen-pending',
      placeholderId: 'ph-abc-123',
      estimatedCompletionAt: '2026-05-11T00:00:30.000Z',
      provider: 'tts-kokoro',
      cacheKey: 'a'.repeat(64),
    });
    expect(parsed.kind).toBe('asset-gen-pending');
    expect(parsed.placeholderId).toBe('ph-abc-123');
    expect(parsed.estimatedCompletionAt).toBe('2026-05-11T00:00:30.000Z');
    expect(parsed.provider).toBe('tts-kokoro');
  });

  it('T-438: pending variant round-trips byte-equal', () => {
    const original = {
      kind: 'asset-gen-pending' as const,
      placeholderId: 'ph-uuid',
      estimatedCompletionAt: '2026-05-11T00:01:00.000Z',
      provider: 'video-seedance',
      model: 'seedance-v1',
      cacheKey: 'b'.repeat(64),
    };
    const once = mediaProvenanceSchema.parse(original);
    const twice = mediaProvenanceSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('T-438: rejects unknown field on pending variant (strict)', () => {
    expect(() =>
      mediaProvenanceSchema.parse({
        kind: 'asset-gen-pending',
        placeholderId: 'p',
        futureField: 'x',
      }),
    ).toThrow();
  });

  it('T-438: pending variant works without optional fields', () => {
    const parsed = mediaProvenanceSchema.parse({ kind: 'asset-gen-pending' });
    expect(parsed.kind).toBe('asset-gen-pending');
    expect(parsed.placeholderId).toBeUndefined();
    expect(parsed.estimatedCompletionAt).toBeUndefined();
  });

  it('T-438: rejects malformed estimatedCompletionAt (must be ISO 8601 datetime)', () => {
    expect(() =>
      mediaProvenanceSchema.parse({
        kind: 'asset-gen-pending',
        estimatedCompletionAt: '2026-05-11',
      }),
    ).toThrow();
  });

  it('T-438: rejects empty-string placeholderId (must be ≥1 char)', () => {
    expect(() =>
      mediaProvenanceSchema.parse({ kind: 'asset-gen-pending', placeholderId: '' }),
    ).toThrow();
  });

  it('rejects an unknown kind', () => {
    expect(() => mediaProvenanceSchema.parse({ kind: 'magic' })).toThrow();
  });

  it('rejects an unknown field (strict)', () => {
    expect(() => mediaProvenanceSchema.parse({ kind: 'tts', futureField: 'x' })).toThrow();
  });

  it('parses the maximally-populated shape and round-trips byte-equal', () => {
    const once = mediaProvenanceSchema.parse(FULL_PROVENANCE);
    const twice = mediaProvenanceSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
    expect(twice.cacheKey).toHaveLength(64);
    expect(twice.sourceIds).toEqual(['src-1', 'src-2']);
  });

  it('accepts seed as number or string (per cache-key recipe)', () => {
    expect(mediaProvenanceSchema.parse({ kind: 'tts', seed: 7 }).seed).toBe(7);
    expect(mediaProvenanceSchema.parse({ kind: 'tts', seed: 'deadbeef' }).seed).toBe('deadbeef');
  });

  it('rejects empty-string seed (must be ≥1 char if string)', () => {
    expect(() => mediaProvenanceSchema.parse({ kind: 'tts', seed: '' })).toThrow();
  });
});

describe('tenantVoiceConsentRefSchema (T-421 / ADR-008 §D2 / §D4)', () => {
  it('requires all three fields', () => {
    const ok = tenantVoiceConsentRefSchema.parse({
      tenantId: 't1',
      consentId: 'c1',
      grantedAt: '2026-05-11T00:00:00.000Z',
    });
    expect(ok.tenantId).toBe('t1');

    expect(() => tenantVoiceConsentRefSchema.parse({ tenantId: 't1', consentId: 'c1' })).toThrow();
    expect(() =>
      tenantVoiceConsentRefSchema.parse({ consentId: 'c1', grantedAt: '2026-05-11T00:00:00.000Z' }),
    ).toThrow();
  });

  it('rejects a malformed grantedAt (must be ISO 8601 datetime)', () => {
    expect(() =>
      tenantVoiceConsentRefSchema.parse({
        tenantId: 't1',
        consentId: 'c1',
        grantedAt: '2026-05-11',
      }),
    ).toThrow();
  });
});

describe('audio/image/video elements carry optional provenance (T-421)', () => {
  it('audio: parses without provenance (back-compat)', () => {
    const parsed = audioElementSchema.parse({ ...BASE, type: 'audio', src: 'asset:a1' });
    expect(parsed.provenance).toBeUndefined();
  });

  it('audio: parses with full provenance and round-trips', () => {
    const original = {
      ...BASE,
      type: 'audio' as const,
      src: 'asset:a1' as const,
      provenance: FULL_PROVENANCE,
    };
    const once = audioElementSchema.parse(original);
    const twice = audioElementSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
    expect(twice.provenance?.voiceId).toBe('af-bella');
  });

  it('image: parses without provenance (back-compat)', () => {
    const parsed = imageElementSchema.parse({ ...BASE, type: 'image', src: 'asset:i1' });
    expect(parsed.provenance).toBeUndefined();
  });

  it('image: parses with full provenance and round-trips', () => {
    const original = {
      ...BASE,
      type: 'image' as const,
      src: 'asset:i1' as const,
      provenance: { ...FULL_PROVENANCE, kind: 'image-gen' as const },
    };
    const once = imageElementSchema.parse(original);
    const twice = imageElementSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
    expect(twice.provenance?.kind).toBe('image-gen');
  });

  it('video: parses without provenance (back-compat)', () => {
    const parsed = videoElementSchema.parse({ ...BASE, type: 'video', src: 'asset:v1' });
    expect(parsed.provenance).toBeUndefined();
  });

  it('video: parses with full provenance and round-trips', () => {
    const original = {
      ...BASE,
      type: 'video' as const,
      src: 'asset:v1' as const,
      provenance: { ...FULL_PROVENANCE, kind: 'video-gen' as const },
    };
    const once = videoElementSchema.parse(original);
    const twice = videoElementSchema.parse(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
    expect(twice.provenance?.kind).toBe('video-gen');
  });

  it('rejects provenance with an unknown field on each media element (strict)', () => {
    for (const [schema, base] of [
      [audioElementSchema, { type: 'audio', src: 'asset:a1' }],
      [imageElementSchema, { type: 'image', src: 'asset:i1' }],
      [videoElementSchema, { type: 'video', src: 'asset:v1' }],
    ] as const) {
      expect(() =>
        schema.parse({
          ...BASE,
          ...base,
          provenance: { kind: 'tts', futureField: 'x' },
        } as unknown),
      ).toThrow();
    }
  });

  it('elementSchema (discriminated union) accepts provenance on media branches', () => {
    const el = elementSchema.parse({
      ...BASE,
      type: 'audio',
      src: 'asset:a1',
      provenance: { kind: 'tts', provider: 'tts-kokoro' },
    });
    if (el.type !== 'audio') throw new Error('type');
    expect(el.provenance?.provider).toBe('tts-kokoro');
  });

  it('T-438: accepts pending provenance kind on audio/image/video', () => {
    for (const [schema, base] of [
      [audioElementSchema, { type: 'audio' as const, src: 'asset:a1' as const }],
      [imageElementSchema, { type: 'image' as const, src: 'asset:i1' as const }],
      [videoElementSchema, { type: 'video' as const, src: 'asset:v1' as const }],
    ] as const) {
      const parsed = schema.parse({
        ...BASE,
        ...base,
        provenance: {
          kind: 'asset-gen-pending',
          placeholderId: 'ph-x',
          estimatedCompletionAt: '2026-05-11T00:00:30.000Z',
        },
      } as unknown) as { provenance?: MediaProvenance };
      expect(parsed.provenance?.kind).toBe('asset-gen-pending');
      expect(parsed.provenance?.placeholderId).toBe('ph-x');
    }
  });
});
