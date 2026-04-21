// packages/renderer-cdp/src/ffmpeg-encoder.test.ts

import { describe, expect, it } from 'vitest';

import type { ChildRunner, SpawnedProcess } from './child-runner';
import {
  FFmpegEncoder,
  FFmpegEncoderError,
  type FFmpegEncoderOptions,
  buildFfmpegArgs,
} from './ffmpeg-encoder';

// --- fakes ------------------------------------------------------------------

interface FakeSpawn {
  command: string;
  args: readonly string[];
  writes: Uint8Array[];
  stdinEndCalls: number;
  waitCalls: number;
  killed: boolean;
  /** Resolve the process with this code (and stderr). Default: 0. */
  resolveWith: { code: number | null; stderr: string };
}

class FakeChildRunner implements ChildRunner {
  public readonly spawns: FakeSpawn[] = [];
  public nextResolve: { code: number | null; stderr: string } = { code: 0, stderr: '' };

  spawn(command: string, args: readonly string[]): SpawnedProcess {
    const record: FakeSpawn = {
      command,
      args: [...args],
      writes: [],
      stdinEndCalls: 0,
      waitCalls: 0,
      killed: false,
      resolveWith: this.nextResolve,
    };
    this.spawns.push(record);

    return {
      stdin: {
        async write(chunk: Uint8Array): Promise<void> {
          record.writes.push(chunk);
        },
        async end(): Promise<void> {
          record.stdinEndCalls++;
        },
      },
      async wait(): Promise<{ code: number | null; stderr: string }> {
        record.waitCalls++;
        return record.resolveWith;
      },
      kill(): void {
        record.killed = true;
      },
    };
  }
}

function baseOpts(): FFmpegEncoderOptions {
  return {
    outputPath: '/tmp/out.mp4',
    width: 320,
    height: 240,
    fps: 30,
    profile: 'h264',
  };
}

// --- buildFfmpegArgs --------------------------------------------------------

describe('buildFfmpegArgs', () => {
  it('emits image2pipe input + codec flags + CRF + output path for h264', () => {
    const args = buildFfmpegArgs(baseOpts());
    expect(args[0]).toBe('-y');
    expect(args).toContain('-f');
    expect(args).toContain('image2pipe');
    expect(args).toContain('libx264');
    expect(args).toContain('-crf');
    expect(args[args.length - 1]).toBe('/tmp/out.mp4');
    expect(args).toContain('-i');
  });

  it('uses the profile CRF default when no crf is supplied', () => {
    const args = buildFfmpegArgs(baseOpts());
    const crfIdx = args.indexOf('-crf');
    expect(args[crfIdx + 1]).toBe('23'); // libx264 default
  });

  it('honours a supplied crf when in-range', () => {
    const args = buildFfmpegArgs({ ...baseOpts(), crf: 18 });
    const crfIdx = args.indexOf('-crf');
    expect(args[crfIdx + 1]).toBe('18');
  });

  it('rejects an out-of-range crf', () => {
    expect(() => buildFfmpegArgs({ ...baseOpts(), crf: 100 })).toThrow(/crf 100 out of range/);
    expect(() => buildFfmpegArgs({ ...baseOpts(), crf: -1 })).toThrow(/crf -1 out of range/);
  });

  it('rejects a crf on prores-4444 (no CRF knob)', () => {
    expect(() =>
      buildFfmpegArgs({ ...baseOpts(), profile: 'prores-4444', outputPath: '/tmp/a.mov', crf: 20 }),
    ).toThrow(/does not accept a crf knob/);
  });

  it('omits crf args entirely for prores-4444', () => {
    const args = buildFfmpegArgs({
      ...baseOpts(),
      profile: 'prores-4444',
      outputPath: '/tmp/a.mov',
    });
    expect(args).not.toContain('-crf');
    expect(args).toContain('prores_ks');
    expect(args).toContain('yuva444p10le');
  });

  it('rejects odd/non-integer/negative dimensions', () => {
    // H.264/H.265 yuv420p requires even dimensions; enforce universally for
    // consistency across profiles.
    expect(() => buildFfmpegArgs({ ...baseOpts(), width: 321 })).toThrow(/width/);
    expect(() => buildFfmpegArgs({ ...baseOpts(), height: -2 })).toThrow(/height/);
    expect(() => buildFfmpegArgs({ ...baseOpts(), width: 100.5 })).toThrow(/width/);
  });

  it('rejects a non-positive fps', () => {
    expect(() => buildFfmpegArgs({ ...baseOpts(), fps: 0 })).toThrow(/fps/);
    expect(() => buildFfmpegArgs({ ...baseOpts(), fps: -30 })).toThrow(/fps/);
    expect(() => buildFfmpegArgs({ ...baseOpts(), fps: Number.NaN })).toThrow(/fps/);
  });

  it('emits the fps on both the input and output sides of -i -', () => {
    const args = buildFfmpegArgs({ ...baseOpts(), fps: 60 });
    // Count how many -r flags appear — should be 2, both with value 60.
    const rIndices: number[] = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-r') rIndices.push(i);
    }
    expect(rIndices).toHaveLength(2);
    const [first, second] = rIndices;
    expect(args[(first ?? -1) + 1]).toBe('60');
    expect(args[(second ?? -1) + 1]).toBe('60');
  });
});

