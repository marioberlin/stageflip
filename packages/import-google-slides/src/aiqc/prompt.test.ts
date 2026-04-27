// packages/import-google-slides/src/aiqc/prompt.test.ts
// Per-element prompt-builder tests. ACs #9 / #10 / #11.

import { describe, expect, it } from 'vitest';
import type { PendingMatchResolution } from '../types.js';
import {
  AIQC_RESPONSE_SCHEMA_DESCRIPTION,
  AIQC_SYSTEM_PROMPT,
  buildLlmRequest,
  buildUserMessage,
  buildUserText,
} from './prompt.js';

const RESIDUAL: PendingMatchResolution = {
  slideId: 'slide_1',
  elementId: 'elt_a',
  apiElement: {
    id: 'elt_a',
    type: 'shape',
    shape: 'rect',
    transform: { x: 10, y: 20, width: 100, height: 40, rotation: 0, opacity: 1 },
    visible: true,
    locked: false,
    animations: [],
  },
  pageImageCropPx: { x: 100, y: 200, width: 300, height: 100 },
  rankedCandidates: [
    {
      candidateKind: 'textLine',
      candidateIndex: 0,
      contentConfidence: 0.7,
      positionConfidence: 0.8,
      zPenalty: 0,
      overallConfidence: 0.7,
    },
  ],
};

describe('buildUserMessage', () => {
  it('AC #9: emits exactly one image block then exactly one text block', () => {
    const msg = buildUserMessage({ residual: RESIDUAL, imageBase64: 'BASE64' });
    expect(msg.role).toBe('user');
    expect(Array.isArray(msg.content)).toBe(true);
    if (typeof msg.content === 'string') throw new Error('expected blocks');
    expect(msg.content).toHaveLength(2);
    expect(msg.content[0]?.type).toBe('image');
    expect(msg.content[1]?.type).toBe('text');
  });

  it('AC #10: image block carries the supplied base64 PNG bytes verbatim', () => {
    const msg = buildUserMessage({ residual: RESIDUAL, imageBase64: 'CAFEBABE' });
    if (typeof msg.content === 'string') throw new Error('expected blocks');
    const img = msg.content[0];
    expect(img).toEqual({
      type: 'image',
      mediaType: 'image/png',
      data: 'CAFEBABE',
    });
  });

  it('AC #11: text block contains apiElement, top candidate, and schema description', () => {
    const text = buildUserText(RESIDUAL);
    expect(text).toContain('"id": "elt_a"');
    expect(text).toContain('"shape": "rect"');
    expect(text).toContain('"candidateKind": "textLine"');
    expect(text).toContain('"overallConfidence": 0.7');
    expect(text).toContain(AIQC_RESPONSE_SCHEMA_DESCRIPTION);
  });

  it('embeds the crop bbox so Gemini knows which region to focus on', () => {
    const text = buildUserText(RESIDUAL);
    expect(text).toContain('"x": 100');
    expect(text).toContain('"y": 200');
    expect(text).toContain('"width": 300');
  });

  it('handles a residual with no ranked candidates', () => {
    const empty: PendingMatchResolution = { ...RESIDUAL, rankedCandidates: [] };
    const text = buildUserText(empty);
    expect(text).toContain('no candidates');
  });
});

describe('buildLlmRequest', () => {
  it('sets system prompt + max_tokens + model from inputs', () => {
    const req = buildLlmRequest({
      residual: RESIDUAL,
      imageBase64: 'X',
      model: 'gemini-2.0-flash',
      maxTokens: 1024,
    });
    expect(req.system).toBe(AIQC_SYSTEM_PROMPT);
    expect(req.max_tokens).toBe(1024);
    expect(req.model).toBe('gemini-2.0-flash');
    expect(req.messages).toHaveLength(1);
  });
});
