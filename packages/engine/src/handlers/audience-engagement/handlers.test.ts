// packages/engine/src/handlers/audience-engagement/handlers.test.ts
// Vitest coverage for the 11 audience-engagement compose tools — happy-
// path emission per `AudienceClipKind`, schema rejection per tool, the
// ADR-010 §D2 leaderboard-no-vote invariant, and determinism + read-only
// invariants.

import { describe, expect, it } from 'vitest';
import type { ToolContext, ToolHandler } from '../../router/types.js';
import {
  AUDIENCE_CLIP_KINDS,
  AUDIENCE_ENGAGEMENT_HANDLERS,
  type AudienceClipKind,
  QA_MODERATION_MODES,
  SURVEY_QUESTION_KINDS,
} from './handlers.js';

const ctx: ToolContext = {};

function getTool(name: string): ToolHandler<unknown, unknown, ToolContext> {
  const found = AUDIENCE_ENGAGEMENT_HANDLERS.find((h) => h.name === name);
  if (!found) throw new Error(`tool ${name} not found in AUDIENCE_ENGAGEMENT_HANDLERS`);
  return found;
}

async function invoke(name: string, input: unknown): Promise<unknown> {
  const tool = getTool(name);
  const parsed = tool.inputSchema.parse(input);
  const result = await tool.handle(parsed, ctx);
  return tool.outputSchema.parse(result);
}

type Out = {
  presetId: string | undefined;
  clipKind: AudienceClipKind;
  props: Record<string, unknown>;
};

describe('compose_live_poll_multiple_choice', () => {
  it('happy path: emits live-poll-multiple-choice with question + options', async () => {
    const out = (await invoke('compose_live_poll_multiple_choice', {
      question: 'Which framework do you prefer?',
      options: ['React', 'Vue', 'Svelte'],
    })) as Out;
    expect(out.presetId).toBeUndefined();
    expect(out.clipKind).toBe('live-poll-multiple-choice');
    expect(out.props.question).toBe('Which framework do you prefer?');
    expect(out.props.options).toEqual(['React', 'Vue', 'Svelte']);
  });

  it('schema rejects <2 options, >10 options, missing fields, extras', () => {
    const tool = getTool('compose_live_poll_multiple_choice');
    expect(() => tool.inputSchema.parse({ question: 'q', options: ['only-one'] })).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        question: 'q',
        options: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'],
      }),
    ).toThrow();
    expect(() => tool.inputSchema.parse({ options: ['a', 'b'] })).toThrow();
    expect(() =>
      tool.inputSchema.parse({ question: 'q', options: ['a', 'b'], rogue: 1 }),
    ).toThrow();
    expect(() => tool.inputSchema.parse({ question: '', options: ['a', 'b'] })).toThrow();
  });
});

describe('compose_live_poll_open_text', () => {
  it('happy path: minimal + with maxLength', async () => {
    const minimal = (await invoke('compose_live_poll_open_text', {
      question: 'What did you think?',
    })) as Out;
    expect(minimal.clipKind).toBe('live-poll-open-text');
    expect(minimal.props.question).toBe('What did you think?');
    expect(minimal.props.maxLength).toBeUndefined();

    const full = (await invoke('compose_live_poll_open_text', {
      question: 'Q',
      maxLength: 240,
    })) as Out;
    expect(full.props.maxLength).toBe(240);
  });

  it('schema rejects bad maxLength + extras', () => {
    const tool = getTool('compose_live_poll_open_text');
    expect(() => tool.inputSchema.parse({ question: 'q', maxLength: 0 })).toThrow();
    expect(() => tool.inputSchema.parse({ question: 'q', maxLength: 2001 })).toThrow();
    expect(() => tool.inputSchema.parse({ question: 'q', rogue: 'x' })).toThrow();
  });
});

describe('compose_live_poll_rating', () => {
  it('happy path: emits live-poll-rating with scale bounds', async () => {
    const out = (await invoke('compose_live_poll_rating', {
      question: 'Rate the talk',
      scaleMin: 1,
      scaleMax: 5,
    })) as Out;
    expect(out.clipKind).toBe('live-poll-rating');
    expect(out.props).toEqual({ question: 'Rate the talk', scaleMin: 1, scaleMax: 5 });
  });

  it('schema rejects scaleMax <= scaleMin + extras', () => {
    const tool = getTool('compose_live_poll_rating');
    expect(() => tool.inputSchema.parse({ question: 'q', scaleMin: 5, scaleMax: 5 })).toThrow();
    expect(() => tool.inputSchema.parse({ question: 'q', scaleMin: 5, scaleMax: 1 })).toThrow();
    expect(() =>
      tool.inputSchema.parse({ question: 'q', scaleMin: 1, scaleMax: 5, rogue: 1 }),
    ).toThrow();
  });
});

