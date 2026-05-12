// packages/runtimes/audience/src/clips/audience-ai-prompt/export-frame.test.ts
// T-472 — Tests for the audience-ai-prompt SVG export-frame emitter.

import type { AudienceAiPromptAggregation } from '@stageflip/audience-contract';
import type { AudienceAiPromptClipElement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';

import {
  classifyPhase,
  formatTotalPromptsLabel,
  renderAudienceAiPromptExportFrame,
} from './export-frame.js';

const ELEMENT: AudienceAiPromptClipElement = {
  id: 'el-11',
  transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
  type: 'audience-ai-prompt',
  permissions: ['audience-network'],
  props: {
    prompt: 'Suggest an image',
    targetModality: 'image-gen',
    topN: 20,
    maxPromptLength: 200,
  },
};

const VOTING_SNAPSHOT: AudienceAiPromptAggregation = {
  kind: 'audience-ai-prompt',
  prompts: [
    { id: 'p1', text: 'A cat astronaut', upvotes: 7 },
    { id: 'p2', text: 'A neon city', upvotes: 4 },
  ],
  winnerPromptId: null,
  generatedAssetCacheKey: null,
};

const GENERATING_SNAPSHOT: AudienceAiPromptAggregation = {
  kind: 'audience-ai-prompt',
  prompts: [
    { id: 'p1', text: 'A cat astronaut', upvotes: 7 },
    { id: 'p2', text: 'A neon city', upvotes: 4 },
  ],
  winnerPromptId: 'p1',
  generatedAssetCacheKey: null,
};

const FINAL_SNAPSHOT: AudienceAiPromptAggregation = {
  kind: 'audience-ai-prompt',
  prompts: [
    { id: 'p1', text: 'A cat astronaut', upvotes: 7 },
    { id: 'p2', text: 'A neon city', upvotes: 4 },
  ],
  winnerPromptId: 'p1',
  generatedAssetCacheKey: 'cache://asset-1',
};

describe('classifyPhase', () => {
  it('returns voting when winnerPromptId is null', () => {
    expect(classifyPhase(VOTING_SNAPSHOT)).toBe('voting');
  });
  it('returns generating when winner is set but no asset yet', () => {
    expect(classifyPhase(GENERATING_SNAPSHOT)).toBe('generating');
  });
  it('returns final when both are set', () => {
    expect(classifyPhase(FINAL_SNAPSHOT)).toBe('final');
  });
});

describe('formatTotalPromptsLabel', () => {
  it('singular at 1 / plural otherwise', () => {
    expect(formatTotalPromptsLabel(1)).toBe('1 prompt');
    expect(formatTotalPromptsLabel(2)).toBe('2 prompts');
  });
});

describe('renderAudienceAiPromptExportFrame', () => {
  it('voting state renders the prompt list', () => {
    const out = renderAudienceAiPromptExportFrame(VOTING_SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('A cat astronaut');
    expect(out.svg).toContain('A neon city');
    expect(out.svg).toContain('>voting<');
  });

  it('generating state shows "Generating with AI…" + winner text', () => {
    const out = renderAudienceAiPromptExportFrame(GENERATING_SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('Generating with AI');
    expect(out.svg).toContain('A cat astronaut');
    expect(out.svg).toContain('>generating<');
  });

  it('final state includes the asset placeholder rect with cache-key + modality attrs', () => {
    const out = renderAudienceAiPromptExportFrame(FINAL_SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('>final<');
    expect(out.svg).toContain('Winner: A cat astronaut');
    expect(out.svg).toContain('data-cache-key="cache://asset-1"');
    expect(out.svg).toContain('data-modality="image-gen"');
  });

  it('renders the bottom total-prompts label', () => {
    const out = renderAudienceAiPromptExportFrame(VOTING_SNAPSHOT, ELEMENT);
    expect(out.svg).toContain('2 prompts');
  });

  it('is byte-deterministic', () => {
    const a = renderAudienceAiPromptExportFrame(FINAL_SNAPSHOT, ELEMENT);
    const b = renderAudienceAiPromptExportFrame(FINAL_SNAPSHOT, ELEMENT);
    expect(a.svg).toBe(b.svg);
  });

  it('handles empty prompt list', () => {
    const out = renderAudienceAiPromptExportFrame(
      {
        kind: 'audience-ai-prompt',
        prompts: [],
        winnerPromptId: null,
        generatedAssetCacheKey: null,
      },
      ELEMENT,
    );
    expect(out.svg).toContain('0 prompts');
    expect(out.svg).toContain('No prompts submitted');
  });
});
