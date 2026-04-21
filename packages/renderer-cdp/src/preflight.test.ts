// packages/renderer-cdp/src/preflight.test.ts

import type { RIRDocument, RIRElement } from '@stageflip/rir';
import type { ClipDefinition, ClipRuntime, FontRequirement } from '@stageflip/runtimes-contract';
import { __clearRuntimeRegistry, registerRuntime } from '@stageflip/runtimes-contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { preflight } from './preflight';

function stubClip(kind: string): ClipDefinition<unknown> {
  return { kind, render: () => null };
}

function stubRuntime(
  id: string,
  kinds: readonly string[],
  tier: 'live' | 'bake' = 'live',
): ClipRuntime {
  const clips = new Map<string, ClipDefinition<unknown>>();
  for (const kind of kinds) clips.set(kind, stubClip(kind));
  return { id, tier, clips };
}

function clipElement(id: string, runtime: string, clipName: string): RIRElement {
  return {
    id,
    type: 'clip',
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
    timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
    zIndex: 0,
    visible: true,
    locked: false,
    stacking: 'auto',
    animations: [],
    content: { type: 'clip', runtime, clipName, params: {} },
  };
}

function doc(
  elements: readonly RIRElement[],
  fontRequirements: readonly FontRequirement[] = [],
): RIRDocument {
  return {
    id: 'doc-1',
    width: 1920,
    height: 1080,
    frameRate: 30,
    durationFrames: 300,
    mode: 'slide',
    elements: [...elements],
    stackingMap: {},
    fontRequirements: [...fontRequirements],
    meta: {
      sourceDocId: 'src-1',
      sourceVersion: 1,
      compilerVersion: '0.0.0-test',
      digest: 'sha-test',
    },
  };
}

beforeEach(() => {
  __clearRuntimeRegistry();
});

afterEach(() => {
  __clearRuntimeRegistry();
});

describe('preflight', () => {
  it('returns canonical aggregated font requirements', () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    const report = preflight(
      doc(
        [clipElement('a', 'css', 'solid-background')],
        [
          { family: 'Inter', weight: 400 },
          { family: 'Inter', weight: 700 },
          { family: 'Inter', weight: 400 }, // dup — aggregator dedupes
        ],
      ),
    );
    expect(report.fonts).toHaveLength(2);
    expect(report.fonts.map((f) => f.weight).sort()).toEqual([400, 700]);
  });

  it('reports unresolved clips as blockers', () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    const report = preflight(
      doc([
        clipElement('good', 'css', 'solid-background'),
        clipElement('bad', 'gsap', 'no-such-clip'),
      ]),
    );
    expect(report.blockers).toHaveLength(1);
    expect(report.blockers[0]?.kind).toBe('unresolved-clips');
    expect(report.blockers[0]?.message).toMatch(/no-such-clip/);
  });

  it('separates live-tier and bake-tier work', () => {
    registerRuntime(stubRuntime('css', ['solid-background'], 'live'));
    registerRuntime(stubRuntime('bake-runtime', ['heavy-three'], 'bake'));

    const report = preflight(
      doc([
        clipElement('a', 'css', 'solid-background'),
        clipElement('b', 'bake-runtime', 'heavy-three'),
      ]),
    );

    expect(report.liveTasks).toHaveLength(1);
    expect(report.liveTasks[0]?.element.id).toBe('a');
    expect(report.bakeTasks).toHaveLength(1);
    expect(report.bakeTasks[0]?.element.id).toBe('b');
  });

  it('blocks when bake-tier work is present (T-089 interfaces-only)', () => {
    registerRuntime(stubRuntime('bake-runtime', ['heavy-three'], 'bake'));

    const report = preflight(doc([clipElement('b', 'bake-runtime', 'heavy-three')]));

    expect(report.blockers.some((b) => b.kind === 'bake-not-implemented')).toBe(true);
  });

  it('passes when the document is live-only and every clip resolves', () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    const report = preflight(doc([clipElement('a', 'css', 'solid-background')]));
    expect(report.blockers).toHaveLength(0);
    expect(report.liveTasks).toHaveLength(1);
    expect(report.bakeTasks).toHaveLength(0);
  });

  it('placeholder-stubs assetRefs for T-084a to fill in', () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    const report = preflight(doc([clipElement('a', 'css', 'solid-background')]));
    expect(Array.isArray(report.assetRefs)).toBe(true);
    expect(report.assetRefs).toHaveLength(0);
  });

  it('empty document produces an empty, non-blocking report', () => {
    const report = preflight(doc([]));
    expect(report.blockers).toHaveLength(0);
    expect(report.liveTasks).toHaveLength(0);
    expect(report.bakeTasks).toHaveLength(0);
    expect(report.fonts).toHaveLength(0);
  });
});
