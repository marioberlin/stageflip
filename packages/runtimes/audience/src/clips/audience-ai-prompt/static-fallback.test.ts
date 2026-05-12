// packages/runtimes/audience/src/clips/audience-ai-prompt/static-fallback.test.ts
// T-471 — Static-fallback tests for the `audience-ai-prompt` clip.
// Asserts the three-state dispatcher (voting / generating / final),
// per-modality asset rendering, prompt feed shape, and structural
// determinism.

/**
 * @vitest-environment happy-dom
 */

import type { AudienceAiPromptAggregation } from '@stageflip/audience-contract';
import type { AudienceAiPromptTargetModality } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import {
  formatTotalPromptsLabel,
  renderAudienceAiPromptStaticFallback,
} from './static-fallback.js';

const PROMPTS = [
  { id: 'p1', text: 'A sunset over mountains', upvotes: 18 },
  { id: 'p2', text: 'A cat in space', upvotes: 12 },
  { id: 'p3', text: 'Northern lights', upvotes: 8 },
];

const VOTING_SNAPSHOT: AudienceAiPromptAggregation = {
  kind: 'audience-ai-prompt',
  prompts: PROMPTS,
  winnerPromptId: null,
  generatedAssetCacheKey: null,
};

const GENERATING_SNAPSHOT: AudienceAiPromptAggregation = {
  kind: 'audience-ai-prompt',
  prompts: PROMPTS,
  winnerPromptId: 'p1',
  generatedAssetCacheKey: null,
};

const FINAL_SNAPSHOT: AudienceAiPromptAggregation = {
  kind: 'audience-ai-prompt',
  prompts: PROMPTS,
  winnerPromptId: 'p1',
  generatedAssetCacheKey: 'cache://video/abc123',
};

function makeCtx(targetModality: AudienceAiPromptTargetModality) {
  return {
    width: 800,
    height: 600,
    prompt: 'What should we generate next?',
    targetModality,
  };
}

describe('formatTotalPromptsLabel', () => {
  it('uses singular for exactly 1 prompt', () => {
    expect(formatTotalPromptsLabel(1)).toBe('1 prompt');
  });
  it('uses plural for 0 / >1 prompts', () => {
    expect(formatTotalPromptsLabel(0)).toBe('0 prompts');
    expect(formatTotalPromptsLabel(3)).toBe('3 prompts');
  });
});

describe('renderAudienceAiPromptStaticFallback — voting phase', () => {
  it('returns a ReactElement marked as the audience-ai-prompt root', () => {
    const out = renderAudienceAiPromptStaticFallback({
      snapshot: VOTING_SNAPSHOT,
      context: makeCtx('video-gen'),
      props: { targetModality: 'video-gen' },
    });
    expect(out.type).toBe('div');
    expect((out.props as { 'data-stageflip-clip': string })['data-stageflip-clip']).toBe(
      'audience-ai-prompt',
    );
    expect((out.props as { 'data-state': string })['data-state']).toBe('voting');
  });

  it('emits a phase marker with text "voting"', () => {
    const out = renderAudienceAiPromptStaticFallback({
      snapshot: VOTING_SNAPSHOT,
      context: makeCtx('video-gen'),
      props: { targetModality: 'video-gen' },
    });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('"data-testid":"aip-state"');
    expect(json).toContain('"voting"');
  });

  it('renders the full prompt feed', () => {
    const out = renderAudienceAiPromptStaticFallback({
      snapshot: VOTING_SNAPSHOT,
      context: makeCtx('video-gen'),
      props: { targetModality: 'video-gen' },
    });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('A sunset over mountains');
    expect(json).toContain('A cat in space');
    expect(json).toContain('Northern lights');
  });

  it('renders the total label with correct plural', () => {
    const out = renderAudienceAiPromptStaticFallback({
      snapshot: VOTING_SNAPSHOT,
      context: makeCtx('video-gen'),
      props: { targetModality: 'video-gen' },
    });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('3 prompts');
  });

  it('does NOT render any asset element in the voting phase', () => {
    const out = renderAudienceAiPromptStaticFallback({
      snapshot: VOTING_SNAPSHOT,
      context: makeCtx('video-gen'),
      props: { targetModality: 'video-gen' },
    });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).not.toContain('"aip-asset"');
  });

  it('is deterministic — same input produces structurally-equal trees', () => {
    const a = renderAudienceAiPromptStaticFallback({
      snapshot: VOTING_SNAPSHOT,
      context: makeCtx('video-gen'),
      props: { targetModality: 'video-gen' },
    });
    const b = renderAudienceAiPromptStaticFallback({
      snapshot: VOTING_SNAPSHOT,
      context: makeCtx('video-gen'),
      props: { targetModality: 'video-gen' },
    });
    const replacer = (_k: string, v: unknown): unknown => (typeof v === 'function' ? '[fn]' : v);
    expect(JSON.stringify(a, replacer)).toEqual(JSON.stringify(b, replacer));
  });
});

