// packages/renderer-cdp/src/ffprobe.test.ts

import { describe, expect, it } from 'vitest';

import type { ChildRunner, SpawnedProcess } from './child-runner';
import { FfprobeError, ffprobe, parseFfprobeJson } from './ffprobe';

// --- fake runner ------------------------------------------------------------

class FakeRunner implements ChildRunner {
  public readonly spawns: Array<{ cmd: string; args: readonly string[] }> = [];
  constructor(private readonly result: { code: number | null; stderr: string }) {}
  spawn(cmd: string, args: readonly string[]): SpawnedProcess {
    this.spawns.push({ cmd, args });
    return {
      stdin: { async write(): Promise<void> {}, async end(): Promise<void> {} },
      wait: async () => this.result,
      kill(): void {},
    };
  }
}

const SAMPLE_H264_MP4 = JSON.stringify({
  streams: [
    {
      index: 0,
      codec_name: 'h264',
      codec_type: 'video',
      width: 320,
      height: 240,
      r_frame_rate: '30/1',
      pix_fmt: 'yuv420p',
      duration: '2.000000',
      bit_rate: '123456',
    },
  ],
  format: {
    filename: '/tmp/out.mp4',
    format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
    duration: '2.000000',
    size: '5678',
    bit_rate: '200000',
  },
});

const SAMPLE_AUDIO_STREAM = JSON.stringify({
  streams: [
    {
      index: 0,
      codec_name: 'aac',
      codec_type: 'audio',
      sample_rate: '44100',
      channels: 2,
    },
  ],
  format: {
    filename: '/tmp/a.aac',
    format_name: 'aac',
    duration: '1.5',
  },
});

// --- parseFfprobeJson ------------------------------------------------------

describe('parseFfprobeJson', () => {
  it('parses a typical h264 MP4 probe into structured fields', () => {
    const r = parseFfprobeJson(SAMPLE_H264_MP4);
    expect(r.format.filename).toBe('/tmp/out.mp4');
    expect(r.format.formatName).toContain('mp4');
    expect(r.format.durationSec).toBeCloseTo(2, 5);
    expect(r.format.sizeBytes).toBe(5678);
    expect(r.streams).toHaveLength(1);
    const s = r.streams[0];
    if (s === undefined) throw new Error('expected one stream');
    expect(s.codecName).toBe('h264');
    expect(s.codecType).toBe('video');
    expect(s.width).toBe(320);
    expect(s.height).toBe(240);
    expect(s.rFrameRate).toBe('30/1');
    expect(s.pixFmt).toBe('yuv420p');
  });

  it('parses an audio-only stream report', () => {
    const r = parseFfprobeJson(SAMPLE_AUDIO_STREAM);
    expect(r.streams[0]?.codecType).toBe('audio');
    expect(r.streams[0]?.sampleRate).toBe(44100);
    expect(r.streams[0]?.channels).toBe(2);
  });

  it('throws with diagnostic on non-JSON output', () => {
    expect(() => parseFfprobeJson('not json <')).toThrow(/not valid JSON/);
  });

  it('throws when format.filename is missing', () => {
    const bad = JSON.stringify({ streams: [], format: { format_name: 'mp4' } });
    expect(() => parseFfprobeJson(bad)).toThrow(/filename or format_name/);
  });

  it('tolerates missing optional numeric fields', () => {
    const r = parseFfprobeJson(
      JSON.stringify({
        streams: [{ index: 0, codec_name: 'h264', codec_type: 'video' }],
        format: { filename: '/f', format_name: 'mp4' },
      }),
    );
    expect(r.streams[0]?.width).toBeUndefined();
    expect(r.streams[0]?.durationSec).toBeUndefined();
    expect(r.format.durationSec).toBeUndefined();
  });
});

// --- ffprobe (orchestrator) ------------------------------------------------

describe('ffprobe', () => {
  it('spawns ffprobe with the right argv and parses its output', async () => {
    const runner = new FakeRunner({ code: 0, stderr: SAMPLE_H264_MP4 });
    const report = await ffprobe({ filePath: '/tmp/out.mp4', runner });
    expect(runner.spawns[0]?.cmd).toBe('ffprobe');
    expect(runner.spawns[0]?.args).toContain('-show_format');
    expect(runner.spawns[0]?.args).toContain('-show_streams');
    const spawnArgs = runner.spawns[0]?.args ?? [];
    expect(spawnArgs[spawnArgs.length - 1]).toBe('/tmp/out.mp4');
    expect(report.format.filename).toBe('/tmp/out.mp4');
  });

  it('honours a custom ffprobePath', async () => {
    const runner = new FakeRunner({ code: 0, stderr: SAMPLE_H264_MP4 });
    await ffprobe({ filePath: '/tmp/out.mp4', ffprobePath: '/opt/bin/ffprobe', runner });
    expect(runner.spawns[0]?.cmd).toBe('/opt/bin/ffprobe');
  });

  it('raises FfprobeError on non-zero exit with stderr attached', async () => {
    const runner = new FakeRunner({ code: 1, stderr: 'bad file\n' });
    await expect(ffprobe({ filePath: '/tmp/x.mp4', runner })).rejects.toBeInstanceOf(FfprobeError);
  });

  it('rejects empty filePath up-front', async () => {
    await expect(ffprobe({ filePath: '' })).rejects.toThrow(/filePath/);
  });
});
