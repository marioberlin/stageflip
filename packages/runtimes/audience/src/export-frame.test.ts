// packages/runtimes/audience/src/export-frame.test.ts
// T-472 — Dispatcher tests for `renderAudienceExportFrame`. Asserts
// the eleven `AggregationValue.kind` discriminants each route to
// their per-clip emitter, that the mismatch guard throws, and that
// `resolveExportFrameDimensions` + `escapeSvgText` behave as documented.

import type { AggregationValue } from '@stageflip/audience-contract';
import type {
  AudienceAiPromptClipElement,
  Element,
  HeatmapClipElement,
  LeaderboardClipElement,
  LivePollMultipleChoiceClipElement,
  LivePollOpenTextClipElement,
  LivePollRatingClipElement,
  LiveQAClipElement,
  LiveQuizClipElement,
  ReactionStreamClipElement,
  SurveyClipElement,
  WordCloudClipElement,
} from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXPORT_FRAME_HEIGHT,
  DEFAULT_EXPORT_FRAME_WIDTH,
  UnsupportedAudienceClipKindError,
  escapeSvgText,
  renderAudienceExportFrame,
  resolveExportFrameDimensions,
} from './export-frame.js';

function baseElement<T extends string>(
  type: T,
): {
  readonly id: string;
  readonly transform: Element['transform'];
  readonly visible: true;
  readonly locked: false;
  readonly animations: readonly never[];
  readonly type: T;
} {
  return {
    id: `el-${type}`,
    transform: { x: 0, y: 0, width: 800, height: 600, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
    type,
  };
}

const livePollMcEl: LivePollMultipleChoiceClipElement = {
  ...baseElement('live-poll-multiple-choice'),
  permissions: ['audience-network'],
  props: { question: 'Q', options: ['A', 'B'] },
};

const livePollOtEl: LivePollOpenTextClipElement = {
  ...baseElement('live-poll-open-text'),
  permissions: ['audience-network'],
  props: { question: 'Q', maxLength: 280, topN: 50 },
};

const livePollRatingEl: LivePollRatingClipElement = {
  ...baseElement('live-poll-rating'),
  permissions: ['audience-network'],
  props: { question: 'Q', scaleMin: 1, scaleMax: 5 },
};

const liveQaEl: LiveQAClipElement = {
  ...baseElement('live-qa'),
  permissions: ['audience-network'],
  props: { topic: 'T', allowUpvoting: true, maxLength: 500, topN: 100 },
};

const liveQuizEl: LiveQuizClipElement = {
  ...baseElement('live-quiz'),
  permissions: ['audience-network'],
  props: {
    questions: [{ id: 'q1', text: 'Q1', options: ['A', 'B'], correctOptionIndex: 0 }],
  },
};

const leaderboardEl: LeaderboardClipElement = {
  ...baseElement('leaderboard'),
  permissions: ['audience-network'],
  props: { quizId: 'quiz-1', topN: 10 },
};

const wordCloudEl: WordCloudClipElement = {
  ...baseElement('word-cloud'),
  permissions: ['audience-network'],
  props: { prompt: 'P', maxWords: 100, maxWordsPerVoter: 3 },
};

const surveyEl: SurveyClipElement = {
  ...baseElement('survey'),
  permissions: ['audience-network'],
  props: {
    questions: [{ id: 'sq1', type: 'multiple-choice', text: 'Q1', options: ['A', 'B'] }],
  },
};

const heatmapEl: HeatmapClipElement = {
  ...baseElement('heatmap'),
  permissions: ['audience-network'],
  props: {
    prompt: 'P',
    imageRef: 'cache://img',
    maxIntensity: 1,
    gridResolution: { w: 64, h: 36 },
  },
};

const reactionStreamEl: ReactionStreamClipElement = {
  ...baseElement('reaction-stream'),
  permissions: ['audience-network'],
  props: {
    prompt: 'P',
    palette: [{ emojiId: 'thumbs-up', glyph: '👍' }],
  },
};

const audienceAiEl: AudienceAiPromptClipElement = {
  ...baseElement('audience-ai-prompt'),
  permissions: ['audience-network'],
  props: { prompt: 'P', targetModality: 'image-gen', topN: 20, maxPromptLength: 200 },
};

const livePollMcSnap: AggregationValue = {
  kind: 'live-poll-multiple-choice',
  optionCounts: [3, 2],
  totalVotes: 5,
};
const livePollOtSnap: AggregationValue = {
  kind: 'live-poll-open-text',
  entries: [{ text: 'yes', count: 4 }],
  totalVotes: 4,
};
const livePollRatingSnap: AggregationValue = {
  kind: 'live-poll-rating',
  scoreCounts: [0, 0, 1, 2, 0],
  totalVotes: 3,
  mean: 3.67,
};
const liveQaSnap: AggregationValue = {
  kind: 'live-qa',
  questions: [{ id: 'q1', text: 'Why?', upvotes: 5, submittedAt: '2026-05-12T00:00:00Z' }],
  totalQuestions: 1,
};
const liveQuizSnap: AggregationValue = {
  kind: 'live-quiz',
  activeQuestionId: 'q1',
  questionResults: [
    {
      questionId: 'q1',
      optionCounts: [3, 1],
      correctOptionIndex: 0,
      totalVotes: 4,
      status: 'closed',
    },
  ],
  totalVoters: 4,
};
const leaderboardSnap: AggregationValue = {
  kind: 'leaderboard',
  quizId: 'quiz-1',
  ranking: [
    { voterToken: 'v1', displayName: 'Alice', score: 100, rank: 1 },
    { voterToken: 'v2', score: 80, rank: 2 },
  ],
  totalParticipants: 2,
};
const wordCloudSnap: AggregationValue = {
  kind: 'word-cloud',
  words: [{ word: 'cat', weight: 5 }],
  totalSubmissions: 5,
};
const surveySnap: AggregationValue = {
  kind: 'survey',
  questionAggregations: [
    {
      questionId: 'sq1',
      type: 'multiple-choice',
      aggregation: { kind: 'live-poll-multiple-choice', optionCounts: [2, 1], totalVotes: 3 },
    },
  ],
  totalResponses: 3,
};
const heatmapSnap: AggregationValue = {
  kind: 'heatmap',
  taps: [{ x: 0.5, y: 0.5, intensity: 1 }],
  totalTaps: 1,
  gridResolution: { w: 64, h: 36 },
};
const reactionStreamSnap: AggregationValue = {
  kind: 'reaction-stream',
  emojiCounts: [{ emojiId: 'thumbs-up', count: 3, recentBurst: 1 }],
  totalReactions: 3,
};
const audienceAiSnap: AggregationValue = {
  kind: 'audience-ai-prompt',
  prompts: [{ id: 'p1', text: 'A cat', upvotes: 4 }],
  winnerPromptId: null,
  generatedAssetCacheKey: null,
};

describe('renderAudienceExportFrame', () => {
  it.each([
    ['live-poll-multiple-choice', livePollMcSnap, livePollMcEl as Element],
    ['live-poll-open-text', livePollOtSnap, livePollOtEl as Element],
    ['live-poll-rating', livePollRatingSnap, livePollRatingEl as Element],
    ['live-qa', liveQaSnap, liveQaEl as Element],
    ['live-quiz', liveQuizSnap, liveQuizEl as Element],
    ['leaderboard', leaderboardSnap, leaderboardEl as Element],
    ['word-cloud', wordCloudSnap, wordCloudEl as Element],
    ['survey', surveySnap, surveyEl as Element],
    ['heatmap', heatmapSnap, heatmapEl as Element],
    ['reaction-stream', reactionStreamSnap, reactionStreamEl as Element],
    ['audience-ai-prompt', audienceAiSnap, audienceAiEl as Element],
  ])('dispatches the %s kind to a well-formed SVG export-frame', (_kind, snapshot, element) => {
    const out = renderAudienceExportFrame(snapshot, element);
    expect(out.svg.startsWith('<svg')).toBe(true);
    expect(out.svg.endsWith('</svg>')).toBe(true);
    expect(out.width).toBeGreaterThan(0);
    expect(out.height).toBeGreaterThan(0);
  });

  it('throws UnsupportedAudienceClipKindError on element-type / snapshot-kind mismatch', () => {
    expect(() => renderAudienceExportFrame(livePollMcSnap, livePollOtEl as Element)).toThrow(
      UnsupportedAudienceClipKindError,
    );
  });

  it('is byte-deterministic across two calls with identical input', () => {
    const a = renderAudienceExportFrame(livePollMcSnap, livePollMcEl as Element);
    const b = renderAudienceExportFrame(livePollMcSnap, livePollMcEl as Element);
    expect(a.svg).toBe(b.svg);
    expect(a.width).toBe(b.width);
    expect(a.height).toBe(b.height);
    expect(a.voterCountAtCapture).toBe(b.voterCountAtCapture);
  });
});

describe('resolveExportFrameDimensions', () => {
  it('returns the element transform when positive', () => {
    expect(
      resolveExportFrameDimensions({
        ...(livePollMcEl as Element),
        transform: { ...livePollMcEl.transform, width: 400, height: 200 },
      }),
    ).toEqual({ width: 400, height: 200 });
  });

  it('falls back to the 1920×1080 default when transform dimensions are non-finite', () => {
    expect(
      resolveExportFrameDimensions({
        ...(livePollMcEl as Element),
        // Schema validation excludes these values; the runtime guard is defensive.
        transform: {
          ...livePollMcEl.transform,
          width: Number.NaN as unknown as number,
          height: Number.NaN as unknown as number,
        },
      }),
    ).toEqual({ width: DEFAULT_EXPORT_FRAME_WIDTH, height: DEFAULT_EXPORT_FRAME_HEIGHT });
  });
});

describe('escapeSvgText', () => {
  it('escapes the five XML-significant characters', () => {
    expect(escapeSvgText(`<a href="x&y">it's</a>`)).toBe(
      '&lt;a href=&quot;x&amp;y&quot;&gt;it&apos;s&lt;/a&gt;',
    );
  });

  it('leaves plain text unchanged', () => {
    expect(escapeSvgText('Hello world')).toBe('Hello world');
  });
});
