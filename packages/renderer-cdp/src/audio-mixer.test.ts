// packages/renderer-cdp/src/audio-mixer.test.ts

import { describe, expect, it } from 'vitest';

import {
  type AudioTrack,
  MixAudioError,
  type MixAudioOptions,
  buildMixAudioArgs,
  mixAudio,
} from './audio-mixer';
import type { ChildRunner, SpawnedProcess } from './child-runner';

// --- fake runner ------------------------------------------------------------

class FakeRunner implements ChildRunner {
  public readonly spawns: Array<{
    cmd: string;
    args: readonly string[];
    exit: { code: number | null; stderr: string };
  }> = [];
  public nextExit: { code: number | null; stderr: string } = { code: 0, stderr: '' };

  spawn(command: string, args: readonly string[]): SpawnedProcess {
    const record = { cmd: command, args: [...args], exit: this.nextExit };
    this.spawns.push(record);
    return {
      stdin: {
        async write(): Promise<void> {},
        async end(): Promise<void> {},
      },
      async wait(): Promise<{ code: number | null; stderr: string }> {
        return record.exit;
      },
      kill(): void {},
    };
  }
}

function track(override: Partial<AudioTrack> = {}): AudioTrack {
  return {
    sourcePath: '/tmp/a.mp3',
    startFrame: 0,
    endFrame: 150,
    ...override,
  };
}

function baseOpts(tracks: readonly AudioTrack[]): MixAudioOptions {
  return {
    tracks,
    fps: 30,
    videoPath: '/tmp/in.mp4',
    outputPath: '/tmp/out.mp4',
  };
}

// --- buildMixAudioArgs: zero tracks ----------------------------------------

describe('buildMixAudioArgs (zero tracks)', () => {
  it('emits a stream-copy argv with no filter graph when no audio tracks are present', () => {
    const { args, filterGraph } = buildMixAudioArgs(baseOpts([]));
    expect(filterGraph).toBeNull();
    expect(args).toContain('-c');
    expect(args[args.indexOf('-c') + 1]).toBe('copy');
    expect(args).not.toContain('-filter_complex');
    expect(args[args.length - 1]).toBe('/tmp/out.mp4');
    expect(args[args.indexOf('-i') + 1]).toBe('/tmp/in.mp4');
  });
});

// --- buildMixAudioArgs: one track ------------------------------------------

describe('buildMixAudioArgs (single track)', () => {
  it('emits one -i per track and a filter graph with one chain + amix', () => {
    const { args, filterGraph } = buildMixAudioArgs(
      baseOpts([track({ sourcePath: '/tmp/a.mp3' })]),
    );
    expect(filterGraph).not.toBeNull();
    // Two -i flags: video + the single audio track.
    const iCount = args.filter((a) => a === '-i').length;
    expect(iCount).toBe(2);
    expect(args).toContain('/tmp/a.mp3');
    expect(args).toContain('-filter_complex');
    expect(args).toContain('-map');
    const mapIdx = args.indexOf('[mix]');
    expect(mapIdx).toBeGreaterThanOrEqual(0);
    // amix across 1 track is still valid — filter graph carries the right N.
    expect(filterGraph).toContain('amix=inputs=1');
    expect(filterGraph).toMatch(/\[1:a\]atrim=start=0/);
    expect(filterGraph).toContain('[a0]');
  });

  it('emits atrim with both start and end when trimEndMs is provided', () => {
    const { filterGraph } = buildMixAudioArgs(
      baseOpts([track({ trimStartMs: 500, trimEndMs: 3000 })]),
    );
    expect(filterGraph).toContain('atrim=start=0.5:end=3');
  });

  it('applies adelay when startFrame > 0 (ms per channel)', () => {
    const { filterGraph } = buildMixAudioArgs(
      baseOpts([track({ startFrame: 30, endFrame: 120 })]), // 30 fps → 1s
    );
    expect(filterGraph).toContain('adelay=1000|1000');
  });

  it('wires aloop in when loop is true', () => {
    const { filterGraph } = buildMixAudioArgs(baseOpts([track({ loop: true })]));
    expect(filterGraph).toContain('aloop=loop=-1');
  });

  it('omits volume filter when gain is 1 (default) but emits it otherwise', () => {
    const { filterGraph: unityFilter } = buildMixAudioArgs(baseOpts([track({ gain: 1 })]));
    const { filterGraph: halfFilter } = buildMixAudioArgs(baseOpts([track({ gain: 0.5 })]));
    expect(unityFilter).not.toContain('volume=');
    expect(halfFilter).toContain('volume=0.5');
  });

  it('emits pan=stereo passthrough at pan=0 and an asymmetric matrix otherwise', () => {
    const { filterGraph: centered } = buildMixAudioArgs(baseOpts([track({ pan: 0 })]));
    expect(centered).toContain('pan=stereo|c0=c0|c1=c1');

    const { filterGraph: left } = buildMixAudioArgs(baseOpts([track({ pan: -1 })]));
    // Hard left: right channel goes to zero.
    expect(left).toContain('c1=0*c1');

    const { filterGraph: right } = buildMixAudioArgs(baseOpts([track({ pan: 1 })]));
    expect(right).toContain('c0=0*c0');
  });

  it('emits afade=in at delay offset and afade=out before window end', () => {
    const { filterGraph } = buildMixAudioArgs(
      baseOpts([
        track({
          startFrame: 30, // 1s delay at 30fps
          endFrame: 120, // 3s window at 30fps
          fadeInMs: 500, // 0.5s fade in
          fadeOutMs: 500, // 0.5s fade out, ends at 1+3-0.5=3.5s
        }),
      ]),
    );
    expect(filterGraph).toContain('afade=t=in:st=1:d=0.5');
    expect(filterGraph).toContain('afade=t=out:st=3.5:d=0.5');
  });
});

