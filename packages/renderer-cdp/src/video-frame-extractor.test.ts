// packages/renderer-cdp/src/video-frame-extractor.test.ts

import { describe, expect, it } from 'vitest';

import type { ChildRunner, SpawnedProcess } from './child-runner';
import {
  ExtractVideoFramesError,
  type ExtractVideoFramesOptions,
  buildExtractFramesArgs,
  extractVideoFrames,
} from './video-frame-extractor';

// --- fake runner ------------------------------------------------------------

interface FakeSpawn {
  command: string;
  args: readonly string[];
  exit: { code: number | null; stderr: string };
  stdinEndCalls: number;
}

class FakeRunner implements ChildRunner {
  public readonly spawns: FakeSpawn[] = [];
  public nextExit: { code: number | null; stderr: string } = { code: 0, stderr: '' };

  spawn(command: string, args: readonly string[]): SpawnedProcess {
    const record: FakeSpawn = {
      command,
      args: [...args],
      exit: this.nextExit,
      stdinEndCalls: 0,
    };
    this.spawns.push(record);
    return {
      stdin: {
        async write(): Promise<void> {},
        async end(): Promise<void> {
          record.stdinEndCalls++;
        },
      },
      async wait(): Promise<{ code: number | null; stderr: string }> {
        return record.exit;
      },
      kill(): void {},
    };
  }
}

function baseOpts(): ExtractVideoFramesOptions {
  return {
    videoPath: '/tmp/in.mp4',
    outputDir: '/tmp/frames',
    fps: 30,
  };
}

// --- buildExtractFramesArgs -------------------------------------------------

describe('buildExtractFramesArgs', () => {
  it('emits -ss/-i/-vf/output pattern with sane defaults', () => {
    const { args, framePattern, outputPath } = buildExtractFramesArgs(baseOpts());
    expect(framePattern).toBe('frame_%05d.png');
    expect(outputPath).toBe('/tmp/frames/frame_%05d.png');
    expect(args).toContain('-i');
    expect(args[args.indexOf('-i') + 1]).toBe('/tmp/in.mp4');
    expect(args).toContain('-vf');
    expect(args[args.indexOf('-vf') + 1]).toBe('fps=30');
    // Default startTimeSec = 0.
    expect(args[args.indexOf('-ss') + 1]).toBe('0');
    // No -t when no duration supplied.
    expect(args).not.toContain('-t');
    // Output pattern is the last arg.
    expect(args[args.length - 1]).toBe('/tmp/frames/frame_%05d.png');
  });

  it('includes -t when durationSec is provided', () => {
    const { args } = buildExtractFramesArgs({ ...baseOpts(), durationSec: 12.5 });
    const idx = args.indexOf('-t');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(args[idx + 1]).toBe('12.5');
  });

  it('respects a non-zero startTimeSec', () => {
    const { args } = buildExtractFramesArgs({ ...baseOpts(), startTimeSec: 3.2 });
    expect(args[args.indexOf('-ss') + 1]).toBe('3.2');
  });

  it('switches to JPG output with -q:v mapped from quality', () => {
    const { args, framePattern } = buildExtractFramesArgs({
      ...baseOpts(),
      format: 'jpg',
      quality: 85,
    });
    expect(framePattern).toBe('frame_%05d.jpg');
    // Upstream mapping: ceil((100-quality)/3). For 85 → ceil(15/3) = 5.
    const qIdx = args.indexOf('-q:v');
    expect(qIdx).toBeGreaterThanOrEqual(0);
    expect(args[qIdx + 1]).toBe('5');
    // PNG-only flag must not leak into JPG path.
    expect(args).not.toContain('-compression_level');
  });

  it('PNG path carries -compression_level 6', () => {
    const { args } = buildExtractFramesArgs(baseOpts());
    const idx = args.indexOf('-compression_level');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(args[idx + 1]).toBe('6');
  });

  it('rejects non-positive fps and malformed inputs', () => {
    expect(() => buildExtractFramesArgs({ ...baseOpts(), fps: 0 })).toThrow(/fps/);
    expect(() => buildExtractFramesArgs({ ...baseOpts(), fps: Number.NaN })).toThrow(/fps/);
    expect(() => buildExtractFramesArgs({ ...baseOpts(), startTimeSec: -1 })).toThrow(
      /startTimeSec/,
    );
    expect(() => buildExtractFramesArgs({ ...baseOpts(), durationSec: 0 })).toThrow(/durationSec/);
    expect(() => buildExtractFramesArgs({ ...baseOpts(), videoPath: '' })).toThrow(/videoPath/);
    expect(() => buildExtractFramesArgs({ ...baseOpts(), format: 'jpg', quality: 150 })).toThrow(
      /quality/,
    );
  });

  it('handles outputDir with trailing slash and empty string', () => {
    const a = buildExtractFramesArgs({ ...baseOpts(), outputDir: '/tmp/frames/' });
    expect(a.outputPath).toBe('/tmp/frames/frame_%05d.png');
    const b = buildExtractFramesArgs({ ...baseOpts(), outputDir: '' });
    expect(b.outputPath).toBe('frame_%05d.png');
  });
});

// --- extractVideoFrames (orchestration) ------------------------------------

describe('extractVideoFrames', () => {
  it('spawns ffmpeg with the built argv and resolves on zero exit', async () => {
    const runner = new FakeRunner();
    const result = await extractVideoFrames({ ...baseOpts(), runner });

    expect(runner.spawns).toHaveLength(1);
    expect(runner.spawns[0]?.command).toBe('ffmpeg');
    expect(runner.spawns[0]?.args).toEqual(result.ffmpegArgs);
    expect(result.framePattern).toBe('frame_%05d.png');
    expect(result.outputDir).toBe('/tmp/frames');
    // stdin was closed immediately — ffmpeg had no data to wait on.
    expect(runner.spawns[0]?.stdinEndCalls).toBe(1);
  });

  it('honours a custom ffmpegPath', async () => {
    const runner = new FakeRunner();
    await extractVideoFrames({
      ...baseOpts(),
      runner,
      ffmpegPath: '/opt/homebrew/bin/ffmpeg',
    });
    expect(runner.spawns[0]?.command).toBe('/opt/homebrew/bin/ffmpeg');
  });

  it('raises ExtractVideoFramesError on non-zero exit, carrying stderr', async () => {
    const runner = new FakeRunner();
    runner.nextExit = { code: 1, stderr: 'Invalid data found when processing input\n' };
    await expect(extractVideoFrames({ ...baseOpts(), runner })).rejects.toBeInstanceOf(
      ExtractVideoFramesError,
    );
    try {
      await extractVideoFrames({ ...baseOpts(), runner });
    } catch (err) {
      expect(err).toBeInstanceOf(ExtractVideoFramesError);
      const e = err as ExtractVideoFramesError;
      expect(e.code).toBe(1);
      expect(e.stderr).toContain('Invalid data');
    }
  });

  it('propagates validation errors without spawning', async () => {
    const runner = new FakeRunner();
    await expect(extractVideoFrames({ ...baseOpts(), runner, fps: -1 })).rejects.toThrow(/fps/);
    expect(runner.spawns).toHaveLength(0);
  });
});
