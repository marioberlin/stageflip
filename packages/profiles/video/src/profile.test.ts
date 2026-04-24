// packages/profiles/video/src/profile.test.ts
// Coverage for the StageFlip.Video profile: element-type allowlist, the
// rules it contributes to the lint runner, and the assembled
// `videoProfile` descriptor.

import type { RIRDocument, RIRElement } from '@stageflip/rir';
import { lintDocument } from '@stageflip/validation';
import type { LintRule } from '@stageflip/validation';
import { describe, expect, it } from 'vitest';

import {
  VIDEO_ALLOWED_ELEMENT_TYPES,
  VIDEO_CLIP_KINDS,
  VIDEO_RULES,
  VIDEO_TOOL_BUNDLES,
  videoAspectRatioRecognized,
  videoDurationWithinBudget,
  videoElementTypesAllowed,
  videoHasVisualElement,
  videoProfile,
} from './index.js';

function baseVideoDoc(overrides: Partial<RIRDocument> = {}): RIRDocument {
  const doc: RIRDocument = {
    id: 'test-doc',
    width: 1920,
    height: 1080,
    frameRate: 30,
    durationFrames: 30 * 30, // 30s
    mode: 'video',
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

function audioEl(id: string, overrides: Partial<RIRElement> = {}): RIRElement {
  return {
    id,
    type: 'audio',
    transform: { x: 0, y: 0, width: 0, height: 0, rotation: 0, opacity: 1 },
    timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
    zIndex: 0,
    visible: false,
    locked: false,
    stacking: 'auto',
    animations: [],
    content: {
      type: 'audio',
      srcUrl: 'file:///audio.mp3',
      muted: false,
      loop: false,
      gain: 1,
      pan: 0,
      fadeInMs: 0,
      fadeOutMs: 0,
    },
    ...overrides,
  } as RIRElement;
}

function chartEl(id: string, overrides: Partial<RIRElement> = {}): RIRElement {
  return {
    id,
    type: 'chart',
    transform: { x: 0, y: 0, width: 400, height: 200, rotation: 0, opacity: 1 },
    timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
    zIndex: 0,
    visible: true,
    locked: false,
    stacking: 'auto',
    animations: [],
    content: {
      type: 'chart',
      chartKind: 'bar',
      data: { labels: [], series: [] },
      legend: true,
      axes: true,
    },
    ...overrides,
  } as RIRElement;
}

function runOnly(rule: LintRule, doc: RIRDocument) {
  return lintDocument(doc, { rules: [rule] });
}

describe('VIDEO_ALLOWED_ELEMENT_TYPES', () => {
  it('includes the visual + audio + clip composition types', () => {
    for (const t of ['text', 'image', 'video', 'audio', 'shape', 'group', 'clip', 'embed']) {
      expect(VIDEO_ALLOWED_ELEMENT_TYPES).toContain(t);
    }
  });

  it('excludes slide-oriented document types', () => {
    for (const t of ['chart', 'table', 'code']) {
      expect(VIDEO_ALLOWED_ELEMENT_TYPES).not.toContain(t);
    }
  });
});

describe('videoElementTypesAllowed', () => {
  it('emits no finding when every element type is in the allowlist', () => {
    const doc = baseVideoDoc({ elements: [shapeEl('s1'), audioEl('a1')] });
    expect(runOnly(videoElementTypesAllowed, doc).findings).toEqual([]);
  });

  it('emits an error when a disallowed element type appears', () => {
    const doc = baseVideoDoc({ elements: [chartEl('c1')] });
    const report = runOnly(videoElementTypesAllowed, doc);
    expect(report.errorCount).toBe(1);
    expect(report.findings[0]).toMatchObject({
      rule: videoElementTypesAllowed.id,
      severity: 'error',
      elementId: 'c1',
    });
  });

  it('does not run in non-video mode', () => {
    const doc = baseVideoDoc({ mode: 'slide', elements: [chartEl('c1')] });
    expect(runOnly(videoElementTypesAllowed, doc).findings).toEqual([]);
  });
});

describe('videoAspectRatioRecognized', () => {
  it.each([
    [1920, 1080], // 16:9
    [1080, 1920], // 9:16
    [1080, 1080], // 1:1
    [1080, 1350], // 4:5
    [2100, 900], // 21:9
  ])('accepts %sx%s', (width, height) => {
    const doc = baseVideoDoc({ width, height });
    expect(runOnly(videoAspectRatioRecognized, doc).findings).toEqual([]);
  });

  it('warns on unusual ratios', () => {
    const doc = baseVideoDoc({ width: 1000, height: 400 }); // 2.5 — unrecognized
    const report = runOnly(videoAspectRatioRecognized, doc);
    expect(report.warnCount).toBe(1);
    expect(report.findings[0]?.severity).toBe('warn');
  });

  it('does not run in non-video mode', () => {
    const doc = baseVideoDoc({ mode: 'slide', width: 1000, height: 400 });
    expect(runOnly(videoAspectRatioRecognized, doc).findings).toEqual([]);
  });
});

describe('videoDurationWithinBudget', () => {
  it('passes for a 30s 30fps video', () => {
    const doc = baseVideoDoc({ frameRate: 30, durationFrames: 30 * 30 });
    expect(runOnly(videoDurationWithinBudget, doc).findings).toEqual([]);
  });

  it('warns past the 10-minute budget', () => {
    const doc = baseVideoDoc({ frameRate: 30, durationFrames: 30 * 60 * 11 });
    const report = runOnly(videoDurationWithinBudget, doc);
    expect(report.warnCount).toBe(1);
  });

  it('does not run in non-video mode', () => {
    const doc = baseVideoDoc({
      mode: 'slide',
      frameRate: 30,
      durationFrames: 30 * 60 * 11,
    });
    expect(runOnly(videoDurationWithinBudget, doc).findings).toEqual([]);
  });
});

describe('videoHasVisualElement', () => {
  it('passes when at least one visual element is present', () => {
    const doc = baseVideoDoc({ elements: [shapeEl('s1'), audioEl('a1')] });
    expect(runOnly(videoHasVisualElement, doc).findings).toEqual([]);
  });

  it('errors when the only elements are audio', () => {
    const doc = baseVideoDoc({ elements: [audioEl('a1')] });
    const report = runOnly(videoHasVisualElement, doc);
    expect(report.errorCount).toBe(1);
    expect(report.findings[0]?.severity).toBe('error');
  });

  it('errors when there are no elements at all', () => {
    const doc = baseVideoDoc({ elements: [] });
    expect(runOnly(videoHasVisualElement, doc).errorCount).toBe(1);
  });

  it('does not run in non-video mode', () => {
    const doc = baseVideoDoc({ mode: 'slide', elements: [audioEl('a1')] });
    expect(runOnly(videoHasVisualElement, doc).findings).toEqual([]);
  });
});

describe('VIDEO_CLIP_KINDS', () => {
  it('names the six T-183 video clip implementations', () => {
    expect(new Set(VIDEO_CLIP_KINDS)).toEqual(
      new Set([
        'hook-moment',
        'product-reveal',
        'endslate-logo',
        'lower-third',
        'beat-synced-text',
        'testimonial-card',
      ]),
    );
  });

  it('has no duplicate kinds', () => {
    expect(new Set(VIDEO_CLIP_KINDS).size).toBe(VIDEO_CLIP_KINDS.length);
  });
});

describe('VIDEO_TOOL_BUNDLES', () => {
  it('includes mode-agnostic read + create-mutate + timing + layout + validate', () => {
    for (const b of ['read', 'create-mutate', 'timing', 'layout', 'validate']) {
      expect(VIDEO_TOOL_BUNDLES).toContain(b);
    }
  });

  it('includes clip-animation + element-cm1 + qc-export-bulk + semantic-layout', () => {
    for (const b of ['clip-animation', 'element-cm1', 'qc-export-bulk', 'semantic-layout']) {
      expect(VIDEO_TOOL_BUNDLES).toContain(b);
    }
  });

  it('includes the video-mode bundle (T-185)', () => {
    expect(VIDEO_TOOL_BUNDLES).toContain('video-mode');
  });

  it('excludes slide-oriented bundles (slide-cm1, table-cm1, domain composite)', () => {
    for (const b of ['slide-cm1', 'table-cm1', 'domain-finance-sales-okr']) {
      expect(VIDEO_TOOL_BUNDLES).not.toContain(b);
    }
  });

  it('has no duplicate bundle names', () => {
    expect(new Set(VIDEO_TOOL_BUNDLES).size).toBe(VIDEO_TOOL_BUNDLES.length);
  });
});

describe('videoProfile', () => {
  it('is the video descriptor', () => {
    expect(videoProfile.mode).toBe('video');
  });

  it('bundles the published rule set', () => {
    expect([...videoProfile.rules]).toEqual([...VIDEO_RULES]);
  });

  it('exposes the element-type allowlist as a Set', () => {
    expect(videoProfile.allowedElementTypes).toBeInstanceOf(Set);
    expect(videoProfile.allowedElementTypes.has('shape')).toBe(true);
    expect(videoProfile.allowedElementTypes.has('chart')).toBe(false);
  });

  it('exposes the clip-kind catalog as a Set', () => {
    expect(videoProfile.clipKinds).toBeInstanceOf(Set);
    expect(videoProfile.clipKinds.has('hook-moment')).toBe(true);
    expect(videoProfile.clipKinds.has('unknown-kind')).toBe(false);
  });

  it('exposes the tool-bundle allowlist as a Set', () => {
    expect(videoProfile.toolBundles).toBeInstanceOf(Set);
    expect(videoProfile.toolBundles.has('clip-animation')).toBe(true);
    expect(videoProfile.toolBundles.has('slide-cm1')).toBe(false);
  });

  it('every rule has a stable id prefixed with video-', () => {
    for (const rule of VIDEO_RULES) {
      expect(rule.id.startsWith('video-')).toBe(true);
    }
  });

  it('rule ids are unique', () => {
    const ids = VIDEO_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
