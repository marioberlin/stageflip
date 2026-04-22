// packages/parity-cli/src/prime.test.ts
// Unit tests for the pure `primeFixture` orchestrator. Uses a fake
// `PrimeRenderFn` that returns deterministic canned PNG bytes + a
// fake `PrimeFsOps` backed by a Map, so no real filesystem or
// real browser is touched.

import type { RIRDocument } from '@stageflip/rir';
import { describe, expect, it } from 'vitest';

import { DEFAULT_PRIME_PATTERN, type PrimeFsOps, primeFixture } from './prime.js';

const SYNTH_DOC: RIRDocument = {
  id: 'test-doc',
  width: 320,
  height: 240,
  frameRate: 30,
  durationFrames: 30,
  mode: 'slide',
  elements: [
    {
      id: 'bg',
      type: 'shape',
      transform: { x: 0, y: 0, width: 320, height: 240, rotation: 0, opacity: 1 },
      timing: { startFrame: 0, endFrame: 30, durationFrames: 30 },
      zIndex: 0,
      visible: true,
      locked: false,
      stacking: 'auto',
      animations: [],
      content: { type: 'shape', shape: 'rect', fill: '#111' },
    },
  ],
  stackingMap: { bg: 'auto' },
  fontRequirements: [],
  meta: {
    sourceDocId: 'test',
    sourceVersion: 1,
    compilerVersion: '0.0.0-test',
    digest: 'test-digest',
  },
};

function makeFakeFs(): PrimeFsOps & { written: Map<string, Uint8Array>; mkdirs: string[] } {
  const written = new Map<string, Uint8Array>();
  const mkdirs: string[] = [];
  return {
    written,
    mkdirs,
    async mkdir(path) {
      mkdirs.push(path);
    },
    async writeFile(path, data) {
      written.set(path, data);
    },
  };
}

const canned = (frame: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, frame & 0xff]);

describe('primeFixture', () => {
  it('renders each frame and writes one PNG per frame', async () => {
    const fs = makeFakeFs();
    const outcome = await primeFixture(
      { name: 'fx', document: SYNTH_DOC, frames: [0, 14, 29] },
      { render: (_d, f) => Promise.resolve(canned(f)), fs, outDir: '/tmp/out' },
    );
    expect(outcome.name).toBe('fx');
    expect(outcome.dryRun).toBe(false);
    expect(outcome.writtenPaths).toEqual([
      '/tmp/out/fx/frame-0.png',
      '/tmp/out/fx/frame-14.png',
      '/tmp/out/fx/frame-29.png',
    ]);
    expect(fs.written.size).toBe(3);
    expect(fs.written.get('/tmp/out/fx/frame-14.png')?.at(4)).toBe(14);
    expect(fs.mkdirs).toEqual(['/tmp/out/fx']);
    expect(outcome.summary).toMatch(/primed 3 PNG\(s\)/);
  });

  it('respects a custom filename pattern', async () => {
    const fs = makeFakeFs();
    const outcome = await primeFixture(
      {
        name: 'fx',
        document: SYNTH_DOC,
        frames: [7],
        pattern: 'golden-${frame}-v1.png',
      },
      { render: (_d, f) => Promise.resolve(canned(f)), fs, outDir: '/root' },
    );
    expect(outcome.writtenPaths).toEqual(['/root/fx/golden-7-v1.png']);
    expect(fs.written.has('/root/fx/golden-7-v1.png')).toBe(true);
  });

  it('substitutes every occurrence of ${frame} in the pattern', async () => {
    const fs = makeFakeFs();
    const outcome = await primeFixture(
      { name: 'fx', document: SYNTH_DOC, frames: [3], pattern: 'f${frame}/f${frame}.png' },
      { render: (_d, f) => Promise.resolve(canned(f)), fs, outDir: '/o' },
    );
    expect(outcome.writtenPaths).toEqual(['/o/fx/f3/f3.png']);
  });

  it('uses DEFAULT_PRIME_PATTERN when pattern is omitted', async () => {
    const fs = makeFakeFs();
    const outcome = await primeFixture(
      { name: 'fx', document: SYNTH_DOC, frames: [0] },
      { render: () => Promise.resolve(canned(0)), fs, outDir: '/o' },
    );
    expect(DEFAULT_PRIME_PATTERN).toBe('frame-${frame}.png');
    expect(outcome.writtenPaths).toEqual(['/o/fx/frame-0.png']);
  });

  it('under dry-run, returns paths without invoking render or fs', async () => {
    const fs = makeFakeFs();
    let renderCalls = 0;
    const outcome = await primeFixture(
      { name: 'fx', document: SYNTH_DOC, frames: [0, 10] },
      {
        render: async () => {
          renderCalls += 1;
          return canned(0);
        },
        fs,
        outDir: '/o',
        dryRun: true,
      },
    );
    expect(renderCalls).toBe(0);
    expect(fs.written.size).toBe(0);
    expect(fs.mkdirs).toEqual([]);
    expect(outcome.dryRun).toBe(true);
    expect(outcome.writtenPaths).toEqual(['/o/fx/frame-0.png', '/o/fx/frame-10.png']);
    expect(outcome.summary).toMatch(/dry-run/);
  });

  it('creates the fixture subdir before writing', async () => {
    const fs = makeFakeFs();
    const order: string[] = [];
    await primeFixture(
      { name: 'fx', document: SYNTH_DOC, frames: [0] },
      {
        render: () => Promise.resolve(canned(0)),
        fs: {
          async mkdir(path) {
            order.push(`mkdir:${path}`);
          },
          async writeFile(path) {
            order.push(`write:${path}`);
          },
        },
        outDir: '/o',
      },
    );
    expect(order).toEqual(['mkdir:/o/fx', 'write:/o/fx/frame-0.png']);
  });

  it('propagates render errors', async () => {
    const fs = makeFakeFs();
    await expect(
      primeFixture(
        { name: 'fx', document: SYNTH_DOC, frames: [0] },
        {
          render: () => Promise.reject(new Error('browser crashed')),
          fs,
          outDir: '/o',
        },
      ),
    ).rejects.toThrow('browser crashed');
  });

  it('propagates writeFile errors', async () => {
    await expect(
      primeFixture(
        { name: 'fx', document: SYNTH_DOC, frames: [0] },
        {
          render: () => Promise.resolve(canned(0)),
          fs: {
            async mkdir() {},
            async writeFile() {
              throw new Error('ENOSPC');
            },
          },
          outDir: '/o',
        },
      ),
    ).rejects.toThrow('ENOSPC');
  });

  it('throws when frames is empty (loud rather than silent no-op)', async () => {
    const fs = makeFakeFs();
    await expect(
      primeFixture(
        { name: 'fx', document: SYNTH_DOC, frames: [] },
        { render: () => Promise.resolve(canned(0)), fs, outDir: '/o' },
      ),
    ).rejects.toThrow(/no frames/);
  });
});
