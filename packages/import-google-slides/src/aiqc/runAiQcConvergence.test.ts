// packages/import-google-slides/src/aiqc/runAiQcConvergence.test.ts
// Integration tests for runAiQcConvergence. ACs #6 / #7 / #8 / #21 / #22 /
// #23 / #24 / #25 / #26 / #28 / #30.

import type { ShapeElement } from '@stageflip/schema';
import { describe, expect, it } from 'vitest';
import type { CanonicalSlideTree, ParsedSlide, PendingMatchResolution } from '../types.js';
import { collectResiduals, runAiQcConvergence } from './runAiQcConvergence.js';
import { createStubGeminiProvider } from './stub-provider.js';
import type { GeminiResolutionResponse } from './types.js';

const SHAPE: ShapeElement = {
  id: 'el_1',
  type: 'shape',
  shape: 'rect',
  transform: { x: 0, y: 0, width: 100, height: 50, rotation: 0, opacity: 1 },
  visible: true,
  locked: false,
  animations: [],
};

function makeResidual(slideId: string, elementId: string): PendingMatchResolution {
  return {
    slideId,
    elementId,
    apiElement: { ...SHAPE, id: elementId },
    pageImageCropPx: { x: 10, y: 10, width: 50, height: 30 },
    rankedCandidates: [],
  };
}

function makeTree(args: {
  slides: Array<{ id: string; elements: Array<{ id: string }> }>;
  pending: Record<string, Record<string, PendingMatchResolution>>;
}): CanonicalSlideTree {
  const slides: ParsedSlide[] = args.slides.map((s) => ({
    id: s.id,
    elements: s.elements.map((e) => ({ ...SHAPE, id: e.id })),
  }));
  const pageImagesPng: Record<string, { bytes: Uint8Array; width: number; height: number }> = {};
  for (const s of args.slides) {
    pageImagesPng[s.id] = {
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), // PNG magic — non-empty
      width: 100,
      height: 50,
    };
  }
  return {
    slides,
    layouts: {},
    masters: {},
    lossFlags: [],
    pendingResolution: args.pending,
    pageImagesPng,
    assetsResolved: false,
  };
}

const RESOLVED_TEXT: GeminiResolutionResponse = {
  confidence: 0.95,
  resolvedKind: 'text',
  text: 'Quarterly Goals',
  fillColor: null,
  shapeKind: null,
  reasoning: 'text region',
};

const LOW_CONF: GeminiResolutionResponse = {
  confidence: 0.5,
  resolvedKind: 'text',
  text: 'Maybe Goals',
  fillColor: null,
  shapeKind: null,
  reasoning: 'unsure',
};

describe('AC #7: empty pendingResolution returns immediately', () => {
  it('no calls, no flags, no resolutions', async () => {
    const tree = makeTree({
      slides: [{ id: 'slide_1', elements: [{ id: 'el_1' }] }],
      pending: {},
    });
    const llm = createStubGeminiProvider({
      factory: () => ({ kind: 'text', text: '' }),
    });
    const result = await runAiQcConvergence(tree, { llm });
    expect(result.callsMade).toBe(0);
    expect(result.resolutions).toEqual([]);
    expect(result.lossFlags).toEqual([]);
    expect(llm.callCount).toBe(0);
  });
});

describe('AC #8: one residual resolved cleanly', () => {
  it('writes back, drops residual, no loss flags', async () => {
    const residual = makeResidual('slide_1', 'el_1');
    const tree = makeTree({
      slides: [{ id: 'slide_1', elements: [{ id: 'el_1' }] }],
      pending: { slide_1: { el_1: residual } },
    });
    const llm = createStubGeminiProvider({
      factory: () => ({ kind: 'text', text: JSON.stringify(RESOLVED_TEXT) }),
    });
    const result = await runAiQcConvergence(tree, { llm });
    expect(result.callsMade).toBe(1);
    expect(result.lossFlags).toEqual([]);
    expect(result.tree.pendingResolution).toEqual({});
    const slide = result.tree.slides[0];
    expect(slide?.elements[0]?.type).toBe('text');
    if (slide?.elements[0]?.type === 'text') {
      expect(slide.elements[0].text).toBe('Quarterly Goals');
      expect(slide.elements[0].id).toBe('el_1');
    }
    expect(result.resolutions[0]?.outcome).toBe('resolved');
  });
});