describe('renderAudienceAiPromptStaticFallback — generating phase', () => {
  it('marks the root as data-state="generating"', () => {
    const out = renderAudienceAiPromptStaticFallback({
      snapshot: GENERATING_SNAPSHOT,
      context: makeCtx('video-gen'),
      props: { targetModality: 'video-gen' },
    });
    expect((out.props as { 'data-state': string })['data-state']).toBe('generating');
  });

  it('renders the "Generating with AI…" placeholder + the winner text', () => {
    const out = renderAudienceAiPromptStaticFallback({
      snapshot: GENERATING_SNAPSHOT,
      context: makeCtx('video-gen'),
      props: { targetModality: 'video-gen' },
    });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('Generating with AI…');
    expect(json).toContain('A sunset over mountains');
  });

  it('does NOT render any asset element in the generating phase', () => {
    const out = renderAudienceAiPromptStaticFallback({
      snapshot: GENERATING_SNAPSHOT,
      context: makeCtx('video-gen'),
      props: { targetModality: 'video-gen' },
    });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).not.toContain('"aip-asset"');
  });
});

describe('renderAudienceAiPromptStaticFallback — final phase', () => {
  it('marks the root as data-state="final"', () => {
    const out = renderAudienceAiPromptStaticFallback({
      snapshot: FINAL_SNAPSHOT,
      context: makeCtx('video-gen'),
      props: { targetModality: 'video-gen' },
    });
    expect((out.props as { 'data-state': string })['data-state']).toBe('final');
  });

  it('renders the winner banner with the winner text', () => {
    const out = renderAudienceAiPromptStaticFallback({
      snapshot: FINAL_SNAPSHOT,
      context: makeCtx('video-gen'),
      props: { targetModality: 'video-gen' },
    });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('"data-testid":"aip-winner"');
    expect(json).toContain('A sunset over mountains');
  });

  it('renders a <video> element for targetModality="video-gen"', () => {
    const out = renderAudienceAiPromptStaticFallback({
      snapshot: FINAL_SNAPSHOT,
      context: makeCtx('video-gen'),
      props: { targetModality: 'video-gen' },
    });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('"type":"video"');
    expect(json).toContain('"data-testid":"aip-asset"');
    expect(json).toContain('"data-cache-key":"cache://video/abc123"');
    expect(json).toContain('"data-modality":"video-gen"');
  });

  it('renders an <audio> element for targetModality="music-gen"', () => {
    const out = renderAudienceAiPromptStaticFallback({
      snapshot: { ...FINAL_SNAPSHOT, generatedAssetCacheKey: 'cache://music/xyz' },
      context: makeCtx('music-gen'),
      props: { targetModality: 'music-gen' },
    });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('"type":"audio"');
    expect(json).toContain('"data-modality":"music-gen"');
    expect(json).toContain('"data-cache-key":"cache://music/xyz"');
  });

  it('renders an <audio> element for targetModality="tts"', () => {
    const out = renderAudienceAiPromptStaticFallback({
      snapshot: { ...FINAL_SNAPSHOT, generatedAssetCacheKey: 'cache://tts/voice' },
      context: makeCtx('tts'),
      props: { targetModality: 'tts' },
    });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('"type":"audio"');
    expect(json).toContain('"data-modality":"tts"');
  });

  it('renders an <img> element for targetModality="image-gen"', () => {
    const out = renderAudienceAiPromptStaticFallback({
      snapshot: { ...FINAL_SNAPSHOT, generatedAssetCacheKey: 'cache://image/sun' },
      context: makeCtx('image-gen'),
      props: { targetModality: 'image-gen' },
    });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('"type":"img"');
    expect(json).toContain('"data-modality":"image-gen"');
    expect(json).toContain('"data-cache-key":"cache://image/sun"');
    expect(json).toContain('"alt":"A sunset over mountains"');
  });

  it('renders the full prompt feed below the asset', () => {
    const out = renderAudienceAiPromptStaticFallback({
      snapshot: FINAL_SNAPSHOT,
      context: makeCtx('video-gen'),
      props: { targetModality: 'video-gen' },
    });
    const json = JSON.stringify(out, (_k, v) => (typeof v === 'function' ? '[fn]' : v));
    expect(json).toContain('A sunset over mountains');
    expect(json).toContain('A cat in space');
    expect(json).toContain('Northern lights');
    expect(json).toContain('3 prompts');
  });
});
