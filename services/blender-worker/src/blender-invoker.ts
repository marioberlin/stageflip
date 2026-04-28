// services/blender-worker/src/blender-invoker.ts
// Production BlenderInvoker — spawns the Blender CLI with our render.py
// script (T-265 D-T265-6, AC #21). Writes a parameter JSON to stdin, parses
// PNGs from a temp output dir.
//
// GPU/CPU dual-path (T-265 AC #24, D-T265-7): the invoker tries GPU first
// when `CUDA_VISIBLE_DEVICES` is set. On CUDA failure or env not present,
// it retries on CPU and reports `cpuFallback: true` to the worker.
//
// Security note: we use `node:child_process.spawn` with an explicit argv array
// (no `shell: true`); inputs flow through stdin as JSON, not through the
// command line. There is no shell-injection surface here.

import { spawn as nodeSpawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { BakeJobPayload } from '@stageflip/runtimes-blender';

import type { BlenderInvoker, BlenderRenderResult, CpuFallbackReason } from './worker.js';

export interface BlenderCliInvokerOptions {
  /** Path to the `blender` executable. Defaults to `'blender'` (PATH lookup). */
  readonly blenderBin?: string;
  /** Path to render.py. Defaults to ./scripts/render.py relative to this file. */
  readonly renderScript?: string;
  /** Override the GPU detection. Defaults to `process.env.CUDA_VISIBLE_DEVICES`. */
  readonly gpuAvailable?: () => boolean;
  /** Inject for tests; defaults to spawning a real subprocess. */
  readonly spawn?: typeof nodeSpawn;
}

interface RenderInvocation {
  readonly device: 'GPU' | 'CPU';
  readonly outputDir: string;
}

export function createBlenderCliInvoker(opts: BlenderCliInvokerOptions = {}): BlenderInvoker {
  const blenderBin = opts.blenderBin ?? 'blender';
  const renderScript =
    opts.renderScript ?? new URL('../scripts/render.py', import.meta.url).pathname;
  const gpuAvailable =
    opts.gpuAvailable ??
    (() => {
      const v = process.env.CUDA_VISIBLE_DEVICES;
      return typeof v === 'string' && v.length > 0;
    });
  const spawnFn = opts.spawn ?? nodeSpawn;

  async function invokeOnce(
    payload: BakeJobPayload,
    device: 'GPU' | 'CPU',
  ): Promise<RenderInvocation> {
    const outputDir = await mkdtemp(join(tmpdir(), `bake-${payload.inputsHash}-`));
    const params = JSON.stringify({
      template: payload.scene.template,
      params: payload.scene.params,
      durationMs: payload.duration.durationMs,
      fps: payload.duration.fps,
      device,
      outputDir,
    });
    await new Promise<void>((resolve, reject) => {
      const child = spawnFn(
        blenderBin,
        ['--background', '--python', renderScript, '--', '--from-stdin'],
        { stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const stderr: Buffer[] = [];
      child.stderr?.on('data', (b: Buffer) => stderr.push(b));
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        const text = Buffer.concat(stderr).toString('utf8');
        reject(new Error(`blender exited ${code}: ${text.slice(0, 2000)}`));
      });
      child.stdin?.end(params);
    });
    return { device, outputDir };
  }

  async function readFrames(dir: string): Promise<Uint8Array[]> {
    const names = (await readdir(dir))
      .filter((n) => /^frame-(\d+)\.png$/.test(n))
      .sort((a, b) => extractFrameIndex(a) - extractFrameIndex(b));
    const out: Uint8Array[] = [];
    for (const name of names) {
      const buf = await readFile(join(dir, name));
      out.push(new Uint8Array(buf));
    }
    return out;
  }

  return {
    async render(payload: BakeJobPayload): Promise<BlenderRenderResult> {
      const tryGpu = gpuAvailable();
      let cpuFallback = false;
      let cpuFallbackReason: CpuFallbackReason | undefined;
      let invocation: RenderInvocation;
      if (tryGpu) {
        try {
          invocation = await invokeOnce(payload, 'GPU');
        } catch {
          // GPU was configured but failed at runtime — this is a real fault
          // surface (CUDA OOM, driver error, …). Worker logs it at WARN.
          cpuFallback = true;
          cpuFallbackReason = 'gpu-runtime-failure';
          invocation = await invokeOnce(payload, 'CPU');
        }
      } else {
        // GPU was never configured — dev default. Worker logs it at INFO so
        // CUDA-failure WARNs in production stay legible.
        cpuFallback = true;
        cpuFallbackReason = 'gpu-not-configured';
        invocation = await invokeOnce(payload, 'CPU');
      }
      try {
        const frames = await readFrames(invocation.outputDir);
        return cpuFallbackReason
          ? { frames, cpuFallback, cpuFallbackReason }
          : { frames, cpuFallback };
      } finally {
        await rm(invocation.outputDir, { recursive: true, force: true });
      }
    },
  };
}

function extractFrameIndex(name: string): number {
  const m = /^frame-(\d+)\.png$/.exec(name);
  if (!m || m[1] === undefined) return 0;
  return Number.parseInt(m[1], 10);
}
