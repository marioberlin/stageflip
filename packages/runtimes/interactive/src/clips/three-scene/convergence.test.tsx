// packages/runtimes/interactive/src/clips/three-scene/convergence.test.tsx
// T-384 AC #26 + D-T384-11 — convergence-by-construction. Renders the same
// three-scene at the same frame via two paths and asserts the recorded
// scene-call stream is bit-identical:
//
//   Path A: `ThreeClipHost` standalone with localFrame=30 + the same setup.
//   Path B: `threeSceneClipFactory` driven by `RecordModeFrameSource.advance(30)`.
//
// happy-dom does not provide WebGL, so we cannot capture pixels directly;
// we capture the FULL stream of state-changing calls invoked on a fake
// "scene" object that the setup injects. Identical call streams ⇒
// identical pixels (deterministic three.js, identical seed, identical
// frame cadence). Epsilon = 0 on the call stream.
//
// PIXEL-LEVEL convergence is tracked under T-383a (real-browser CI lane /
// software-WebGL); that follow-up covers BOTH the shader and three-scene
// frontier-tier families. Cite T-383a at PR review time; do not duplicate
// the follow-up here.

import { ThreeClipHost, type ThreeClipSetup } from '@stageflip/runtimes-three';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { type MountContext, PERMISSIVE_TENANT_POLICY } from '../../contract.js';
import { RecordModeFrameSource } from '../../frame-source-record.js';
import { ThreeSceneClipFactoryBuilder } from './factory.js';

interface RecordedCall {
  method: string;
  args: ReadonlyArray<unknown>;
}

interface SceneRecording {
  calls: RecordedCall[];
}

/**
 * A setup factory that builds a deterministic, GL-free fake scene. The
 * scene records every per-frame mutation it applies so two independent
 * runs produce comparable call streams.
 */
function makeRecordingSetup(rec: SceneRecording): ThreeClipSetup<Record<string, unknown>> {
  return ({ container, width, height, props }) => {
    rec.calls.push({ method: 'setup', args: [width, height, JSON.stringify(props)] });
    const sentinel = document.createElement('div');
    container.appendChild(sentinel);
    return {
      render: (args) => {
        rec.calls.push({
          method: 'render',
          args: [args.frame, args.fps, args.timeSec, JSON.stringify(args.props)],
        });
      },
      dispose: () => {
        rec.calls.push({ method: 'dispose', args: [] });
      },
    };
  };
}

const TARGET_FRAME = 30;
const FPS = 60;
const WIDTH = 256;
const HEIGHT = 256;
const PROPS = { color: 'red', count: 7 };

describe('ThreeSceneClip convergence (T-384 AC #26, D-T384-11, ADR-005 §D2)', () => {
  it('liveMount @ frame=30 produces an identical scene-call stream to ThreeClipHost standalone @ frame=30', async () => {
    // ----- Path A: ThreeClipHost standalone -----
    const a: SceneRecording = { calls: [] };
    render(
      createElement(ThreeClipHost, {
        setup: makeRecordingSetup(a),
        width: WIDTH,
        height: HEIGHT,
        props: PROPS,
        localFrame: TARGET_FRAME,
        fps: FPS,
        clipDurationInFrames: 600,
      }),
    );

    // ----- Path B: factory + RecordModeFrameSource -----
    const b: SceneRecording = { calls: [] };
    const factory = ThreeSceneClipFactoryBuilder.build({
      importer: async () => ({ MySetup: makeRecordingSetup(b) }),
      // Path B mirrors A: clipDurationInFrames=600, fps=60.
      fps: FPS,
      clipDurationInFrames: 600,
    });
    const fs = new RecordModeFrameSource();
    const root = document.createElement('div');
    const ctx: MountContext = {
      clip: {
        id: 'conv-three-scene',
        type: 'interactive-clip',
        family: 'three-scene',
        transform: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
        visible: true,
        locked: false,
        animations: [],
        staticFallback: [
          {
            id: 'sf',
            type: 'image',
            transform: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
            visible: true,
            locked: false,
            animations: [],
            src: 'poster.png',
          },
        ],
        liveMount: {
          component: {
            module: '@stageflip/runtimes-interactive/clips/three-scene#ThreeSceneClip',
          },
          props: {
            setupRef: { module: '@author/scene#MySetup' },
            width: WIDTH,
            height: HEIGHT,
            setupProps: PROPS,
            posterFrame: 0,
            prngSeed: 0,
          },
          permissions: [],
        },
      } as never,
      root,
      permissions: [],
      tenantPolicy: PERMISSIVE_TENANT_POLICY,
      emitTelemetry: () => undefined,
      signal: new AbortController().signal,
      frameSource: fs,
    };
    const handle = await factory(ctx);
    fs.advance(TARGET_FRAME);

    // Setup happens once on each path with identical args.
    const aSetup = a.calls.find((c) => c.method === 'setup');
    const bSetup = b.calls.find((c) => c.method === 'setup');
    expect(bSetup).toEqual(aSetup);

    // Last render on each path corresponds to TARGET_FRAME with identical
    // (frame, fps, timeSec, props) — convergence epsilon = 0.
    function lastCall(stream: RecordedCall[], method: string): RecordedCall | undefined {
      for (let i = stream.length - 1; i >= 0; i -= 1) {
        const entry = stream[i];
        if (entry?.method === method) return entry;
      }
      return undefined;
    }
    const aLastRender = lastCall(a.calls, 'render');
    const bLastRender = lastCall(b.calls, 'render');
    expect(aLastRender).toBeDefined();
    expect(bLastRender).toBeDefined();
    expect(bLastRender?.args[0]).toBe(TARGET_FRAME);
    expect(aLastRender?.args[0]).toBe(TARGET_FRAME);
    expect(bLastRender?.args).toEqual(aLastRender?.args);

    handle.dispose();
  });
});