describe('AC #21: resolved residual is removed from pendingResolution', () => {
  it('shrinks the array entry; cleans empty slide entries', async () => {
    const r1 = makeResidual('slide_1', 'el_1');
    const r2 = makeResidual('slide_1', 'el_2');
    const tree = makeTree({
      slides: [{ id: 'slide_1', elements: [{ id: 'el_1' }, { id: 'el_2' }] }],
      pending: { slide_1: { el_1: r1, el_2: r2 } },
    });
    const llm = createStubGeminiProvider({
      factory: (_req, idx) => {
        // Resolve only el_1; el_2 stays low-confidence.
        return idx === 0
          ? { kind: 'text', text: JSON.stringify(RESOLVED_TEXT) }
          : { kind: 'text', text: JSON.stringify(LOW_CONF) };
      },
    });
    const result = await runAiQcConvergence(tree, { llm });
    expect(result.callsMade).toBe(2);
    expect(result.tree.pendingResolution).toEqual({ slide_1: { el_2: r2 } });
  });
});

describe('AC #22 + AC #24: cost cap', () => {
  it('with maxCallsPerDeck=2 and 5 residuals, fires 2 calls and skips 3', async () => {
    const residuals: Record<string, Record<string, PendingMatchResolution>> = {
      slide_1: {
        el_1: makeResidual('slide_1', 'el_1'),
        el_2: makeResidual('slide_1', 'el_2'),
        el_3: makeResidual('slide_1', 'el_3'),
        el_4: makeResidual('slide_1', 'el_4'),
        el_5: makeResidual('slide_1', 'el_5'),
      },
    };
    const tree = makeTree({
      slides: [
        {
          id: 'slide_1',
          elements: [
            { id: 'el_1' },
            { id: 'el_2' },
            { id: 'el_3' },
            { id: 'el_4' },
            { id: 'el_5' },
          ],
        },
      ],
      pending: residuals,
    });
    const llm = createStubGeminiProvider({
      factory: () => ({ kind: 'text', text: JSON.stringify(RESOLVED_TEXT) }),
    });
    const result = await runAiQcConvergence(tree, { llm, maxCallsPerDeck: 2 });
    expect(llm.callCount).toBe(2);
    expect(result.callsMade).toBe(2);
    const skipped = result.resolutions.filter((r) => r.outcome === 'skipped-cap');
    expect(skipped).toHaveLength(3);
    const lowConfFlags = result.lossFlags.filter(
      (f) => f.code === 'LF-GSLIDES-LOW-MATCH-CONFIDENCE',
    );
    expect(lowConfFlags).toHaveLength(3);
  });
});

describe('AC #23: deck-level cap-hit summary flag', () => {
  it('emits LF-GSLIDES-AI-QC-CAP-HIT exactly once when the cap is hit', async () => {
    const tree = makeTree({
      slides: [{ id: 'slide_1', elements: [{ id: 'el_1' }, { id: 'el_2' }] }],
      pending: {
        slide_1: {
          el_1: makeResidual('slide_1', 'el_1'),
          el_2: makeResidual('slide_1', 'el_2'),
        },
      },
    });
    const llm = createStubGeminiProvider({
      factory: () => ({ kind: 'text', text: JSON.stringify(RESOLVED_TEXT) }),
    });
    const result = await runAiQcConvergence(tree, { llm, maxCallsPerDeck: 1 });
    const capFlags = result.lossFlags.filter((f) => f.code === 'LF-GSLIDES-AI-QC-CAP-HIT');
    expect(capFlags).toHaveLength(1);
    expect(capFlags[0]?.severity).toBe('warn');
  });

  it('does NOT emit the cap-hit summary flag when the cap is not exceeded', async () => {
    const tree = makeTree({
      slides: [{ id: 'slide_1', elements: [{ id: 'el_1' }] }],
      pending: { slide_1: { el_1: makeResidual('slide_1', 'el_1') } },
    });
    const llm = createStubGeminiProvider({
      factory: () => ({ kind: 'text', text: JSON.stringify(RESOLVED_TEXT) }),
    });
    const result = await runAiQcConvergence(tree, { llm, maxCallsPerDeck: 5 });
    const capFlags = result.lossFlags.filter((f) => f.code === 'LF-GSLIDES-AI-QC-CAP-HIT');
    expect(capFlags).toHaveLength(0);
  });
});

