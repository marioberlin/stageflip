// packages/parity-cli/src/prime-cli.test.ts
// Tests for the `prime` subcommand's arg parser + orchestrator.
// Fully hermetic: uses a stub resolver + stub primer + fake fs.

import type { RIRDocument } from '@stageflip/rir';
import { describe, expect, it } from 'vitest';

import type { CliIo } from './cli.js';
import {
  PRIME_HELP_TEXT,
  type PrimeRuntimeFs,
  defaultReferenceFrames,
  parsePrimeArgs,
  runPrime,
} from './prime-cli.js';
import type { PrimeFixtureInput, PrimeRenderFn } from './prime.js';

function recorder(): CliIo & { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    stdout: (l) => void out.push(l),
    stderr: (l) => void err.push(l),
  };
}

function fakeFs(): PrimeRuntimeFs & { written: Map<string, Uint8Array>; mkdirs: string[] } {
  const written = new Map<string, Uint8Array>();
  const mkdirs: string[] = [];
  return {
    written,
    mkdirs,
    async mkdir(p) {
      mkdirs.push(p);
    },
    async writeFile(p, d) {
      written.set(p, d);
    },
  };
}

const SYNTH_DOC: RIRDocument = {
  id: 'x',
  width: 8,
  height: 8,
  frameRate: 30,
  durationFrames: 10,
  mode: 'slide',
  elements: [
    {
      id: 'bg',
      type: 'shape',
      transform: { x: 0, y: 0, width: 8, height: 8, rotation: 0, opacity: 1 },
      timing: { startFrame: 0, endFrame: 10, durationFrames: 10 },
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
    sourceDocId: 't',
    sourceVersion: 1,
    compilerVersion: '0.0.0-t',
    digest: 'd',
  },
};

const SYNTH_INPUTS: readonly PrimeFixtureInput[] = [
  { name: 'fx1', document: SYNTH_DOC, frames: [0, 4, 9] },
  { name: 'fx2', document: SYNTH_DOC, frames: [0] },
];

const stubRender: PrimeRenderFn = async (_d, f) => new Uint8Array([0x89, f]);

describe('parsePrimeArgs', () => {
  it('parses --reference-fixtures + --out', () => {
    const o = parsePrimeArgs(['--reference-fixtures', '--out', '/tmp/goldens']);
    expect(o.referenceFixtures).toBe(true);
    expect(o.outDir).toBe('/tmp/goldens');
    expect(o.dryRun).toBe(false);
    expect(o.parityFixturesDir).toBeUndefined();
  });

  it('parses --parity <dir> + --out', () => {
    const o = parsePrimeArgs(['--parity', 'packages/testing/fixtures', '--out', '/tmp/goldens']);
    expect(o.referenceFixtures).toBe(false);
    expect(o.parityFixturesDir).toBe('packages/testing/fixtures');
    expect(o.outDir).toBe('/tmp/goldens');
  });

  it('throws on --parity without argument', () => {
    expect(() => parsePrimeArgs(['--parity'])).toThrow(/requires a fixtures-dir argument/);
  });

  it('parses --dry-run', () => {
    const o = parsePrimeArgs(['--reference-fixtures', '--out', '/o', '--dry-run']);
    expect(o.dryRun).toBe(true);
  });

  it('parses --help and -h', () => {
    expect(parsePrimeArgs(['--help']).help).toBe(true);
    expect(parsePrimeArgs(['-h']).help).toBe(true);
  });

  it('throws on --out without argument', () => {
    expect(() => parsePrimeArgs(['--out'])).toThrow(/requires an argument/);
  });

  it('throws on unknown flag', () => {
    expect(() => parsePrimeArgs(['--nope'])).toThrow(/unknown flag/);
  });

  it('throws on unexpected positional', () => {
    expect(() => parsePrimeArgs(['extra'])).toThrow(/unexpected positional/);
  });
});

describe('runPrime', () => {
  const resolver = {
    async resolve() {
      return SYNTH_INPUTS;
    },
  };

  it('prints help + exits 0 on --help', async () => {
    const io = recorder();
    const exit = await runPrime(
      ['--help'],
      {
        resolver,
        createPrimer: async () => ({ render: stubRender, close: async () => {} }),
      },
      io,
    );
    expect(exit).toBe(0);
    expect(io.out.join('\n')).toContain('USAGE');
    expect(PRIME_HELP_TEXT).toContain('--reference-fixtures');
  });

  it('exits 2 when neither --reference-fixtures nor --parity is set', async () => {
    const io = recorder();
    const exit = await runPrime(
      ['--out', '/o'],
      {
        resolver,
        createPrimer: async () => ({ render: stubRender, close: async () => {} }),
      },
      io,
    );
    expect(exit).toBe(2);
    expect(io.err.join('\n')).toContain(
      'one of --reference-fixtures or --parity <dir> is required',
    );
  });

  it('exits 2 when both --reference-fixtures AND --parity are passed', async () => {
    const io = recorder();
    const exit = await runPrime(
      ['--reference-fixtures', '--parity', '/fx', '--out', '/o'],
      {
        resolver,
        createPrimer: async () => ({ render: stubRender, close: async () => {} }),
      },
      io,
    );
    expect(exit).toBe(2);
    expect(io.err.join('\n')).toContain('mutually exclusive');
  });

  it('exits 2 when --out is missing', async () => {
    const io = recorder();
    const exit = await runPrime(
      ['--reference-fixtures'],
      {
        resolver,
        createPrimer: async () => ({ render: stubRender, close: async () => {} }),
      },
      io,
    );
    expect(exit).toBe(2);
    expect(io.err.join('\n')).toContain('--out <dir> is required');
  });

  it('exits 2 on unknown flag with usage', async () => {
    const io = recorder();
    const exit = await runPrime(
      ['--nope'],
      {
        resolver,
        createPrimer: async () => ({ render: stubRender, close: async () => {} }),
      },
      io,
    );
    expect(exit).toBe(2);
    expect(io.err.join('\n')).toContain('unknown flag');
    expect(io.err.join('\n')).toContain('USAGE');
  });

  it('primes every input and closes the primer', async () => {
    const io = recorder();
    const fs = fakeFs();
    let closed = false;
    const exit = await runPrime(
      ['--reference-fixtures', '--out', '/out'],
      {
        resolver,
        createPrimer: async () => ({
          render: stubRender,
          close: async () => {
            closed = true;
          },
        }),
        fs,
      },
      io,
    );
    expect(exit).toBe(0);
    expect(fs.written.size).toBe(4); // 3 + 1 frames
    expect(fs.mkdirs).toEqual(['/out/fx1', '/out/fx2']);
    expect(closed).toBe(true);
    const out = io.out.join('\n');
    expect(out).toContain('primed 3 PNG(s)');
    expect(out).toContain('primed 1 PNG(s)');
  });

  it('dry-run skips primer creation + writeFile', async () => {
    const io = recorder();
    const fs = fakeFs();
    let primerCreated = false;
    const exit = await runPrime(
      ['--reference-fixtures', '--out', '/out', '--dry-run'],
      {
        resolver,
        createPrimer: async () => {
          primerCreated = true;
          return { render: stubRender, close: async () => {} };
        },
        fs,
      },
      io,
    );
    expect(exit).toBe(0);
    expect(primerCreated).toBe(false);
    expect(fs.written.size).toBe(0);
    expect(fs.mkdirs).toEqual([]);
    expect(io.out.join('\n')).toContain('dry-run');
  });

  it('closes the primer even if a render fails', async () => {
    const io = recorder();
    const fs = fakeFs();
    let closed = false;
    await expect(
      runPrime(
        ['--reference-fixtures', '--out', '/out'],
        {
          resolver,
          createPrimer: async () => ({
            render: async () => {
              throw new Error('chrome crashed');
            },
            close: async () => {
              closed = true;
            },
          }),
          fs,
        },
        io,
      ),
    ).rejects.toThrow('chrome crashed');
    expect(closed).toBe(true);
  });

  it('exits 2 when the resolver returns no fixtures', async () => {
    const io = recorder();
    const exit = await runPrime(
      ['--reference-fixtures', '--out', '/out'],
      {
        resolver: { resolve: async () => [] },
        createPrimer: async () => ({ render: stubRender, close: async () => {} }),
      },
      io,
    );
    expect(exit).toBe(2);
    expect(io.err.join('\n')).toContain('resolver returned no fixtures');
  });

  it('forwards opts.parityFixturesDir to the resolver so --parity routes correctly', async () => {
    const io = recorder();
    const fs = fakeFs();
    let receivedOpts: { referenceFixtures?: boolean; parityFixturesDir?: string } | null = null;
    const exit = await runPrime(
      ['--parity', '/fx', '--out', '/out'],
      {
        resolver: {
          async resolve(opts) {
            receivedOpts = opts;
            return SYNTH_INPUTS;
          },
        },
        createPrimer: async () => ({ render: stubRender, close: async () => {} }),
        fs,
      },
      io,
    );
    expect(exit).toBe(0);
    expect(receivedOpts).toMatchObject({
      referenceFixtures: false,
      parityFixturesDir: '/fx',
    });
  });
});

describe('defaultReferenceFrames', () => {
  it('returns [0, mid, last] for typical-length docs', () => {
    const doc = { ...SYNTH_DOC, durationFrames: 30 } as RIRDocument;
    expect(defaultReferenceFrames(doc)).toEqual([0, 14, 29]);
  });

  it('returns [0, mid, last] for a 2-frame doc', () => {
    const doc = { ...SYNTH_DOC, durationFrames: 2 } as RIRDocument;
    expect(defaultReferenceFrames(doc)).toEqual([0, 0, 1]);
  });

  it('returns [0] for a 1-frame doc', () => {
    const doc = { ...SYNTH_DOC, durationFrames: 1 } as RIRDocument;
    expect(defaultReferenceFrames(doc)).toEqual([0]);
  });
});
