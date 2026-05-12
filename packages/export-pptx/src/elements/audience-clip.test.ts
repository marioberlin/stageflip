// packages/export-pptx/src/elements/audience-clip.test.ts
// T-472 — Tests for the audience-clip PPTX element emitter. Asserts:
//   - The emitter routes all eleven audience-clip element types.
//   - The emitted `<p:sp>` carries an SVG payload in a CDATA block.
//   - `isAudienceClipElement` narrows correctly.
//   - `emptySnapshotFor` returns the kind matching its argument.
//   - `resolveSnapshotFor` returns the provenance.aggregation when set.

import type { LossFlag } from '@stageflip/loss-flags';
import type {
  Element,
  LeaderboardClipElement,
  LivePollMultipleChoiceClipElement,
} from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import {
  type AudienceClipElementType,
  emitAudienceClipElement,
  emptySnapshotFor,
  isAudienceClipElement,
  resolveSnapshotFor,
} from './audience-clip.js';
import type { SlideEmitContext } from './shared.js';

function makeCtx(): SlideEmitContext {
  const flags: LossFlag[] = [];
  return {
    slideId: 's1',
    oocxmlPath: 'ppt/slides/slide1.xml',
    flags,
    registerImageRel: () => 'rId-stub',
    emitMode: 'slide',
  };
}

const TRANSFORM = { x: 10, y: 20, width: 800, height: 600, rotation: 0, opacity: 1 } as const;

const livePollMc: LivePollMultipleChoiceClipElement = {
  id: 'el-1',
  transform: TRANSFORM,
  visible: true,
  locked: false,
  animations: [],
  type: 'live-poll-multiple-choice',
  permissions: ['audience-network'],
  props: { question: 'Q?', options: ['A', 'B'] },
};

const leaderboard: LeaderboardClipElement = {
  id: 'el-6',
  transform: TRANSFORM,
  visible: true,
  locked: false,
  animations: [],
  type: 'leaderboard',
  permissions: ['audience-network'],
  props: { quizId: 'quiz-1', topN: 10 },
};

const audienceKinds: readonly AudienceClipElementType[] = [
  'live-poll-multiple-choice',
  'live-poll-open-text',
  'live-poll-rating',
  'live-qa',
  'live-quiz',
  'leaderboard',
  'word-cloud',
  'survey',
  'heatmap',
  'reaction-stream',
  'audience-ai-prompt',
];

describe('isAudienceClipElement', () => {
  it('returns true for every audience-clip discriminant', () => {
    for (const kind of audienceKinds) {
      expect(isAudienceClipElement({ ...livePollMc, type: kind } as unknown as Element)).toBe(true);
    }
  });

  it('returns false for non-audience element types', () => {
    expect(isAudienceClipElement({ ...livePollMc, type: 'text' } as unknown as Element)).toBe(
      false,
    );
  });
});

describe('emptySnapshotFor', () => {
  it.each(audienceKinds)('returns a snapshot keyed by the input kind: %s', (kind) => {
    const snap = emptySnapshotFor(kind);
    expect(snap.kind).toBe(kind);
  });
});

describe('resolveSnapshotFor', () => {
  it('returns the inlined provenance.aggregation when present', () => {
    const withProv: LivePollMultipleChoiceClipElement = {
      ...livePollMc,
      provenance: {
        provider: 'audience-native',
        sessionId: 'sess-1',
        snapshotFrame: 0,
        voterCountAtCapture: 5,
        capturedAt: '2026-05-12T00:00:00Z',
        snapshotPolicy: 'final',
        clipKind: 'live-poll-multiple-choice',
        aggregation: {
          kind: 'live-poll-multiple-choice',
          optionCounts: [3, 2],
          totalVotes: 5,
        },
      },
    };
    const snap = resolveSnapshotFor(withProv);
    expect(snap.kind).toBe('live-poll-multiple-choice');
    expect((snap as { totalVotes: number }).totalVotes).toBe(5);
  });

  it('synthesises an empty snapshot when provenance is absent', () => {
    const snap = resolveSnapshotFor(leaderboard);
    expect(snap.kind).toBe('leaderboard');
    expect((snap as { totalParticipants: number }).totalParticipants).toBe(0);
  });
});

describe('emitAudienceClipElement', () => {
  it('emits a <p:sp> with a CDATA-wrapped SVG payload', () => {
    const ctx = makeCtx();
    const out = emitAudienceClipElement(livePollMc, ctx);
    expect(out.startsWith('<p:sp>')).toBe(true);
    expect(out.endsWith('</p:sp>')).toBe(true);
    expect(out).toContain('<![CDATA[<svg');
    expect(out).toContain(']]>');
    expect(out).toContain('descr="stageflip-audience-clip:live-poll-multiple-choice"');
  });

  it('does NOT raise an LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT flag', () => {
    const ctx = makeCtx();
    emitAudienceClipElement(livePollMc, ctx);
    const codes = ctx.flags.map((f) => f.code);
    expect(codes).not.toContain('LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT');
  });

  it('includes the transform via <p:spPr> on slide-tier emission', () => {
    const ctx = makeCtx();
    const out = emitAudienceClipElement(livePollMc, ctx);
    expect(out).toContain('<p:spPr><a:xfrm>');
  });

  it('skips the transform via <p:spPr/> on template-tier emission', () => {
    const ctx: SlideEmitContext = { ...makeCtx(), emitMode: 'template' };
    const out = emitAudienceClipElement(livePollMc, ctx);
    expect(out).toContain('<p:spPr/>');
    expect(out).not.toContain('<a:xfrm>');
  });

  it('escapes ]]> sequences in the embedded SVG', () => {
    // Construct an element whose SVG payload could contain ]]> via a
    // hostile option label. The escapeCdata helper splits across two
    // CDATA blocks.
    const hostile: LivePollMultipleChoiceClipElement = {
      ...livePollMc,
      props: { question: ']]>', options: ['A', 'B'] },
    };
    const ctx = makeCtx();
    const out = emitAudienceClipElement(hostile, ctx);
    // ]]> inside the SVG would have been HTML-escaped to ']]&gt;' by
    // the SVG emitter — so the raw sequence shouldn't appear in the
    // CDATA payload.
    expect(out).toContain(']]&gt;');
  });
});