// --- FFmpegEncoder ----------------------------------------------------------

describe('FFmpegEncoder', () => {
  it('spawns ffmpeg with the built argv at create time', () => {
    const runner = new FakeChildRunner();
    const encoder = FFmpegEncoder.create({ ...baseOpts(), runner });
    expect(runner.spawns).toHaveLength(1);
    expect(runner.spawns[0]?.command).toBe('ffmpeg');
    expect(runner.spawns[0]?.args).toEqual(encoder.ffmpegArgs);
  });

  it('honours a custom ffmpegPath', () => {
    const runner = new FakeChildRunner();
    FFmpegEncoder.create({ ...baseOpts(), runner, ffmpegPath: '/opt/homebrew/bin/ffmpeg' });
    expect(runner.spawns[0]?.command).toBe('/opt/homebrew/bin/ffmpeg');
  });

  it('writes every onFrame chunk to stdin in order', async () => {
    const runner = new FakeChildRunner();
    const encoder = FFmpegEncoder.create({ ...baseOpts(), runner });

    await encoder.onFrame(0, new Uint8Array([0xaa]));
    await encoder.onFrame(1, new Uint8Array([0xbb]));
    await encoder.onFrame(2, new Uint8Array([0xcc]));

    const writes = runner.spawns[0]?.writes ?? [];
    expect(writes).toHaveLength(3);
    expect(writes.map((w) => w[0])).toEqual([0xaa, 0xbb, 0xcc]);
  });

  it('close ends stdin and resolves on zero-exit', async () => {
    const runner = new FakeChildRunner();
    runner.nextResolve = { code: 0, stderr: '' };
    const encoder = FFmpegEncoder.create({ ...baseOpts(), runner });

    await encoder.onFrame(0, new Uint8Array([0x01]));
    await encoder.close();

    expect(runner.spawns[0]?.stdinEndCalls).toBe(1);
  });

  it('close raises FFmpegEncoderError on non-zero exit, with stderr carried through', async () => {
    const runner = new FakeChildRunner();
    runner.nextResolve = { code: 1, stderr: 'ffmpeg: bad codec\n' };
    const encoder = FFmpegEncoder.create({ ...baseOpts(), runner });

    await encoder.onFrame(0, new Uint8Array([0x01]));
    await expect(encoder.close()).rejects.toBeInstanceOf(FFmpegEncoderError);
    try {
      await encoder.close();
    } catch (err) {
      expect(err).toBeInstanceOf(FFmpegEncoderError);
      const ffErr = err as FFmpegEncoderError;
      expect(ffErr.code).toBe(1);
      expect(ffErr.stderr).toContain('bad codec');
    }
  });

  it('close is idempotent (repeated calls share the original exit result)', async () => {
    const runner = new FakeChildRunner();
    const encoder = FFmpegEncoder.create({ ...baseOpts(), runner });
    const first = encoder.close();
    const second = encoder.close();
    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
    // stdin.end() was only called once.
    expect(runner.spawns[0]?.stdinEndCalls).toBe(1);
  });

  it('close is safe against concurrent async callers', async () => {
    // Two separate tasks both await close() "at the same time". Because
    // close is async, each one reaches its first await before setting the
    // closed flag — a naive guard would let both start finalize, ending
    // stdin twice and awaiting wait() twice. The implementation stores
    // closeResult before the first await so the second entry shares the
    // same in-flight promise.
    const runner = new FakeChildRunner();
    const encoder = FFmpegEncoder.create({ ...baseOpts(), runner });
    await Promise.all([encoder.close(), encoder.close(), encoder.close()]);
    // Only one process was spawned; only one finalize ran.
    expect(runner.spawns).toHaveLength(1);
    expect(runner.spawns[0]?.stdinEndCalls).toBe(1);
    expect(runner.spawns[0]?.waitCalls).toBe(1);
  });

  it('onFrame after close rejects', async () => {
    const runner = new FakeChildRunner();
    const encoder = FFmpegEncoder.create({ ...baseOpts(), runner });
    await encoder.close();
    await expect(encoder.onFrame(0, new Uint8Array([0x01]))).rejects.toThrow(/after close/);
  });

  it('exposes the chosen profile for introspection', () => {
    const runner = new FakeChildRunner();
    const encoder = FFmpegEncoder.create({
      ...baseOpts(),
      profile: 'prores-4444',
      outputPath: '/tmp/a.mov',
      runner,
    });
    expect(encoder.profile.id).toBe('prores-4444');
    expect(encoder.profile.supportsAlpha).toBe(true);
  });
});
