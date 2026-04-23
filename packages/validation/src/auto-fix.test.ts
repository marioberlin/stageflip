// packages/validation/src/auto-fix.test.ts
// T-138 — auto-fix orchestrator + per-rule fix coverage. Keeps the
// heavy rule-builder helpers here rather than dragging them into
// runner.test.ts.

import type { RIRDocument, RIRElement } from '@stageflip/rir';
import { describe, expect, it } from 'vitest';

import { ALL_RULES, autoFixDocument, lintDocument } from './index.js';
import type { LintFinding, LintRule } from './types.js';

function baseDoc(overrides: Partial<RIRDocument> = {}): RIRDocument {
  return {
    id: 'test-doc',
    width: 640,
    height: 360,
    frameRate: 30,
    durationFrames: 30,
    mode: 'slide',
    elements: [],
    stackingMap: {},
    fontRequirements: [],
    meta: {
      sourceDocId: 'src',
      sourceVersion: 1,
      compilerVersion: '0.0.0-test',
      digest: 'digest',
    },
    ...overrides,
  };
}

function shapeEl(id: string, overrides: Partial<RIRElement> = {}): RIRElement {
  return {
    id,
    type: 'shape',
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
    timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
    zIndex: 0,
    visible: true,
    locked: false,
    stacking: 'auto',
    animations: [],
    content: { type: 'shape', shape: 'rect', fill: '#336699' },
    ...overrides,
  } as RIRElement;
}

function textEl(id: string, overrides: Partial<RIRElement> = {}): RIRElement {
  return {
    id,
    type: 'text',
    transform: { x: 10, y: 10, width: 200, height: 40, rotation: 0, opacity: 1 },
    timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
    zIndex: 1,
    visible: true,
    locked: false,
    stacking: 'auto',
    animations: [],
    content: {
      type: 'text',
      text: 'Hello',
      fontFamily: 'Inter',
      fontSize: 24,
      fontWeight: 400,
      color: '#ffffff',
      align: 'left',
      lineHeight: 1.2,
    },
    ...overrides,
  } as RIRElement;
}

function videoEl(id: string, overrides: Partial<RIRElement> = {}): RIRElement {
  return {
    id,
    type: 'video',
    transform: { x: 0, y: 0, width: 320, height: 180, rotation: 0, opacity: 1 },
    timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
    zIndex: 0,
    visible: true,
    locked: false,
    stacking: 'auto',
    animations: [],
    content: {
      type: 'video',
      src: 'https://example.com/v.mp4',
      playbackRate: 1,
      volume: 1,
      muted: false,
    },
    ...overrides,
  } as RIRElement;
}

function embedEl(id: string, src: string): RIRElement {
  return {
    id,
    type: 'embed',
    transform: { x: 0, y: 0, width: 320, height: 180, rotation: 0, opacity: 1 },
    timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
    zIndex: 0,
    visible: true,
    locked: false,
    stacking: 'auto',
    animations: [],
    content: { type: 'embed', src },
  } as RIRElement;
}