// --- buildMixAudioArgs: multiple tracks ------------------------------------

describe('buildMixAudioArgs (multiple tracks)', () => {
  it('amixes N tracks with N input labels', () => {
    const { args, filterGraph } = buildMixAudioArgs(
      baseOpts([
        track({ sourcePath: '/tmp/a.mp3' }),
        track({ sourcePath: '/tmp/b.mp3' }),
        track({ sourcePath: '/tmp/c.mp3' }),
      ]),
    );
    expect(filterGraph).toContain('amix=inputs=3');
    expect(filterGraph).toContain('[a0][a1][a2]');
    expect(args.filter((a) => a === '-i')).toHaveLength(4); // video + 3 audio
  });

  it('emits separate chains for each track in order', () => {
    const { filterGraph } = buildMixAudioArgs(
      baseOpts([track({ sourcePath: '/tmp/a.mp3' }), track({ sourcePath: '/tmp/b.mp3' })]),
    );
    expect(filterGraph).toMatch(/\[1:a\]atrim[\s\S]*\[a0\];\[2:a\]atrim[\s\S]*\[a1\]/);
  });
});

// --- validation -------------------------------------------------------------

describe('buildMixAudioArgs validation', () => {
  it('rejects a non-positive fps', () => {
    expect(() => buildMixAudioArgs({ ...baseOpts([]), fps: 0 })).toThrow(/fps/);
    expect(() => buildMixAudioArgs({ ...baseOpts([]), fps: Number.NaN })).toThrow(/fps/);
  });

  it('rejects empty videoPath / outputPath', () => {
    expect(() => buildMixAudioArgs({ ...baseOpts([]), videoPath: '' })).toThrow(/videoPath/);
    expect(() => buildMixAudioArgs({ ...baseOpts([]), outputPath: '' })).toThrow(/outputPath/);
  });

  it('rejects malformed track fields with per-track context', () => {
    expect(() => buildMixAudioArgs(baseOpts([track({ sourcePath: '' })]))).toThrow(
      /track\[0\].*sourcePath/,
    );
    expect(() => buildMixAudioArgs(baseOpts([track({ startFrame: -1 })]))).toThrow(
      /track\[0\].*startFrame/,
    );
    expect(() => buildMixAudioArgs(baseOpts([track({ endFrame: 0 })]))).toThrow(
      /track\[0\].*endFrame/,
    );
    expect(() => buildMixAudioArgs(baseOpts([track({ pan: 1.5 })]))).toThrow(/track\[0\].*pan/);
    expect(() => buildMixAudioArgs(baseOpts([track({ gain: -0.1 })]))).toThrow(/track\[0\].*gain/);
    expect(() => buildMixAudioArgs(baseOpts([track({ fadeInMs: -1 })]))).toThrow(
      /track\[0\].*fadeInMs/,
    );
    expect(() => buildMixAudioArgs(baseOpts([track({ trimStartMs: 100, trimEndMs: 50 })]))).toThrow(
      /track\[0\].*trimEndMs/,
    );
  });
});

// --- mixAudio orchestrator --------------------------------------------------

describe('mixAudio', () => {
  it('spawns ffmpeg with the built argv and resolves on zero exit', async () => {
    const runner = new FakeRunner();
    const result = await mixAudio({ ...baseOpts([track()]), runner });
    expect(runner.spawns).toHaveLength(1);
    expect(runner.spawns[0]?.cmd).toBe('ffmpeg');
    expect(runner.spawns[0]?.args).toEqual(result.ffmpegArgs);
    expect(result.outputPath).toBe('/tmp/out.mp4');
    expect(result.filterGraph).toContain('amix=inputs=1');
  });

  it('stream-copies the video when no tracks are supplied', async () => {
    const runner = new FakeRunner();
    const result = await mixAudio({ ...baseOpts([]), runner });
    expect(result.filterGraph).toBeNull();
    expect(result.ffmpegArgs).toContain('copy');
  });

  it('raises MixAudioError on non-zero exit, carrying stderr', async () => {
    const runner = new FakeRunner();
    runner.nextExit = { code: 1, stderr: 'No such file: /tmp/a.mp3\n' };
    await expect(mixAudio({ ...baseOpts([track()]), runner })).rejects.toBeInstanceOf(
      MixAudioError,
    );
  });

  it('honours a custom ffmpegPath', async () => {
    const runner = new FakeRunner();
    await mixAudio({
      ...baseOpts([track()]),
      runner,
      ffmpegPath: '/opt/homebrew/bin/ffmpeg',
    });
    expect(runner.spawns[0]?.cmd).toBe('/opt/homebrew/bin/ffmpeg');
  });
});