describe('AC #25: low-confidence response keeps residual + emits LF-GSLIDES-LOW-MATCH-CONFIDENCE', () => {
  it('does not write back; flags one per residual', async () => {
    const residual = makeResidual('slide_1', 'el_1');
    const tree = makeTree({
      slides: [{ id: 'slide_1', elements: [{ id: 'el_1' }] }],
      pending: { slide_1: { el_1: residual } },
    });
    const llm = createStubGeminiProvider({
      factory: () => ({ kind: 'text', text: JSON.stringify(LOW_CONF) }),
    });
    const result = await runAiQcConvergence(tree, { llm });
    expect(result.tree.pendingResolution).toEqual({ slide_1: { el_1: residual } });
    expect(result.lossFlags).toHaveLength(1);
    expect(result.lossFlags[0]?.code).toBe('LF-GSLIDES-LOW-MATCH-CONFIDENCE');
    expect(result.lossFlags[0]?.source).toBe('gslides');
    expect(result.resolutions[0]?.outcome).toBe('rejected-low-confidence');
    expect(result.resolutions[0]?.geminiConfidence).toBe(0.5);
  });
});

describe('AC #25: malformed response emits LF-GSLIDES-LOW-MATCH-CONFIDENCE with errorCode', () => {
  it('records errorCode=MALFORMED_RESPONSE', async () => {
    const tree = makeTree({
      slides: [{ id: 'slide_1', elements: [{ id: 'el_1' }] }],
      pending: { slide_1: { el_1: makeResidual('slide_1', 'el_1') } },
    });
    const llm = createStubGeminiProvider({
      factory: () => ({ kind: 'text', text: 'I think this is a button.' }),
    });
    const result = await runAiQcConvergence(tree, { llm });
    expect(result.resolutions[0]?.outcome).toBe('rejected-llm-error');
    expect(result.resolutions[0]?.errorCode).toBe('MALFORMED_RESPONSE');
    expect(result.lossFlags[0]?.code).toBe('LF-GSLIDES-LOW-MATCH-CONFIDENCE');
  });
});

describe('AC #28: residuals processed in (slideId, elementId) lex order', () => {
  it('produces deterministic call ordering regardless of insertion order', async () => {
    // Insertion order is intentionally jumbled; output should be by sorted keys.
    const pending = {
      slide_2: { el_z: makeResidual('slide_2', 'el_z'), el_a: makeResidual('slide_2', 'el_a') },
      slide_1: { el_b: makeResidual('slide_1', 'el_b') },
    };
    const tree = makeTree({
      slides: [
        { id: 'slide_1', elements: [{ id: 'el_b' }] },
        { id: 'slide_2', elements: [{ id: 'el_a' }, { id: 'el_z' }] },
      ],
      pending,
    });
    const observed: string[] = [];
    const llm = createStubGeminiProvider({
      factory: (req) => {
        const blocks = req.messages[0]?.content;
        if (Array.isArray(blocks)) {
          const t = blocks.find((b) => b.type === 'text');
          if (t?.type === 'text') {
            const m = t.text.match(/"id":\s*"([^"]+)"/);
            if (m?.[1]) observed.push(m[1]);
          }
        }
        return { kind: 'text', text: JSON.stringify(RESOLVED_TEXT) };
      },
    });
    await runAiQcConvergence(tree, { llm });
    expect(observed).toEqual(['el_b', 'el_a', 'el_z']);
  });

  it('AC #28: collectResiduals sorts by (slideId, elementId) lex order', () => {
    const r = collectResiduals({
      z: { y: makeResidual('z', 'y'), a: makeResidual('z', 'a') },
      a: { b: makeResidual('a', 'b') },
    });
    expect(r.map((x) => `${x.slideId}/${x.elementId}`)).toEqual(['a/b', 'z/a', 'z/y']);
  });
});

describe('AC #30: deterministic re-run produces structurally-equal output', () => {
  it('same input + same canned responses produce same lossFlags + resolutions', async () => {
    const tree = makeTree({
      slides: [{ id: 'slide_1', elements: [{ id: 'el_1' }, { id: 'el_2' }] }],
      pending: {
        slide_1: {
          el_1: makeResidual('slide_1', 'el_1'),
          el_2: makeResidual('slide_1', 'el_2'),
        },
      },
    });
    const factory = () => ({ kind: 'text' as const, text: JSON.stringify(RESOLVED_TEXT) });
    const a = await runAiQcConvergence(tree, { llm: createStubGeminiProvider({ factory }) });
    const b = await runAiQcConvergence(tree, { llm: createStubGeminiProvider({ factory }) });
    expect(a.resolutions).toEqual(b.resolutions);
    expect(a.lossFlags).toEqual(b.lossFlags);
    expect(a.callsMade).toBe(b.callsMade);
  });
});
