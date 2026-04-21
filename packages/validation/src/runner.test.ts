// packages/validation/src/runner.test.ts
// Coverage for the runner + every rule. The rule bank is dense
// enough that grouping all the positive/negative cases in one file
// keeps the document-builder helpers DRY. Each rule gets at least
// one "trips the rule" case and one "doesn't trip it" case where
// the distinction matters.

import type { RIRDocument, RIRElement } from '@stageflip/rir';
import type { ClipDefinition, ClipRuntime } from '@stageflip/runtimes-contract';
import { describe, expect, it } from 'vitest';

import { ALL_RULES, lintDocument } from './index.js';
import type { LintRule } from './types.js';

function baseDoc(overrides: Partial<RIRDocument> = {}): RIRDocument {
  const doc: RIRDocument = {
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
  return doc;
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

function withStackingMap(doc: RIRDocument): RIRDocument {
  const map: Record<string, 'auto' | 'isolate'> = {};
  for (const el of doc.elements) map[el.id] = el.stacking;
  return { ...doc, stackingMap: map };
}

/** Short helper: run only a specific rule. */
function runOnly(rule: LintRule, doc: RIRDocument) {
  return lintDocument(doc, { rules: [rule] });
}

// ---------------------------------------------------------------------------
// runner-level
// ---------------------------------------------------------------------------

describe('lintDocument — runner', () => {
  it('returns passed=true + zero findings on a clean minimal document', () => {
    const doc = withStackingMap(baseDoc());
    const report = lintDocument(doc);
    expect(report.passed).toBe(true);
    expect(report.errorCount).toBe(0);
  });

  it('passed === false when any error finding is emitted', () => {
    const bad = withStackingMap(
      baseDoc({
        elements: [shapeEl('a', { timing: { startFrame: -1, endFrame: 5, durationFrames: 6 } })],
      }),
    );
    const report = lintDocument(bad);
    expect(report.passed).toBe(false);
    expect(report.errorCount).toBeGreaterThan(0);
  });

  it('include filter narrows the rule set', () => {
    const bad = withStackingMap(
      baseDoc({
        elements: [shapeEl('a', { timing: { startFrame: -1, endFrame: 5, durationFrames: 6 } })],
      }),
    );
    const report = lintDocument(bad, { include: ['zindex-unique-across-root'] });
    expect(report.findings).toHaveLength(0);
  });

  it('exclude filter drops rules from the run', () => {
    const bad = withStackingMap(
      baseDoc({
        elements: [shapeEl('a', { timing: { startFrame: -1, endFrame: 5, durationFrames: 6 } })],
      }),
    );
    const report = lintDocument(bad, { exclude: ['element-timing-within-composition'] });
    expect(report.findings.every((f) => f.rule !== 'element-timing-within-composition')).toBe(true);
  });

  it('a throwing rule produces a synthetic error finding but does not abort', () => {
    const bomb: LintRule = {
      id: 'bomb',
      severity: 'error',
      description: 'explodes',
      run() {
        throw new Error('boom');
      },
    };
    const report = lintDocument(baseDoc(), { rules: [bomb] });
    expect(report.passed).toBe(false);
    expect(report.findings[0]?.rule).toBe('bomb');
    expect(report.findings[0]?.message).toMatch(/boom/);
  });

  it('ALL_RULES contains at least 30 rules (T-104 target)', () => {
    expect(ALL_RULES.length).toBeGreaterThanOrEqual(30);
  });

  it('every rule id is unique (no accidental duplicates)', () => {
    const seen = new Set<string>();
    for (const r of ALL_RULES) {
      expect(seen.has(r.id), `duplicate rule id ${r.id}`).toBe(false);
      seen.add(r.id);
    }
  });
});

// ---------------------------------------------------------------------------
// timing rules
// ---------------------------------------------------------------------------

describe('timing rules', () => {
  it('element-timing-within-composition flags negative startFrame', () => {
    const rule = ALL_RULES.find((r) => r.id === 'element-timing-within-composition');
    if (!rule) throw new Error('rule missing');
    const doc = withStackingMap(
      baseDoc({
        elements: [shapeEl('a', { timing: { startFrame: -1, endFrame: 10, durationFrames: 11 } })],
      }),
    );
    expect(runOnly(rule, doc).findings.length).toBeGreaterThan(0);
  });

  it('element-timing-within-composition flags endFrame past duration', () => {
    const rule = ALL_RULES.find((r) => r.id === 'element-timing-within-composition');
    if (!rule) throw new Error('rule missing');
    const doc = withStackingMap(
      baseDoc({
        durationFrames: 30,
        elements: [shapeEl('a', { timing: { startFrame: 0, endFrame: 60, durationFrames: 60 } })],
      }),
    );
    expect(runOnly(rule, doc).findings.length).toBeGreaterThan(0);
  });

  it('animation-timing-within-element flags animation extending past parent window', () => {
    const rule = ALL_RULES.find((r) => r.id === 'animation-timing-within-element');
    if (!rule) throw new Error('rule missing');
    const el = shapeEl('a', {
      timing: { startFrame: 0, endFrame: 10, durationFrames: 10 },
      animations: [
        {
          id: 'fade',
          timing: { startFrame: 5, endFrame: 20, durationFrames: 15 },
          animation: { kind: 'fadeIn', durationFrames: 15 } as never,
          autoplay: true,
        },
      ],
    });
    const doc = withStackingMap(baseDoc({ elements: [el] }));
    expect(runOnly(rule, doc).findings[0]?.message).toMatch(/after element end/);
  });

  it('animation-ids-unique-within-element flags duplicates', () => {
    const rule = ALL_RULES.find((r) => r.id === 'animation-ids-unique-within-element');
    if (!rule) throw new Error('rule missing');
    const el = shapeEl('a', {
      animations: [
        {
          id: 'fade',
          timing: { startFrame: 0, endFrame: 10, durationFrames: 10 },
          animation: { kind: 'fadeIn', durationFrames: 10 } as never,
          autoplay: true,
        },
        {
          id: 'fade',
          timing: { startFrame: 10, endFrame: 20, durationFrames: 10 },
          animation: { kind: 'fadeOut', durationFrames: 10 } as never,
          autoplay: true,
        },
      ],
    });
    const doc = withStackingMap(baseDoc({ durationFrames: 30, elements: [el] }));
    expect(runOnly(rule, doc).findings.length).toBe(1);
  });

  it('element-ids-unique flags a duplicate element id', () => {
    const rule = ALL_RULES.find((r) => r.id === 'element-ids-unique');
    if (!rule) throw new Error('rule missing');
    const doc = withStackingMap(baseDoc({ elements: [shapeEl('a'), shapeEl('a')] }));
    expect(runOnly(rule, doc).findings.length).toBe(1);
  });

  it('elements-array-non-empty warns when elements is empty', () => {
    const rule = ALL_RULES.find((r) => r.id === 'elements-array-non-empty');
    if (!rule) throw new Error('rule missing');
    const report = runOnly(rule, baseDoc({ elements: [] }));
    expect(report.warnCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// transform rules
// ---------------------------------------------------------------------------

describe('transform rules', () => {
  it('element-overlaps-composition-bounds warns on off-canvas visible element', () => {
    const rule = ALL_RULES.find((r) => r.id === 'element-overlaps-composition-bounds');
    if (!rule) throw new Error('rule missing');
    const doc = withStackingMap(
      baseDoc({
        width: 100,
        height: 100,
        elements: [
          shapeEl('a', {
            transform: { x: 500, y: 500, width: 10, height: 10, rotation: 0, opacity: 1 },
          }),
        ],
      }),
    );
    expect(runOnly(rule, doc).warnCount).toBe(1);
  });

  it('element-not-tiny-when-visible warns on < 4px² visible element', () => {
    const rule = ALL_RULES.find((r) => r.id === 'element-not-tiny-when-visible');
    if (!rule) throw new Error('rule missing');
    const doc = withStackingMap(
      baseDoc({
        elements: [
          shapeEl('a', { transform: { x: 0, y: 0, width: 1, height: 1, rotation: 0, opacity: 1 } }),
        ],
      }),
    );
    expect(runOnly(rule, doc).warnCount).toBe(1);
  });

  it('element-opacity-non-zero-when-visible warns on opacity=0 + visible=true', () => {
    const rule = ALL_RULES.find((r) => r.id === 'element-opacity-non-zero-when-visible');
    if (!rule) throw new Error('rule missing');
    const doc = withStackingMap(
      baseDoc({
        elements: [
          shapeEl('a', {
            transform: { x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 0 },
          }),
        ],
      }),
    );
    expect(runOnly(rule, doc).warnCount).toBe(1);
  });

  it('element-rotation-within-reasonable-range emits info when |rotation| > 720', () => {
    const rule = ALL_RULES.find((r) => r.id === 'element-rotation-within-reasonable-range');
    if (!rule) throw new Error('rule missing');
    const doc = withStackingMap(
      baseDoc({
        elements: [
          shapeEl('a', {
            transform: { x: 0, y: 0, width: 10, height: 10, rotation: 900, opacity: 1 },
          }),
        ],
      }),
    );
    expect(runOnly(rule, doc).infoCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// content rules
// ---------------------------------------------------------------------------

describe('content rules', () => {
  it('text-non-empty warns on empty text', () => {
    const rule = ALL_RULES.find((r) => r.id === 'text-non-empty');
    if (!rule) throw new Error('rule missing');
    const el = textEl('t', { content: { ...(textEl('t').content as never), text: '' } as never });
    const doc = withStackingMap(baseDoc({ elements: [el] }));
    expect(runOnly(rule, doc).warnCount).toBe(1);
  });

  it('text-font-size-reasonable warns on fontSize < 1', () => {
    const rule = ALL_RULES.find((r) => r.id === 'text-font-size-reasonable');
    if (!rule) throw new Error('rule missing');
    const el = textEl('t', {
      content: { ...(textEl('t').content as never), fontSize: 0.5 } as never,
    });
    const doc = withStackingMap(baseDoc({ elements: [el] }));
    expect(runOnly(rule, doc).warnCount).toBe(1);
  });

  it('text-color-is-valid-css rejects a garbage color', () => {
    const rule = ALL_RULES.find((r) => r.id === 'text-color-is-valid-css');
    if (!rule) throw new Error('rule missing');
    const el = textEl('t', {
      content: { ...(textEl('t').content as never), color: '???not-a-color' } as never,
    });
    const doc = withStackingMap(baseDoc({ elements: [el] }));
    expect(runOnly(rule, doc).errorCount).toBe(1);
  });

  it('shape-has-fill-or-stroke warns when both are missing', () => {
    const rule = ALL_RULES.find((r) => r.id === 'shape-has-fill-or-stroke');
    if (!rule) throw new Error('rule missing');
    const el = shapeEl('s', { content: { type: 'shape', shape: 'rect' } });
    const doc = withStackingMap(baseDoc({ elements: [el] }));
    expect(runOnly(rule, doc).warnCount).toBe(1);
  });

  it('shape-custom-path-has-path fires on custom-path without path', () => {
    const rule = ALL_RULES.find((r) => r.id === 'shape-custom-path-has-path');
    if (!rule) throw new Error('rule missing');
    const el = shapeEl('s', {
      content: { type: 'shape', shape: 'custom-path', fill: '#000' },
    });
    const doc = withStackingMap(baseDoc({ elements: [el] }));
    expect(runOnly(rule, doc).errorCount).toBe(1);
  });

  it('shape-fill-is-valid-css rejects invalid fill', () => {
    const rule = ALL_RULES.find((r) => r.id === 'shape-fill-is-valid-css');
    if (!rule) throw new Error('rule missing');
    const el = shapeEl('s', { content: { type: 'shape', shape: 'rect', fill: 'bogus!?' } });
    const doc = withStackingMap(baseDoc({ elements: [el] }));
    expect(runOnly(rule, doc).errorCount).toBe(1);
  });

  it('video-playback-rate-reasonable warns on 10x playback', () => {
    const rule = ALL_RULES.find((r) => r.id === 'video-playback-rate-reasonable');
    if (!rule) throw new Error('rule missing');
    const el: RIRElement = {
      id: 'v',
      type: 'video',
      transform: { x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1 },
      timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
      zIndex: 0,
      visible: true,
      locked: false,
      stacking: 'auto',
      animations: [],
      content: {
        type: 'video',
        srcUrl: 'file://x.mp4',
        muted: true,
        loop: false,
        playbackRate: 10,
      },
    };
    const doc = withStackingMap(baseDoc({ elements: [el] }));
    expect(runOnly(rule, doc).warnCount).toBe(1);
  });

  it('video-trim-ordered-when-present errors on inverted trim window', () => {
    const rule = ALL_RULES.find((r) => r.id === 'video-trim-ordered-when-present');
    if (!rule) throw new Error('rule missing');
    const el: RIRElement = {
      id: 'v',
      type: 'video',
      transform: { x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1 },
      timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
      zIndex: 0,
      visible: true,
      locked: false,
      stacking: 'auto',
      animations: [],
      content: {
        type: 'video',
        srcUrl: 'file://x.mp4',
        muted: true,
        loop: false,
        playbackRate: 1,
        trimStartMs: 1000,
        trimEndMs: 500,
      },
    };
    const doc = withStackingMap(baseDoc({ elements: [el] }));
    expect(runOnly(rule, doc).errorCount).toBe(1);
  });

  it('embed-src-uses-https warns on http://', () => {
    const rule = ALL_RULES.find((r) => r.id === 'embed-src-uses-https');
    if (!rule) throw new Error('rule missing');
    const el: RIRElement = {
      id: 'e',
      type: 'embed',
      transform: { x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1 },
      timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
      zIndex: 0,
      visible: true,
      locked: false,
      stacking: 'auto',
      animations: [],
      content: {
        type: 'embed',
        src: 'http://insecure.example/',
        sandbox: [],
        allowFullscreen: false,
      },
    };
    const doc = withStackingMap(baseDoc({ elements: [el] }));
    expect(runOnly(rule, doc).warnCount).toBe(1);
  });

  it('chart-series-length-matches-labels errors on mismatch', () => {
    const rule = ALL_RULES.find((r) => r.id === 'chart-series-length-matches-labels');
    if (!rule) throw new Error('rule missing');
    const el: RIRElement = {
      id: 'c',
      type: 'chart',
      transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
      timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
      zIndex: 0,
      visible: true,
      locked: false,
      stacking: 'auto',
      animations: [],
      content: {
        type: 'chart',
        chartKind: 'bar',
        data: {
          labels: ['A', 'B', 'C'],
          series: [{ name: 's', values: [1, 2] }], // 2 vs 3
        },
        legend: true,
        axes: true,
      },
    };
    const doc = withStackingMap(baseDoc({ elements: [el] }));
    expect(runOnly(rule, doc).errorCount).toBe(1);
  });

  it('table-cells-within-bounds errors on out-of-grid cell', () => {
    const rule = ALL_RULES.find((r) => r.id === 'table-cells-within-bounds');
    if (!rule) throw new Error('rule missing');
    const el: RIRElement = {
      id: 'tab',
      type: 'table',
      transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
      timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
      zIndex: 0,
      visible: true,
      locked: false,
      stacking: 'auto',
      animations: [],
      content: {
        type: 'table',
        rows: 2,
        columns: 2,
        headerRow: false,
        cells: [{ row: 5, col: 0, content: 'x', align: 'left', colspan: 1, rowspan: 1 }],
      },
    };
    const doc = withStackingMap(baseDoc({ elements: [el] }));
    expect(runOnly(rule, doc).errorCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// composition rules
// ---------------------------------------------------------------------------

describe('composition rules', () => {
  it('composition-dimensions-even-for-video warns on odd width in video mode', () => {
    const rule = ALL_RULES.find((r) => r.id === 'composition-dimensions-even-for-video');
    if (!rule) throw new Error('rule missing');
    const doc = withStackingMap(baseDoc({ mode: 'video', width: 641 }));
    expect(runOnly(rule, doc).warnCount).toBe(1);
  });

  it('composition-fps-standard emits info on 23.97-ish fps', () => {
    const rule = ALL_RULES.find((r) => r.id === 'composition-fps-standard');
    if (!rule) throw new Error('rule missing');
    const doc = withStackingMap(baseDoc({ frameRate: 27 }));
    expect(runOnly(rule, doc).infoCount).toBe(1);
  });

  it('composition-duration-reasonable warns past the 60s cap (at 30fps)', () => {
    const rule = ALL_RULES.find((r) => r.id === 'composition-duration-reasonable');
    if (!rule) throw new Error('rule missing');
    const doc = withStackingMap(baseDoc({ durationFrames: 5000 }));
    expect(runOnly(rule, doc).warnCount).toBe(1);
  });

  it('composition-fits-mode-aspect-hint info on narrow display composition', () => {
    const rule = ALL_RULES.find((r) => r.id === 'composition-fits-mode-aspect-hint');
    if (!rule) throw new Error('rule missing');
    const doc = withStackingMap(baseDoc({ mode: 'display', width: 640, height: 480 }));
    expect(runOnly(rule, doc).infoCount).toBe(1);
  });

  it('meta-digest-present errors on empty digest', () => {
    const rule = ALL_RULES.find((r) => r.id === 'meta-digest-present');
    if (!rule) throw new Error('rule missing');
    const doc = withStackingMap(baseDoc({ meta: { ...baseDoc().meta, digest: '' } }));
    expect(runOnly(rule, doc).errorCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// font rules
// ---------------------------------------------------------------------------

describe('font rules', () => {
  it('font-requirement-covers-text-families warns when family is undeclared', () => {
    const rule = ALL_RULES.find((r) => r.id === 'font-requirement-covers-text-families');
    if (!rule) throw new Error('rule missing');
    const doc = withStackingMap(baseDoc({ elements: [textEl('t')], fontRequirements: [] }));
    expect(runOnly(rule, doc).warnCount).toBe(1);
  });

  it('font-requirement-weights-cover-text-weights warns on unlisted weight', () => {
    const rule = ALL_RULES.find((r) => r.id === 'font-requirement-weights-cover-text-weights');
    if (!rule) throw new Error('rule missing');
    const doc = withStackingMap(
      baseDoc({
        elements: [
          textEl('t', { content: { ...(textEl('t').content as never), fontWeight: 700 } as never }),
        ],
        fontRequirements: [{ family: 'Inter', weight: 400 }],
      }),
    );
    expect(runOnly(rule, doc).warnCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// stacking rules
// ---------------------------------------------------------------------------

describe('stacking rules', () => {
  it('stacking-map-covers-all-elements errors on missing map entry', () => {
    const rule = ALL_RULES.find((r) => r.id === 'stacking-map-covers-all-elements');
    if (!rule) throw new Error('rule missing');
    const doc = baseDoc({ elements: [shapeEl('a')], stackingMap: {} });
    expect(runOnly(rule, doc).errorCount).toBe(1);
  });

  it('stacking-value-matches-element errors on mismatch', () => {
    const rule = ALL_RULES.find((r) => r.id === 'stacking-value-matches-element');
    if (!rule) throw new Error('rule missing');
    const doc = baseDoc({
      elements: [shapeEl('a', { stacking: 'auto' })],
      stackingMap: { a: 'isolate' },
    });
    expect(runOnly(rule, doc).errorCount).toBe(1);
  });

  it('zindex-unique-across-root emits info on duplicate zIndex', () => {
    const rule = ALL_RULES.find((r) => r.id === 'zindex-unique-across-root');
    if (!rule) throw new Error('rule missing');
    const doc = withStackingMap(
      baseDoc({
        elements: [shapeEl('a', { zIndex: 5 }), shapeEl('b', { zIndex: 5 })],
      }),
    );
    expect(runOnly(rule, doc).infoCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// clip rules (context-dependent)
// ---------------------------------------------------------------------------

describe('clip rules', () => {
  function clipEl(id: string, runtime: string, clipName: string): RIRElement {
    return {
      id,
      type: 'clip',
      transform: { x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1 },
      timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
      zIndex: 0,
      visible: true,
      locked: false,
      stacking: 'auto',
      animations: [],
      content: { type: 'clip', runtime, clipName, params: {} },
    };
  }

  it('clip-kind-resolvable emits info (not error) when no findClip is wired', () => {
    const rule = ALL_RULES.find((r) => r.id === 'clip-kind-resolvable');
    if (!rule) throw new Error('rule missing');
    const doc = withStackingMap(baseDoc({ elements: [clipEl('c', 'css', 'mystery')] }));
    const report = runOnly(rule, doc);
    expect(report.infoCount).toBe(1);
    expect(report.errorCount).toBe(0);
  });

  it('clip-kind-resolvable errors when findClip returns null', () => {
    const rule = ALL_RULES.find((r) => r.id === 'clip-kind-resolvable');
    if (!rule) throw new Error('rule missing');
    const doc = withStackingMap(baseDoc({ elements: [clipEl('c', 'css', 'mystery')] }));
    const report = lintDocument(doc, {
      rules: [rule],
      context: { findClip: () => null },
    });
    expect(report.errorCount).toBe(1);
  });

  it('clip-runtime-matches-registered errors when runtime id mismatches', () => {
    const rule = ALL_RULES.find((r) => r.id === 'clip-runtime-matches-registered');
    if (!rule) throw new Error('rule missing');
    const fakeRuntime: ClipRuntime = { id: 'gsap', tier: 'live', clips: new Map() };
    const fakeClip: ClipDefinition<unknown> = { kind: 'widget', render: () => null };
    const doc = withStackingMap(baseDoc({ elements: [clipEl('c', 'css', 'widget')] }));
    const report = lintDocument(doc, {
      rules: [rule],
      context: { findClip: () => ({ runtime: fakeRuntime, clip: fakeClip }) },
    });
    expect(report.errorCount).toBe(1);
  });
});
