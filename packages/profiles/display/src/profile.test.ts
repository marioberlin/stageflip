// packages/profiles/display/src/profile.test.ts
// Coverage for the StageFlip.Display profile: element-type allowlist, canonical
// IAB sizes, IAB/GDN file-size budgets, the rules it contributes to the lint
// runner, and the assembled `displayProfile` descriptor.

import type { RIRDocument, RIRElement } from '@stageflip/rir';
import { lintDocument } from '@stageflip/validation';
import type { LintRule } from '@stageflip/validation';
import { describe, expect, it } from 'vitest';

import {
  DISPLAY_ALLOWED_ELEMENT_TYPES,
  DISPLAY_CANONICAL_SIZES,
  DISPLAY_CLIP_KINDS,
  DISPLAY_FILE_SIZE_BUDGETS_KB,
  DISPLAY_RULES,
  DISPLAY_TOOL_BUNDLES,
  displayDimensionsRecognized,
  displayDurationWithinBudget,
  displayElementTypesAllowed,
  displayFrameRateWithinBudget,
  displayHasVisibleElement,
  displayProfile,
} from './index.js';

function baseDisplayDoc(overrides: Partial<RIRDocument> = {}): RIRDocument {
  const doc: RIRDocument = {
    id: 'test-doc',
    width: 300,
    height: 250,
    frameRate: 24,
    durationFrames: 24 * 15, // 15s
    mode: 'display',
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

function textEl(id: string, overrides: Partial<RIRElement> = {}): RIRElement {
  return {
    id,
    type: 'text',
    transform: { x: 0, y: 0, width: 100, height: 40, rotation: 0, opacity: 1 },
    timing: { startFrame: 0, endFrame: 24, durationFrames: 24 },
    zIndex: 0,
    visible: true,
    locked: false,
    stacking: 'auto',
    animations: [],
    content: {
      type: 'text',
      richText: {
        runs: [{ text: 'CTA', style: {} }],
        align: 'left',
      },
    },
    ...overrides,
  } as RIRElement;
}

function shapeEl(id: string, overrides: Partial<RIRElement> = {}): RIRElement {
  return {
    id,
    type: 'shape',
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
    timing: { startFrame: 0, endFrame: 24, durationFrames: 24 },
    zIndex: 0,
    visible: true,
    locked: false,
    stacking: 'auto',
    animations: [],
    content: { type: 'shape', shape: 'rect', fill: '#336699' },
    ...overrides,
  } as RIRElement;
}

function videoEl(id: string, overrides: Partial<RIRElement> = {}): RIRElement {
  return {
    id,
    type: 'video',
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
    timing: { startFrame: 0, endFrame: 24, durationFrames: 24 },
    zIndex: 0,
    visible: true,
    locked: false,
    stacking: 'auto',
    animations: [],
    content: {
      type: 'video',
      srcUrl: 'file:///v.mp4',
      muted: true,
      loop: false,
      fit: 'cover',
      startOffsetMs: 0,
      gain: 1,
      pan: 0,
      fadeInMs: 0,
      fadeOutMs: 0,
    },
    ...overrides,
  } as RIRElement;
}

function runOnly(rule: LintRule, doc: RIRDocument) {
  return lintDocument(doc, { rules: [rule] });
}

describe('DISPLAY_ALLOWED_ELEMENT_TYPES', () => {
  it('includes banner-safe visual element types', () => {
    for (const t of ['text', 'image', 'shape', 'group', 'clip']) {
      expect(DISPLAY_ALLOWED_ELEMENT_TYPES).toContain(t);
    }
  });

  it('excludes types incompatible with IAB/GDN banner constraints', () => {
    for (const t of ['video', 'audio', 'chart', 'table', 'code', 'embed']) {
      expect(DISPLAY_ALLOWED_ELEMENT_TYPES).not.toContain(t);
    }
  });
});

describe('displayElementTypesAllowed', () => {
  it('emits no finding when every element type is in the allowlist', () => {
    const doc = baseDisplayDoc({ elements: [textEl('t1'), shapeEl('s1')] });
    expect(runOnly(displayElementTypesAllowed, doc).findings).toEqual([]);
  });

  it('emits an error when a disallowed element type appears', () => {
    const doc = baseDisplayDoc({ elements: [videoEl('v1')] });
    const report = runOnly(displayElementTypesAllowed, doc);
    expect(report.errorCount).toBe(1);
    expect(report.findings[0]).toMatchObject({
      rule: displayElementTypesAllowed.id,
      severity: 'error',
      elementId: 'v1',
    });
  });

  it('does not run in non-display mode', () => {
    const doc = baseDisplayDoc({ mode: 'slide', elements: [videoEl('v1')] });
    expect(runOnly(displayElementTypesAllowed, doc).findings).toEqual([]);
  });
});

describe('DISPLAY_CANONICAL_SIZES', () => {
  it('names the three canonical IAB sizes', () => {
    const dims = DISPLAY_CANONICAL_SIZES.map((s) => `${s.width}x${s.height}`);
    expect(new Set(dims)).toEqual(new Set(['300x250', '728x90', '160x600']));
  });

  it('pairs every size with a human-readable name', () => {
    for (const size of DISPLAY_CANONICAL_SIZES) {
      expect(size.name.length).toBeGreaterThan(0);
    }
  });

  it('has unique dimensions', () => {
    const dims = DISPLAY_CANONICAL_SIZES.map((s) => `${s.width}x${s.height}`);
    expect(new Set(dims).size).toBe(dims.length);
  });
});

describe('displayDimensionsRecognized', () => {
  it.each([
    [300, 250, 'Medium Rectangle'],
    [728, 90, 'Leaderboard'],
    [160, 600, 'Wide Skyscraper'],
  ])('accepts the canonical IAB size %sx%s (%s)', (width, height) => {
    const doc = baseDisplayDoc({ width, height });
    expect(runOnly(displayDimensionsRecognized, doc).findings).toEqual([]);
  });

  it('warns on non-canonical dimensions', () => {
    const doc = baseDisplayDoc({ width: 500, height: 500 });
    const report = runOnly(displayDimensionsRecognized, doc);
    expect(report.warnCount).toBe(1);
    expect(report.findings[0]?.severity).toBe('warn');
  });

  it('does not run in non-display mode', () => {
    const doc = baseDisplayDoc({ mode: 'slide', width: 500, height: 500 });
    expect(runOnly(displayDimensionsRecognized, doc).findings).toEqual([]);
  });
});

describe('displayDurationWithinBudget', () => {
  it('passes for a 15s 24fps banner', () => {
    const doc = baseDisplayDoc({ frameRate: 24, durationFrames: 24 * 15 });
    expect(runOnly(displayDurationWithinBudget, doc).findings).toEqual([]);
  });

  it('accepts a composition exactly at the 30s GDN cap', () => {
    const doc = baseDisplayDoc({ frameRate: 30, durationFrames: 30 * 30 });
    expect(runOnly(displayDurationWithinBudget, doc).findings).toEqual([]);
  });

  it('errors past the 30s GDN cap', () => {
    const doc = baseDisplayDoc({ frameRate: 30, durationFrames: 30 * 31 });
    const report = runOnly(displayDurationWithinBudget, doc);
    expect(report.errorCount).toBe(1);
    expect(report.findings[0]?.severity).toBe('error');
  });

  it('does not run in non-display mode', () => {
    const doc = baseDisplayDoc({
      mode: 'video',
      frameRate: 30,
      durationFrames: 30 * 60,
    });
    expect(runOnly(displayDurationWithinBudget, doc).findings).toEqual([]);
  });
});

describe('displayFrameRateWithinBudget', () => {
  it('passes at the GDN-recommended 24 fps cap', () => {
    const doc = baseDisplayDoc({ frameRate: 24 });
    expect(runOnly(displayFrameRateWithinBudget, doc).findings).toEqual([]);
  });

  it('warns above 24 fps', () => {
    const doc = baseDisplayDoc({ frameRate: 60, durationFrames: 60 * 15 });
    const report = runOnly(displayFrameRateWithinBudget, doc);
    expect(report.warnCount).toBe(1);
    expect(report.findings[0]?.severity).toBe('warn');
  });

  it('does not run in non-display mode', () => {
    const doc = baseDisplayDoc({
      mode: 'video',
      frameRate: 60,
      durationFrames: 60 * 15,
    });
    expect(runOnly(displayFrameRateWithinBudget, doc).findings).toEqual([]);
  });
});

describe('displayHasVisibleElement', () => {
  it('passes when at least one visible element is present', () => {
    const doc = baseDisplayDoc({ elements: [textEl('t1')] });
    expect(runOnly(displayHasVisibleElement, doc).findings).toEqual([]);
  });

  it('errors when the element list is empty', () => {
    const doc = baseDisplayDoc({ elements: [] });
    const report = runOnly(displayHasVisibleElement, doc);
    expect(report.errorCount).toBe(1);
    expect(report.findings[0]?.severity).toBe('error');
  });

  it('errors when every element has visible=false', () => {
    const doc = baseDisplayDoc({
      elements: [textEl('t1', { visible: false }), shapeEl('s1', { visible: false })],
    });
    expect(runOnly(displayHasVisibleElement, doc).errorCount).toBe(1);
  });

  it('does not run in non-display mode', () => {
    const doc = baseDisplayDoc({ mode: 'slide', elements: [] });
    expect(runOnly(displayHasVisibleElement, doc).findings).toEqual([]);
  });
});

describe('DISPLAY_CLIP_KINDS', () => {
  it('names the five T-202 display clip implementations', () => {
    expect(new Set(DISPLAY_CLIP_KINDS)).toEqual(
      new Set(['click-overlay', 'countdown', 'product-carousel', 'price-reveal', 'cta-pulse']),
    );
  });

  it('has no duplicate kinds', () => {
    expect(new Set(DISPLAY_CLIP_KINDS).size).toBe(DISPLAY_CLIP_KINDS.length);
  });
});

describe('DISPLAY_TOOL_BUNDLES', () => {
  it('includes mode-agnostic read + create-mutate + timing + layout + validate', () => {
    for (const b of ['read', 'create-mutate', 'timing', 'layout', 'validate']) {
      expect(DISPLAY_TOOL_BUNDLES).toContain(b);
    }
  });

  it('includes clip-animation + element-cm1 + qc-export-bulk + semantic-layout', () => {
    for (const b of ['clip-animation', 'element-cm1', 'qc-export-bulk', 'semantic-layout']) {
      expect(DISPLAY_TOOL_BUNDLES).toContain(b);
    }
  });

  it('reserves the display-mode bundle for T-206', () => {
    expect(DISPLAY_TOOL_BUNDLES).toContain('display-mode');
  });

  it('excludes slide-oriented bundles + the video-mode bundle', () => {
    for (const b of ['slide-cm1', 'table-cm1', 'domain-finance-sales-okr', 'video-mode']) {
      expect(DISPLAY_TOOL_BUNDLES).not.toContain(b);
    }
  });

  it('has no duplicate bundle names', () => {
    expect(new Set(DISPLAY_TOOL_BUNDLES).size).toBe(DISPLAY_TOOL_BUNDLES.length);
  });
});

describe('DISPLAY_FILE_SIZE_BUDGETS_KB', () => {
  it('declares the IAB baseline at 150 KB', () => {
    expect(DISPLAY_FILE_SIZE_BUDGETS_KB.iabInitialLoadKb).toBe(150);
  });

  it('declares the GDN baseline at 150 KB', () => {
    expect(DISPLAY_FILE_SIZE_BUDGETS_KB.gdnInitialLoadKb).toBe(150);
  });

  it('permits a larger polite / subload value', () => {
    expect(DISPLAY_FILE_SIZE_BUDGETS_KB.iabPoliteLoadKb).toBeGreaterThan(
      DISPLAY_FILE_SIZE_BUDGETS_KB.iabInitialLoadKb,
    );
  });
});

describe('displayProfile', () => {
  it('is the display descriptor', () => {
    expect(displayProfile.mode).toBe('display');
  });

  it('bundles the published rule set', () => {
    expect([...displayProfile.rules]).toEqual([...DISPLAY_RULES]);
  });

  it('exposes the element-type allowlist as a Set', () => {
    expect(displayProfile.allowedElementTypes).toBeInstanceOf(Set);
    expect(displayProfile.allowedElementTypes.has('text')).toBe(true);
    expect(displayProfile.allowedElementTypes.has('video')).toBe(false);
  });

  it('exposes the clip-kind catalog as a Set', () => {
    expect(displayProfile.clipKinds).toBeInstanceOf(Set);
    expect(displayProfile.clipKinds.has('click-overlay')).toBe(true);
    expect(displayProfile.clipKinds.has('unknown-kind')).toBe(false);
  });

  it('exposes the tool-bundle allowlist as a Set', () => {
    expect(displayProfile.toolBundles).toBeInstanceOf(Set);
    expect(displayProfile.toolBundles.has('clip-animation')).toBe(true);
    expect(displayProfile.toolBundles.has('video-mode')).toBe(false);
  });

  it('every rule has a stable id prefixed with display-', () => {
    for (const rule of DISPLAY_RULES) {
      expect(rule.id.startsWith('display-')).toBe(true);
    }
  });

  it('rule ids are unique', () => {
    const ids = DISPLAY_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