function withStackingMap(doc: RIRDocument): RIRDocument {
  const map: Record<string, 'auto' | 'isolate'> = {};
  for (const el of doc.elements) map[el.id] = el.stacking;
  return { ...doc, stackingMap: map };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

describe('autoFixDocument — orchestrator', () => {
  it('returns the input unchanged + converged=true when every rule passes', () => {
    const doc = withStackingMap(baseDoc({ elements: [shapeEl('a')] }));
    const result = autoFixDocument(doc);
    expect(result.document).toEqual(doc);
    expect(result.converged).toBe(true);
    expect(result.hitMaxPasses).toBe(false);
    expect(result.passes).toEqual([]);
  });

  it('applies a fix from a rule and converges in a single pass', () => {
    const doc = withStackingMap(
      baseDoc({
        elements: [
          shapeEl('a', {
            transform: { x: 0, y: 0, width: 100, height: 100, rotation: 1500, opacity: 1 },
          }),
        ],
      }),
    );
    const result = autoFixDocument(doc);
    expect(result.converged).toBe(true);
    expect(result.passes.length).toBeGreaterThanOrEqual(1);
    // Rotation should be normalized into (-360, 360].
    const rotation = result.document.elements[0]?.transform.rotation ?? 0;
    expect(rotation).toBeGreaterThan(-360);
    expect(rotation).toBeLessThanOrEqual(360);
  });

  it('aggregates multiple fixes across passes and reports final finding count', () => {
    const doc = baseDoc({
      mode: 'video',
      width: 641, // odd — triggers composition-dimensions-even-for-video
      height: 361,
      elements: [
        shapeEl('a', { stacking: 'isolate' }),
        textEl('t', {
          content: {
            type: 'text',
            text: 'Hi',
            fontFamily: 'Brand Sans',
            fontSize: 24,
            fontWeight: 700,
            color: '#ffffff',
            align: 'left',
            lineHeight: 1.2,
          } as RIRElement['content'],
        }),
      ],
      stackingMap: {}, // missing — triggers stacking-map-covers-all-elements
      fontRequirements: [], // missing — triggers font-requirement-covers-text-families
    });
    const before = lintDocument(doc);
    const result = autoFixDocument(doc);
    expect(result.finalReport.errorCount).toBeLessThan(before.errorCount);
    expect(result.document.width).toBe(642);
    expect(result.document.height).toBe(362);
    expect(result.document.stackingMap.a).toBe('isolate');
    expect(result.document.stackingMap.t).toBe('auto');
    expect(result.document.fontRequirements.some((f) => f.family === 'Brand Sans')).toBe(true);
  });

  it('stops at maxPasses when fixes cannot converge', () => {
    const noisyRule: LintRule = {
      id: 'test-noisy',
      severity: 'warn',
      description: 'always emits one finding, never actually fixes it',
      run() {
        return [{ rule: 'test-noisy', severity: 'warn', message: 'always here' }];
      },
      fix(doc) {
        // Mutate harmlessly — bumps the compiler version string so the
        // orchestrator sees a "change" each pass but the lint never
        // settles. Real rules don't do this; this is a misbehaviour drill.
        return { ...doc, meta: { ...doc.meta, compilerVersion: `${doc.meta.compilerVersion}+` } };
      },
    };
    const result = autoFixDocument(withStackingMap(baseDoc()), {
      rules: [noisyRule],
      maxPasses: 3,
    });
    expect(result.converged).toBe(false);
    expect(result.hitMaxPasses).toBe(true);
    expect(result.passes).toHaveLength(3);
  });

  it('defaults maxPasses to 10', () => {
    const counter = { calls: 0 };
    const noisyRule: LintRule = {
      id: 'test-count',
      severity: 'warn',
      description: 'counts fix invocations',
      run() {
        return [{ rule: 'test-count', severity: 'warn', message: 'keep going' }];
      },
      fix(doc) {
        counter.calls++;
        return { ...doc, meta: { ...doc.meta, compilerVersion: `${doc.meta.compilerVersion}+` } };
      },
    };
    autoFixDocument(withStackingMap(baseDoc()), { rules: [noisyRule] });
    expect(counter.calls).toBe(10);
  });

  it('reports per-pass rulesApplied with the rule ids that fired that pass', () => {
    const doc = withStackingMap(
      baseDoc({
        elements: [
          shapeEl('a', {
            transform: { x: 0, y: 0, width: 100, height: 100, rotation: 1500, opacity: 1 },
          }),
        ],
      }),
    );
    const result = autoFixDocument(doc);
    expect(result.passes[0]?.rulesApplied).toContain('element-rotation-within-reasonable-range');
  });

  it('honours include/exclude — an excluded rule never gets a fix opportunity', () => {
    const doc = withStackingMap(
      baseDoc({
        elements: [
          shapeEl('a', {
            transform: { x: 0, y: 0, width: 100, height: 100, rotation: 1500, opacity: 1 },
          }),
        ],
      }),
    );
    const result = autoFixDocument(doc, {
      exclude: ['element-rotation-within-reasonable-range'],
    });
    expect(result.document.elements[0]?.transform.rotation).toBe(1500);
  });

  it('skips rules without a `fix` method — their findings remain in the final report', () => {
    const doc = withStackingMap(
      baseDoc({
        elements: [
          // Invalid text color triggers `text-color-is-valid-css` which has
          // no auto-fix (there's no sensible deterministic replacement for
          // a garbage color string).
          textEl('t', {
            content: {
              type: 'text',
              text: 'X',
              fontFamily: 'Inter',
              fontSize: 24,
              fontWeight: 400,
              color: 'not-a-color!@#',
              align: 'left',
              lineHeight: 1.2,
            } as RIRElement['content'],
          }),
        ],
      }),
    );
    doc.fontRequirements = [{ family: 'Inter', weight: 400 }];
    const result = autoFixDocument(doc);
    expect(result.finalReport.findings.some((f) => f.rule === 'text-color-is-valid-css')).toBe(
      true,
    );
  });

  it('always exposes the initial + final LintReport for diffing', () => {
    const doc = withStackingMap(
      baseDoc({
        elements: [
          shapeEl('a', {
            transform: { x: 0, y: 0, width: 100, height: 100, rotation: 1500, opacity: 1 },
          }),
        ],
      }),
    );
    const result = autoFixDocument(doc);
    expect(result.initialReport.findings.length).toBeGreaterThanOrEqual(1);
    expect(result.finalReport.findings.length).toBeLessThanOrEqual(
      result.initialReport.findings.length,
    );
  });
});

// ---------------------------------------------------------------------------
// Per-rule fixes (10)
// ---------------------------------------------------------------------------

function ruleById(id: string): LintRule {
  const rule = ALL_RULES.find((r) => r.id === id);
  if (!rule) throw new Error(`no rule ${id}`);
  return rule;
}

function runFix(ruleId: string, doc: RIRDocument): RIRDocument {
  const rule = ruleById(ruleId);
  const findings = rule.run(doc, {}) as readonly LintFinding[];
  const fixed = rule.fix?.(doc, findings);
  if (fixed == null) throw new Error(`rule ${ruleId} produced no fix`);
  return fixed;
}

describe('fix — element-rotation-within-reasonable-range', () => {
  it('normalizes a rotation > 360° into (-360, 360]', () => {
    const doc = baseDoc({
      elements: [
        shapeEl('a', {
          transform: { x: 0, y: 0, width: 100, height: 100, rotation: 1500, opacity: 1 },
        }),
      ],
    });
    const fixed = runFix('element-rotation-within-reasonable-range', doc);
    const r = fixed.elements[0]?.transform.rotation ?? 0;
    expect(r).toBeGreaterThan(-360);
    expect(r).toBeLessThanOrEqual(360);
    // 1500 mod 360 = 60 — same visual rotation.
    expect(r).toBe(60);
  });

  it('normalizes a deeply negative rotation too', () => {
    const doc = baseDoc({
      elements: [
        shapeEl('a', {
          transform: { x: 0, y: 0, width: 100, height: 100, rotation: -1300, opacity: 1 },
        }),
      ],
    });
    const fixed = runFix('element-rotation-within-reasonable-range', doc);
    const r = fixed.elements[0]?.transform.rotation ?? 0;
    // -1300 → -220 in a canonical (-360, 360] result.
    expect(r).toBe(-220);
  });

  it('leaves rotations inside ±720° alone (no finding → no fix needed)', () => {
    const doc = baseDoc({
      elements: [
        shapeEl('a', {
          transform: { x: 0, y: 0, width: 100, height: 100, rotation: 45, opacity: 1 },
        }),
      ],
    });
    const rule = ruleById('element-rotation-within-reasonable-range');
    const findings = rule.run(doc, {});
    expect(findings).toHaveLength(0);
    expect(rule.fix?.(doc, findings)).toBeNull();
  });
});

describe('fix — composition-dimensions-even-for-video', () => {
  it('rounds odd width + height up to the next even integer', () => {
    const doc = baseDoc({ mode: 'video', width: 641, height: 361 });
    const fixed = runFix('composition-dimensions-even-for-video', doc);
    expect(fixed.width).toBe(642);
    expect(fixed.height).toBe(362);
  });

  it('only touches the odd dimension, leaves even alone', () => {
    const doc = baseDoc({ mode: 'video', width: 641, height: 360 });
    const fixed = runFix('composition-dimensions-even-for-video', doc);
    expect(fixed.width).toBe(642);
    expect(fixed.height).toBe(360);
  });

  it('is a no-op for non-video mode documents (rule emits nothing → fix returns null)', () => {
    const doc = baseDoc({ mode: 'slide', width: 641 });
    const rule = ruleById('composition-dimensions-even-for-video');
    expect(rule.fix?.(doc, rule.run(doc, {}))).toBeNull();
  });
});

describe('fix — stacking-map-covers-all-elements', () => {
  it('populates missing stackingMap entries from each element.stacking', () => {
    const doc = baseDoc({
      elements: [shapeEl('a', { stacking: 'isolate' }), shapeEl('b', { stacking: 'auto' })],
      stackingMap: {},
    });
    const fixed = runFix('stacking-map-covers-all-elements', doc);
    expect(fixed.stackingMap).toEqual({ a: 'isolate', b: 'auto' });
  });

  it('leaves existing stackingMap entries alone (fill-in is additive)', () => {
    const doc = baseDoc({
      elements: [shapeEl('a', { stacking: 'isolate' }), shapeEl('b', { stacking: 'auto' })],
      stackingMap: { a: 'isolate' }, // pre-existing; b is missing
    });
    const fixed = runFix('stacking-map-covers-all-elements', doc);
    expect(fixed.stackingMap).toEqual({ a: 'isolate', b: 'auto' });
  });
});

describe('fix — stacking-value-matches-element', () => {
  it("syncs the stackingMap entry to the element's own stacking value when they disagree", () => {
    const doc = baseDoc({
      elements: [shapeEl('a', { stacking: 'isolate' })],
      stackingMap: { a: 'auto' }, // disagrees
    });
    const fixed = runFix('stacking-value-matches-element', doc);
    expect(fixed.stackingMap.a).toBe('isolate');
  });
});

describe('fix — text-font-size-reasonable', () => {
  it('clamps a zero / negative fontSize up to the minimum (1)', () => {
    const doc = baseDoc({
      elements: [
        textEl('t', {
          content: {
            type: 'text',
            text: 'x',
            fontFamily: 'Inter',
            fontSize: 0,
            fontWeight: 400,
            color: '#fff',
            align: 'left',
            lineHeight: 1.2,
          } as RIRElement['content'],
        }),
      ],
    });
    const fixed = runFix('text-font-size-reasonable', doc);
    const el = fixed.elements[0];
    if (el?.content.type !== 'text') throw new Error('expected text content');
    expect(el.content.fontSize).toBe(1);
  });

  it('clamps an absurdly large fontSize down to the maximum (2000)', () => {
    const doc = baseDoc({
      elements: [
        textEl('t', {
          content: {
            type: 'text',
            text: 'x',
            fontFamily: 'Inter',
            fontSize: 9999,
            fontWeight: 400,
            color: '#fff',
            align: 'left',
            lineHeight: 1.2,
          } as RIRElement['content'],
        }),
      ],
    });
    const fixed = runFix('text-font-size-reasonable', doc);
    const el = fixed.elements[0];
    if (el?.content.type !== 'text') throw new Error('expected text content');
    expect(el.content.fontSize).toBe(2000);
  });
});

describe('fix — video-playback-rate-reasonable', () => {
  it('clamps a low playbackRate to 0.25', () => {
    const doc = baseDoc({
      elements: [
        videoEl('v', {
          content: {
            type: 'video',
            src: 'https://ex.com/x.mp4',
            playbackRate: 0.1,
            volume: 1,
            muted: false,
          } as RIRElement['content'],
        }),
      ],
    });
    const fixed = runFix('video-playback-rate-reasonable', doc);
    const el = fixed.elements[0];
    if (el?.content.type !== 'video') throw new Error('expected video content');
    expect(el.content.playbackRate).toBe(0.25);
  });

  it('clamps a high playbackRate to 4', () => {
    const doc = baseDoc({
      elements: [
        videoEl('v', {
          content: {
            type: 'video',
            src: 'https://ex.com/x.mp4',
            playbackRate: 10,
            volume: 1,
            muted: false,
          } as RIRElement['content'],
        }),
      ],
    });
    const fixed = runFix('video-playback-rate-reasonable', doc);
    const el = fixed.elements[0];
    if (el?.content.type !== 'video') throw new Error('expected video content');
    expect(el.content.playbackRate).toBe(4);
  });
});

describe('fix — video-trim-ordered-when-present', () => {
  it('swaps inverted trim endpoints so end > start', () => {
    const doc = baseDoc({
      elements: [
        videoEl('v', {
          content: {
            type: 'video',
            src: 'https://ex.com/x.mp4',
            playbackRate: 1,
            volume: 1,
            muted: false,
            trimStartMs: 8000,
            trimEndMs: 2000,
          } as RIRElement['content'],
        }),
      ],
    });
    const fixed = runFix('video-trim-ordered-when-present', doc);
    const el = fixed.elements[0];
    if (el?.content.type !== 'video') throw new Error('expected video content');
    expect(el.content.trimStartMs).toBe(2000);
    expect(el.content.trimEndMs).toBe(8000);
  });
});

describe('fix — embed-src-uses-https', () => {
  it('upgrades http:// → https:// on embed src values', () => {
    const doc = baseDoc({ elements: [embedEl('e', 'http://example.com/widget')] });
    const fixed = runFix('embed-src-uses-https', doc);
    const el = fixed.elements[0];
    if (el?.content.type !== 'embed') throw new Error('expected embed content');
    expect(el.content.src).toBe('https://example.com/widget');
  });
});

describe('fix — font-requirement-covers-text-families', () => {
  it('adds a missing family to fontRequirements with the weight in use', () => {
    const doc = baseDoc({
      elements: [
        textEl('t', {
          content: {
            type: 'text',
            text: 'x',
            fontFamily: 'Brand Sans',
            fontSize: 24,
            fontWeight: 700,
            color: '#fff',
            align: 'left',
            lineHeight: 1.2,
          } as RIRElement['content'],
        }),
      ],
      fontRequirements: [],
    });
    const fixed = runFix('font-requirement-covers-text-families', doc);
    expect(fixed.fontRequirements.some((f) => f.family === 'Brand Sans' && f.weight === 700)).toBe(
      true,
    );
  });

  it('deduplicates when the same family is used by multiple text elements', () => {
    const doc = baseDoc({
      elements: [
        textEl('t1', {
          content: {
            type: 'text',
            text: 'a',
            fontFamily: 'Brand Sans',
            fontSize: 24,
            fontWeight: 700,
            color: '#fff',
            align: 'left',
            lineHeight: 1.2,
          } as RIRElement['content'],
        }),
        textEl('t2', {
          content: {
            type: 'text',
            text: 'b',
            fontFamily: 'Brand Sans',
            fontSize: 18,
            fontWeight: 700,
            color: '#fff',
            align: 'left',
            lineHeight: 1.2,
          } as RIRElement['content'],
        }),
      ],
      fontRequirements: [],
    });
    const fixed = runFix('font-requirement-covers-text-families', doc);
    const brandReqs = fixed.fontRequirements.filter((f) => f.family === 'Brand Sans');
    expect(brandReqs).toHaveLength(1);
  });
});

describe('fix — font-requirement-weights-cover-text-weights', () => {
  it('adds the missing weight to fontRequirements for a family already present', () => {
    const doc = baseDoc({
      elements: [
        textEl('t', {
          content: {
            type: 'text',
            text: 'x',
            fontFamily: 'Inter',
            fontSize: 24,
            fontWeight: 600,
            color: '#fff',
            align: 'left',
            lineHeight: 1.2,
          } as RIRElement['content'],
        }),
      ],
      fontRequirements: [{ family: 'Inter', weight: 400 }],
    });
    const fixed = runFix('font-requirement-weights-cover-text-weights', doc);
    const interReqs = fixed.fontRequirements.filter((f) => f.family === 'Inter');
    expect(interReqs.some((r) => r.weight === 600)).toBe(true);
    expect(interReqs.some((r) => r.weight === 400)).toBe(true);
  });
});
