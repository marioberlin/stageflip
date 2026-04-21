// packages/renderer-cdp/src/dispatch.test.ts

import type { RIRDocument, RIRElement } from '@stageflip/rir';
import type { ClipDefinition, ClipRuntime } from '@stageflip/runtimes-contract';
import { __clearRuntimeRegistry, findClip, registerRuntime } from '@stageflip/runtimes-contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { dispatchClips } from './dispatch';

// --- test helpers -----------------------------------------------------------

function stubClip(kind: string): ClipDefinition<unknown> {
  return { kind, render: () => null };
}

function stubRuntime(id: string, kinds: readonly string[]): ClipRuntime {
  const clips = new Map<string, ClipDefinition<unknown>>();
  for (const kind of kinds) clips.set(kind, stubClip(kind));
  return { id, tier: 'live', clips };
}

function clipElement(
  id: string,
  runtime: string,
  clipName: string,
  params: Record<string, unknown> = {},
): RIRElement {
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
    content: { type: 'clip', runtime, clipName, params },
  };
}

function textElement(id: string): RIRElement {
  return {
    id,
    type: 'text',
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
    timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
    zIndex: 0,
    visible: true,
    locked: false,
    stacking: 'auto',
    animations: [],
    content: {
      type: 'text',
      text: 'hello',
      fontFamily: 'Inter',
      fontSize: 24,
      fontWeight: 400,
      color: '#000000',
      align: 'left',
      lineHeight: 1.2,
    },
  };
}

function groupElement(id: string, children: readonly RIRElement[]): RIRElement {
  return {
    id,
    type: 'group',
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1 },
    timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
    zIndex: 0,
    visible: true,
    locked: false,
    stacking: 'auto',
    animations: [],
    content: { type: 'group', clip: false, children: [...children] },
  };
}

function doc(elements: readonly RIRElement[]): RIRDocument {
  return {
    id: 'doc-1',
    width: 1920,
    height: 1080,
    frameRate: 30,
    durationFrames: 300,
    mode: 'slide',
    elements: [...elements],
    stackingMap: {},
    fontRequirements: [],
    meta: {
      sourceDocId: 'src-1',
      sourceVersion: 1,
      compilerVersion: '0.0.0-test',
      digest: 'sha-test',
    },
  };
}

// --- tests ------------------------------------------------------------------

beforeEach(() => {
  __clearRuntimeRegistry();
});

afterEach(() => {
  __clearRuntimeRegistry();
});

describe('dispatchClips', () => {
  it('resolves every clip element against findClip and returns them in tree order', () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    registerRuntime(stubRuntime('gsap', ['motion-text-gsap']));

    const plan = dispatchClips(
      doc([
        clipElement('a', 'css', 'solid-background'),
        clipElement('b', 'gsap', 'motion-text-gsap'),
      ]),
    );

    expect(plan.resolved).toHaveLength(2);
    expect(plan.unresolved).toHaveLength(0);
    expect(plan.resolved[0]?.element.id).toBe('a');
    expect(plan.resolved[0]?.runtime.id).toBe('css');
    expect(plan.resolved[0]?.clip.kind).toBe('solid-background');
    expect(plan.resolved[1]?.element.id).toBe('b');
    expect(plan.resolved[1]?.runtime.id).toBe('gsap');
  });

  it('skips non-clip elements (text, shapes, etc.)', () => {
    registerRuntime(stubRuntime('css', ['solid-background']));

    const plan = dispatchClips(
      doc([textElement('t1'), clipElement('c1', 'css', 'solid-background'), textElement('t2')]),
    );

    expect(plan.resolved).toHaveLength(1);
    expect(plan.resolved[0]?.element.id).toBe('c1');
  });

  it('descends into groups and resolves nested clips', () => {
    registerRuntime(stubRuntime('css', ['solid-background']));
    registerRuntime(stubRuntime('gsap', ['motion-text-gsap']));

    const plan = dispatchClips(
      doc([
        groupElement('g1', [
          clipElement('nested-a', 'css', 'solid-background'),
          groupElement('g2', [clipElement('nested-b', 'gsap', 'motion-text-gsap')]),
        ]),
        clipElement('top', 'css', 'solid-background'),
      ]),
    );

    expect(plan.resolved.map((r) => r.element.id)).toEqual(['nested-a', 'nested-b', 'top']);
  });

  it('records an unresolved diagnostic when no runtime claims the kind', () => {
    registerRuntime(stubRuntime('css', ['solid-background']));

    const plan = dispatchClips(doc([clipElement('missing', 'gsap', 'no-such-clip')]));

    expect(plan.resolved).toHaveLength(0);
    expect(plan.unresolved).toHaveLength(1);
    expect(plan.unresolved[0]?.element.id).toBe('missing');
    expect(plan.unresolved[0]?.reason).toBe('unknown-kind');
    expect(plan.unresolved[0]?.requestedKind).toBe('no-such-clip');
    expect(plan.unresolved[0]?.requestedRuntime).toBe('gsap');
  });

  it('records a runtime-mismatch diagnostic when findClip resolves via a different runtime', () => {
    registerRuntime(stubRuntime('css', ['shared-kind']));

    const plan = dispatchClips(doc([clipElement('mismatch', 'gsap', 'shared-kind')]));

    expect(plan.resolved).toHaveLength(0);
    expect(plan.unresolved).toHaveLength(1);
    expect(plan.unresolved[0]?.reason).toBe('runtime-mismatch');
    expect(plan.unresolved[0]?.requestedRuntime).toBe('gsap');
  });

  it('returns an empty plan for a document with no clip elements', () => {
    const plan = dispatchClips(doc([textElement('t1'), textElement('t2')]));
    expect(plan.resolved).toHaveLength(0);
    expect(plan.unresolved).toHaveLength(0);
  });

  it('resolves all 6 live-tier runtime kinds through one code path', () => {
    // Matches the 6 runtimes registered in Phase 3:
    // css, gsap, lottie, shader, three, frame-runtime-bridge.
    registerRuntime(stubRuntime('css', ['solid-background']));
    registerRuntime(stubRuntime('gsap', ['motion-text-gsap']));
    registerRuntime(stubRuntime('lottie', ['lottie-logo']));
    registerRuntime(stubRuntime('shader', ['flash-through-white']));
    registerRuntime(stubRuntime('three', ['three-product-reveal']));
    registerRuntime(stubRuntime('frame-runtime', ['bridge-clip']));

    const plan = dispatchClips(
      doc([
        clipElement('a', 'css', 'solid-background'),
        clipElement('b', 'gsap', 'motion-text-gsap'),
        clipElement('c', 'lottie', 'lottie-logo'),
        clipElement('d', 'shader', 'flash-through-white'),
        clipElement('e', 'three', 'three-product-reveal'),
        clipElement('f', 'frame-runtime', 'bridge-clip'),
      ]),
    );

    expect(plan.resolved).toHaveLength(6);
    expect(plan.unresolved).toHaveLength(0);
    expect(plan.resolved.map((r) => r.runtime.id)).toEqual([
      'css',
      'gsap',
      'lottie',
      'shader',
      'three',
      'frame-runtime',
    ]);
  });

  it('findClip is the resolution primitive (sanity check)', () => {
    // Guards against accidental divergence between our dispatcher and the
    // registry's findClip semantics.
    registerRuntime(stubRuntime('css', ['solid-background']));
    expect(findClip('solid-background')?.runtime.id).toBe('css');
    expect(findClip('no-such-kind')).toBeNull();
  });
});