describe('compose_live_qa', () => {
  it('happy path: minimal + full', async () => {
    const minimal = (await invoke('compose_live_qa', { topic: 'Ask the panelists' })) as Out;
    expect(minimal.clipKind).toBe('live-qa');
    expect(minimal.props.topic).toBe('Ask the panelists');

    const full = (await invoke('compose_live_qa', {
      topic: 'Ask the panelists',
      allowUpvoting: true,
      moderationMode: 'pre-approve',
    })) as Out;
    expect(full.props.allowUpvoting).toBe(true);
    expect(full.props.moderationMode).toBe('pre-approve');
  });

  it('schema rejects bad moderationMode + extras', () => {
    const tool = getTool('compose_live_qa');
    expect(() => tool.inputSchema.parse({ topic: 't', moderationMode: 'maybe' })).toThrow();
    expect(() => tool.inputSchema.parse({ topic: 't', rogue: 1 })).toThrow();
  });

  it('QA_MODERATION_MODES has exactly 3 entries', () => {
    expect(QA_MODERATION_MODES).toEqual(['none', 'pre-approve', 'post-flag']);
  });
});

describe('compose_live_quiz', () => {
  it('happy path: minimal + with timer', async () => {
    const minimal = (await invoke('compose_live_quiz', {
      question: 'Capital of France?',
      options: ['Berlin', 'Paris', 'Rome'],
      correctIndex: 1,
    })) as Out;
    expect(minimal.clipKind).toBe('live-quiz');
    expect(minimal.props.correctIndex).toBe(1);

    const full = (await invoke('compose_live_quiz', {
      question: 'Capital of France?',
      options: ['Berlin', 'Paris', 'Rome'],
      correctIndex: 1,
      timerSeconds: 30,
    })) as Out;
    expect(full.props.timerSeconds).toBe(30);
  });

  it('schema rejects correctIndex >= options.length, bad timer, extras', () => {
    const tool = getTool('compose_live_quiz');
    expect(() =>
      tool.inputSchema.parse({ question: 'q', options: ['a', 'b'], correctIndex: 2 }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({ question: 'q', options: ['a', 'b'], correctIndex: -1 }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        question: 'q',
        options: ['a', 'b'],
        correctIndex: 0,
        timerSeconds: 0,
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        question: 'q',
        options: ['a', 'b'],
        correctIndex: 0,
        rogue: 'x',
      }),
    ).toThrow();
  });
});

describe('compose_leaderboard', () => {
  it('happy path: minimal + topN', async () => {
    const minimal = (await invoke('compose_leaderboard', {
      dataSourceClipId: 'clip-quiz-001',
    })) as Out;
    expect(minimal.clipKind).toBe('leaderboard');
    expect(minimal.props).toEqual({ dataSourceClipId: 'clip-quiz-001' });

    const full = (await invoke('compose_leaderboard', {
      dataSourceClipId: 'clip-quiz-001',
      topN: 10,
    })) as Out;
    expect(full.props.topN).toBe(10);
  });

  it('rejects vote-bearing inputs (LeaderboardVote = never per ADR-010 §D2)', () => {
    const tool = getTool('compose_leaderboard');
    // Any vote-shaped extras must fail strict-mode Zod.
    expect(() =>
      tool.inputSchema.parse({
        dataSourceClipId: 'clip-quiz-001',
        vote: { score: 100 },
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        dataSourceClipId: 'clip-quiz-001',
        votePayload: { kind: 'leaderboard' },
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        dataSourceClipId: 'clip-quiz-001',
        scores: [1, 2, 3],
      }),
    ).toThrow();
  });

  it('schema rejects missing dataSourceClipId, bad topN', () => {
    const tool = getTool('compose_leaderboard');
    expect(() => tool.inputSchema.parse({})).toThrow();
    expect(() => tool.inputSchema.parse({ dataSourceClipId: '', topN: 10 })).toThrow();
    expect(() => tool.inputSchema.parse({ dataSourceClipId: 'clip-1', topN: 0 })).toThrow();
    expect(() => tool.inputSchema.parse({ dataSourceClipId: 'clip-1', topN: 101 })).toThrow();
  });

  it('emitted props never contain a vote payload', async () => {
    const out = (await invoke('compose_leaderboard', {
      dataSourceClipId: 'clip-quiz-001',
      topN: 5,
    })) as Out;
    expect(Object.keys(out.props).sort()).toEqual(['dataSourceClipId', 'topN']);
  });
});

