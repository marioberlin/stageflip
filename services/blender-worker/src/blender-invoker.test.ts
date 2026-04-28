// services/blender-worker/src/blender-invoker.test.ts
// T-265 AC #24 — GPU/CPU dual-path. Blender is mocked; we verify the invoker
// tries GPU first when CUDA is available, falls back to CPU on GPU failure,
// and reports cpuFallback correctly.

import { EventEmitter } from 'node:events';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { BakeJobPayload } from '@stageflip/runtimes-blender';
import { describe, expect, it, vi } from 'vitest';

import { createBlenderCliInvoker } from './blender-invoker.js';

const PAYLOAD: BakeJobPayload = {
  bakeId: 'b1',
  inputsHash: 'a'.repeat(64),
  scene: { template: 'fluid-sim', params: {} },
  duration: { durationMs: 33, fps: 30 },
  outputBucket: 'b',
  region: 'us',
};

/**
 * A child-process stub: returns {exit code, stderr, stdoutDir} per call. Side
 * effect on success: writes 1 PNG to the outputDir read from stdin's JSON.
 */
function makeSpawn(
  scenarios: ReadonlyArray<{ ok: true; framesToWrite: number } | { ok: false; stderr: string }>,
): { spawn: ReturnType<typeof vi.fn>; calls: Array<{ argv: readonly string[] }> } {
  const calls: Array<{ argv: readonly string[] }> = [];
  let i = 0;
  const spawn = vi.fn(
    (
      _bin: string,
      argv: readonly string[],
      _opts: unknown,
    ): import('node:child_process').ChildProcess => {
      const scenario = scenarios[i++];
      if (scenario === undefined) {
        throw new Error('makeSpawn: ran out of scenarios');
      }
      calls.push({ argv });
      const ee = new EventEmitter() as unknown as import('node:child_process').ChildProcess & {
        stdin: { end: (b: string) => void };
        stderr: EventEmitter;
        stdout: EventEmitter;
      };
      const stderr = new EventEmitter();
      const stdout = new EventEmitter();
      Object.assign(ee, { stderr, stdout });
      const stdin = {
        end: (params: string) => {
          // Parse outputDir from stdin JSON, write the requested frames.
          const parsed = JSON.parse(params) as { outputDir: string };
          if (scenario.ok) {
            for (let f = 0; f < scenario.framesToWrite; f++) {
              writeFileSync(join(parsed.outputDir, `frame-${f}.png`), Buffer.from([0x89, 0x50]));
            }
            queueMicrotask(() => ee.emit('exit', 0));
          } else {
            stderr.emit('data', Buffer.from(scenario.stderr));
            queueMicrotask(() => ee.emit('exit', 1));
          }
        },
      };
      Object.assign(ee, { stdin });
      return ee;
    },
  ) as ReturnType<typeof vi.fn>;
  return { spawn, calls };
}

describe('BlenderCliInvoker — GPU available, GPU succeeds (T-265 AC #24)', () => {
  it('invokes once with cpuFallback: false', async () => {
    const { spawn } = makeSpawn([{ ok: true, framesToWrite: 1 }]);
    const invoker = createBlenderCliInvoker({
      blenderBin: '/fake/blender',
      renderScript: '/fake/render.py',
      gpuAvailable: () => true,
      spawn: spawn as unknown as typeof import('node:child_process').spawn,
    });
    const result = await invoker.render(PAYLOAD);
    expect(result.cpuFallback).toBe(false);
    expect(result.frames).toHaveLength(1);
    expect(spawn).toHaveBeenCalledTimes(1);
  });
});

describe('BlenderCliInvoker — GPU available, GPU fails → CPU fallback (T-265 AC #24)', () => {
  it('reports cpuFallback: true after GPU error', async () => {
    const { spawn } = makeSpawn([
      { ok: false, stderr: 'CUDA error: out of memory' },
      { ok: true, framesToWrite: 1 },
    ]);
    const invoker = createBlenderCliInvoker({
      blenderBin: '/fake/blender',
      renderScript: '/fake/render.py',
      gpuAvailable: () => true,
      spawn: spawn as unknown as typeof import('node:child_process').spawn,
    });
    const result = await invoker.render(PAYLOAD);
    expect(result.cpuFallback).toBe(true);
    expect(result.frames).toHaveLength(1);
    expect(spawn).toHaveBeenCalledTimes(2);
  });
});

describe('BlenderCliInvoker — GPU unavailable → CPU only (T-265 AC #24)', () => {
  it('skips GPU attempt entirely', async () => {
    const { spawn } = makeSpawn([{ ok: true, framesToWrite: 1 }]);
    const invoker = createBlenderCliInvoker({
      blenderBin: '/fake/blender',
      renderScript: '/fake/render.py',
      gpuAvailable: () => false,
      spawn: spawn as unknown as typeof import('node:child_process').spawn,
    });
    const result = await invoker.render(PAYLOAD);
    expect(result.cpuFallback).toBe(true);
    expect(spawn).toHaveBeenCalledTimes(1);
  });
});

describe('BlenderCliInvoker — propagates fatal CPU error', () => {
  it('throws when both GPU and CPU fail', async () => {
    const { spawn } = makeSpawn([
      { ok: false, stderr: 'CUDA error' },
      { ok: false, stderr: 'CPU render failed: missing dep' },
    ]);
    const invoker = createBlenderCliInvoker({
      blenderBin: '/fake/blender',
      renderScript: '/fake/render.py',
      gpuAvailable: () => true,
      spawn: spawn as unknown as typeof import('node:child_process').spawn,
    });
    await expect(invoker.render(PAYLOAD)).rejects.toThrow(/blender exited/);
  });
});

// Sanity: tmpdir path exists for the test environment.
describe('test-environment sanity', () => {
  it('tmpdir is writable', () => {
    const d = mkdtempSync(join(tmpdir(), 'bw-test-'));
    expect(d).toBeTypeOf('string');
  });
});
