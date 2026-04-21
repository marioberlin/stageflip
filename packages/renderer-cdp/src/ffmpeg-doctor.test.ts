// packages/renderer-cdp/src/ffmpeg-doctor.test.ts

import { describe, expect, it } from 'vitest';

import type { ChildRunner, SpawnedProcess } from './child-runner';
import { doctor } from './ffmpeg-doctor';

class FakeRunner implements ChildRunner {
  public readonly spawns: Array<{ cmd: string; args: readonly string[] }> = [];

  constructor(
    private readonly result:
      | { readonly kind: 'ok'; readonly stderr: string; readonly code?: number | null }
      | { readonly kind: 'throw'; readonly error: Error },
  ) {}

  spawn(command: string, args: readonly string[]): SpawnedProcess {
    this.spawns.push({ cmd: command, args });
    if (this.result.kind === 'throw') {
      throw this.result.error;
    }
    const { stderr, code = 0 } = this.result;
    return {
      stdin: {
        async write(): Promise<void> {},
        async end(): Promise<void> {},
      },
      async wait(): Promise<{ code: number | null; stderr: string }> {
        return { code, stderr };
      },
      kill(): void {},
    };
  }
}

const FULL_VERSION_OUTPUT = `ffmpeg version 6.1.1 Copyright (c) 2000-2023 the FFmpeg developers
built with Apple clang version 14.0.3 (clang-1403.0.22.14.1)
configuration: --prefix=/opt/homebrew --enable-gpl --enable-libx264 --enable-libx265 --enable-libvpx --enable-libopus
libavutil      58. 29.100 / 58. 29.100
`;

describe('doctor', () => {
  it('returns ok + parsed version + full codec map for a fully-featured build', async () => {
    const runner = new FakeRunner({ kind: 'ok', stderr: FULL_VERSION_OUTPUT });
    const report = await doctor({ runner });

    expect(report.ok).toBe(true);
    expect(report.ffmpegPath).toBe('ffmpeg');
    expect(report.version).toBe('6.1.1');
    expect(report.codecs).toEqual({
      libx264: true,
      libx265: true,
      libvpx: true,
      prores: true,
    });
    expect(report.issues).toHaveLength(0);
  });

  it('honours a custom ffmpegPath', async () => {
    const runner = new FakeRunner({ kind: 'ok', stderr: FULL_VERSION_OUTPUT });
    const report = await doctor({ runner, ffmpegPath: '/opt/homebrew/bin/ffmpeg' });
    expect(report.ffmpegPath).toBe('/opt/homebrew/bin/ffmpeg');
    expect(runner.spawns[0]?.cmd).toBe('/opt/homebrew/bin/ffmpeg');
    expect(runner.spawns[0]?.args).toEqual(['-version']);
  });

  it('surfaces a specific issue per missing codec library', async () => {
    const stripped = FULL_VERSION_OUTPUT.replace('--enable-libx264 ', '').replace(
      '--enable-libvpx ',
      '',
    );
    const runner = new FakeRunner({ kind: 'ok', stderr: stripped });
    const report = await doctor({ runner });

    expect(report.ok).toBe(false);
    expect(report.codecs.libx264).toBe(false);
    expect(report.codecs.libvpx).toBe(false);
    expect(report.codecs.libx265).toBe(true);
    expect(report.issues.some((i) => i.includes('libx264'))).toBe(true);
    expect(report.issues.some((i) => i.includes('libvpx'))).toBe(true);
    expect(report.issues.some((i) => i.includes('libx265'))).toBe(false);
  });

  it('reports not-ok and names the binary when spawn throws', async () => {
    const runner = new FakeRunner({ kind: 'throw', error: new Error('ENOENT') });
    const report = await doctor({ runner, ffmpegPath: '/no/such/ffmpeg' });

    expect(report.ok).toBe(false);
    expect(report.version).toBeNull();
    expect(report.codecs).toEqual({
      libx264: false,
      libx265: false,
      libvpx: false,
      prores: false,
    });
    expect(report.issues[0]).toMatch(/could not spawn '\/no\/such\/ffmpeg'/);
    expect(report.issues[0]).toMatch(/ENOENT/);
  });

  it('flags empty output (ffmpeg ran but produced nothing)', async () => {
    const runner = new FakeRunner({ kind: 'ok', stderr: '' });
    const report = await doctor({ runner });
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.includes('produced no output'))).toBe(true);
  });

  it('flags an unparseable version line', async () => {
    const runner = new FakeRunner({
      kind: 'ok',
      stderr: 'this is not ffmpeg at all\n--enable-libx264 --enable-libx265 --enable-libvpx\n',
    });
    const report = await doctor({ runner });
    expect(report.version).toBeNull();
    expect(report.issues.some((i) => i.includes('could not parse version'))).toBe(true);
  });

  it('returns ok=false if any issue is present even when version parses', async () => {
    const runner = new FakeRunner({
      kind: 'ok',
      stderr: 'ffmpeg version 6.1.1 Copyright …\nconfiguration: --enable-libx265 --enable-libvpx\n',
    });
    const report = await doctor({ runner });
    expect(report.version).toBe('6.1.1');
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.includes('libx264'))).toBe(true);
  });
});