describe('compose_word_cloud', () => {
  it('happy path: minimal + maxWords', async () => {
    const minimal = (await invoke('compose_word_cloud', {
      prompt: 'Describe your mood',
    })) as Out;
    expect(minimal.clipKind).toBe('word-cloud');
    expect(minimal.props.prompt).toBe('Describe your mood');

    const full = (await invoke('compose_word_cloud', {
      prompt: 'Describe your mood',
      maxWords: 100,
    })) as Out;
    expect(full.props.maxWords).toBe(100);
  });

  it('schema rejects bad maxWords + extras', () => {
    const tool = getTool('compose_word_cloud');
    expect(() => tool.inputSchema.parse({ prompt: 'q', maxWords: 0 })).toThrow();
    expect(() => tool.inputSchema.parse({ prompt: 'q', maxWords: 501 })).toThrow();
    expect(() => tool.inputSchema.parse({ prompt: 'q', rogue: 'x' })).toThrow();
  });
});

describe('compose_survey', () => {
  it('happy path: 1..20 questions of mixed kinds', async () => {
    const out = (await invoke('compose_survey', {
      questions: [
        { kind: 'multiple-choice', prompt: 'Best framework?', options: ['React', 'Vue'] },
        { kind: 'open-text', prompt: 'Anything else?', maxLength: 240 },
        { kind: 'rating', prompt: 'How likely to recommend?', scaleMin: 0, scaleMax: 10 },
      ],
    })) as Out;
    expect(out.clipKind).toBe('survey');
    expect((out.props.questions as unknown[]).length).toBe(3);
  });

  it('schema rejects 0 questions, >20 questions, mc without options, rating without scale', () => {
    const tool = getTool('compose_survey');
    expect(() => tool.inputSchema.parse({ questions: [] })).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        questions: Array.from({ length: 21 }, () => ({
          kind: 'open-text' as const,
          prompt: 'q',
        })),
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        questions: [{ kind: 'multiple-choice', prompt: 'q' }],
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        questions: [{ kind: 'rating', prompt: 'q' }],
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        questions: [{ kind: 'rating', prompt: 'q', scaleMin: 5, scaleMax: 1 }],
      }),
    ).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        questions: [{ kind: 'open-text', prompt: 'q', rogue: 1 }],
      }),
    ).toThrow();
  });

  it('SURVEY_QUESTION_KINDS has exactly 3 entries', () => {
    expect(SURVEY_QUESTION_KINDS).toEqual(['multiple-choice', 'open-text', 'rating']);
  });
});

describe('compose_heatmap', () => {
  it('happy path: assetId variant + url variant', async () => {
    const a = (await invoke('compose_heatmap', {
      prompt: 'Tap the strongest argument',
      imageRef: { assetId: 'asset-12345' },
    })) as Out;
    expect(a.clipKind).toBe('heatmap');
    expect((a.props.imageRef as { assetId: string }).assetId).toBe('asset-12345');

    const b = (await invoke('compose_heatmap', {
      prompt: 'Tap the strongest argument',
      imageRef: { url: 'https://example.com/slide.png' },
    })) as Out;
    expect((b.props.imageRef as { url: string }).url).toBe('https://example.com/slide.png');
  });

  it('schema rejects imageRef with neither assetId nor url, extras, missing prompt', () => {
    const tool = getTool('compose_heatmap');
    expect(() => tool.inputSchema.parse({ prompt: 'q', imageRef: {} })).toThrow();
    expect(() =>
      tool.inputSchema.parse({ prompt: 'q', imageRef: { assetId: 'a', rogue: 1 } }),
    ).toThrow();
    expect(() => tool.inputSchema.parse({ imageRef: { assetId: 'a' } })).toThrow();
    expect(() =>
      tool.inputSchema.parse({ prompt: 'q', imageRef: { assetId: 'a' }, rogue: 1 }),
    ).toThrow();
  });
});

describe('compose_reaction_stream', () => {
  it('happy path: minimal + reactionSet', async () => {
    const minimal = (await invoke('compose_reaction_stream', {
      prompt: 'React to the speaker',
    })) as Out;
    expect(minimal.clipKind).toBe('reaction-stream');
    expect(minimal.props.reactionSet).toBeUndefined();

    const full = (await invoke('compose_reaction_stream', {
      prompt: 'React to the speaker',
      reactionSet: ['🔥', '❤️', '👏'],
    })) as Out;
    expect(full.props.reactionSet).toEqual(['🔥', '❤️', '👏']);
  });

  it('schema rejects empty reactionSet + extras', () => {
    const tool = getTool('compose_reaction_stream');
    expect(() => tool.inputSchema.parse({ prompt: 'q', reactionSet: [] })).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        prompt: 'q',
        reactionSet: Array.from({ length: 21 }, (_, i) => `r${i}`),
      }),
    ).toThrow();
    expect(() => tool.inputSchema.parse({ prompt: 'q', rogue: 1 })).toThrow();
  });
});

describe('compose_audience_ai_prompt', () => {
  it('happy path: emits audience-ai-prompt with both prompts', async () => {
    const out = (await invoke('compose_audience_ai_prompt', {
      basePrompt: 'A futuristic city',
      voterPromptTemplate: 'in the style of {voterTokens}',
    })) as Out;
    expect(out.clipKind).toBe('audience-ai-prompt');
    expect(out.props).toEqual({
      basePrompt: 'A futuristic city',
      voterPromptTemplate: 'in the style of {voterTokens}',
    });
  });

  it('schema rejects empty / over-length / extras', () => {
    const tool = getTool('compose_audience_ai_prompt');
    expect(() => tool.inputSchema.parse({ basePrompt: '', voterPromptTemplate: 't' })).toThrow();
    expect(() =>
      tool.inputSchema.parse({
        basePrompt: 'p'.repeat(2001),
        voterPromptTemplate: 't',
      }),
    ).toThrow();
    expect(() => tool.inputSchema.parse({ basePrompt: 'p' })).toThrow();
    expect(() =>
      tool.inputSchema.parse({ basePrompt: 'p', voterPromptTemplate: 't', rogue: 1 }),
    ).toThrow();
  });
});

describe('audience-engagement coverage', () => {
  it('every AudienceClipKind is reachable from at least one tool', async () => {
    const reached = new Set<AudienceClipKind>();
    const calls: Array<[string, unknown]> = [
      ['compose_live_poll_multiple_choice', { question: 'q', options: ['a', 'b'] }],
      ['compose_live_poll_open_text', { question: 'q' }],
      ['compose_live_poll_rating', { question: 'q', scaleMin: 1, scaleMax: 5 }],
      ['compose_live_qa', { topic: 'q' }],
      ['compose_live_quiz', { question: 'q', options: ['a', 'b'], correctIndex: 0 }],
      ['compose_leaderboard', { dataSourceClipId: 'clip-1' }],
      ['compose_word_cloud', { prompt: 'q' }],
      ['compose_survey', { questions: [{ kind: 'open-text', prompt: 'q' }] }],
      ['compose_heatmap', { prompt: 'q', imageRef: { assetId: 'a-1' } }],
      ['compose_reaction_stream', { prompt: 'q' }],
      ['compose_audience_ai_prompt', { basePrompt: 'p', voterPromptTemplate: 't' }],
    ];
    for (const [name, input] of calls) {
      const out = (await invoke(name, input)) as Out;
      reached.add(out.clipKind);
    }
    expect(reached).toEqual(new Set(AUDIENCE_CLIP_KINDS));
  });
});

describe('barrel + invariants', () => {
  it('handlers array length is 11', () => {
    expect(AUDIENCE_ENGAGEMENT_HANDLERS.length).toBe(11);
  });

  it('every handler declares bundle === "audience-engagement"', () => {
    for (const h of AUDIENCE_ENGAGEMENT_HANDLERS) {
      expect(h.bundle).toBe('audience-engagement');
    }
  });

  it('tool names within the bundle are unique', () => {
    const names = AUDIENCE_ENGAGEMENT_HANDLERS.map((h) => h.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every handler returns presetId === undefined (Cluster I T-486 fills this in later)', async () => {
    const samples: Array<[string, unknown]> = [
      ['compose_live_poll_multiple_choice', { question: 'q', options: ['a', 'b'] }],
      ['compose_live_poll_open_text', { question: 'q' }],
      ['compose_live_poll_rating', { question: 'q', scaleMin: 1, scaleMax: 5 }],
      ['compose_live_qa', { topic: 'q' }],
      ['compose_live_quiz', { question: 'q', options: ['a', 'b'], correctIndex: 0 }],
      ['compose_leaderboard', { dataSourceClipId: 'clip-1' }],
      ['compose_word_cloud', { prompt: 'q' }],
      ['compose_survey', { questions: [{ kind: 'open-text', prompt: 'q' }] }],
      ['compose_heatmap', { prompt: 'q', imageRef: { url: 'https://e.com/x.png' } }],
      ['compose_reaction_stream', { prompt: 'q' }],
      ['compose_audience_ai_prompt', { basePrompt: 'p', voterPromptTemplate: 't' }],
    ];
    for (const [name, input] of samples) {
      const out = (await invoke(name, input)) as Out;
      expect(out.presetId).toBeUndefined();
    }
  });

  it('determinism — same input twice yields deeply-equal output for each tool', async () => {
    const cases: Array<[string, unknown]> = [
      ['compose_live_poll_multiple_choice', { question: 'q', options: ['a', 'b'] }],
      ['compose_live_poll_open_text', { question: 'q', maxLength: 240 }],
      ['compose_live_poll_rating', { question: 'q', scaleMin: 0, scaleMax: 10 }],
      ['compose_live_qa', { topic: 't', allowUpvoting: true, moderationMode: 'none' }],
      [
        'compose_live_quiz',
        { question: 'q', options: ['a', 'b'], correctIndex: 1, timerSeconds: 30 },
      ],
      ['compose_leaderboard', { dataSourceClipId: 'c-1', topN: 5 }],
      ['compose_word_cloud', { prompt: 'q', maxWords: 100 }],
      [
        'compose_survey',
        {
          questions: [{ kind: 'rating', prompt: 'q', scaleMin: 1, scaleMax: 5 }],
        },
      ],
      ['compose_heatmap', { prompt: 'q', imageRef: { assetId: 'a-1' } }],
      ['compose_reaction_stream', { prompt: 'q', reactionSet: ['🔥'] }],
      ['compose_audience_ai_prompt', { basePrompt: 'p', voterPromptTemplate: 't' }],
    ];
    for (const [name, input] of cases) {
      const a = await invoke(name, input);
      const b = await invoke(name, input);
      expect(a).toEqual(b);
    }
  });

  it('read-only posture — every handler runs with bare ToolContext', async () => {
    const bareCtx: ToolContext = {};
    for (const h of AUDIENCE_ENGAGEMENT_HANDLERS) {
      // Pick a minimal valid input per handler.
      const sample = sampleFor(h.name);
      const parsed = h.inputSchema.parse(sample);
      const result = await h.handle(parsed, bareCtx);
      expect(result).toBeDefined();
    }
  });

  it('AUDIENCE_CLIP_KINDS contains exactly 11 entries', () => {
    expect(AUDIENCE_CLIP_KINDS.length).toBe(11);
  });
});

function sampleFor(name: string): unknown {
  switch (name) {
    case 'compose_live_poll_multiple_choice':
      return { question: 'q', options: ['a', 'b'] };
    case 'compose_live_poll_open_text':
      return { question: 'q' };
    case 'compose_live_poll_rating':
      return { question: 'q', scaleMin: 1, scaleMax: 5 };
    case 'compose_live_qa':
      return { topic: 't' };
    case 'compose_live_quiz':
      return { question: 'q', options: ['a', 'b'], correctIndex: 0 };
    case 'compose_leaderboard':
      return { dataSourceClipId: 'clip-1' };
    case 'compose_word_cloud':
      return { prompt: 'p' };
    case 'compose_survey':
      return { questions: [{ kind: 'open-text', prompt: 'q' }] };
    case 'compose_heatmap':
      return { prompt: 'p', imageRef: { assetId: 'a-1' } };
    case 'compose_reaction_stream':
      return { prompt: 'p' };
    case 'compose_audience_ai_prompt':
      return { basePrompt: 'p', voterPromptTemplate: 't' };
    default:
      throw new Error(`no sample for ${name}`);
  }
}
