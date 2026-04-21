// packages/renderer-cdp/src/ffprobe.ts
// Thin wrapper around `ffprobe -v error -print_format json -show_format
// -show_streams <file>`. Returns a structured report the reference render
// tests (T-090) + future parity harness (T-100) consume to verify MP4
// output without decoding pixels.
//
// Spawns via the same T-085 ChildRunner seam the encoder / extractor /
// mixer use; tests inject a fake.

import { type ChildRunner, createNodeChildRunner } from './child-runner';

export interface FfprobeStream {
  readonly index: number;
  readonly codecName: string;
  readonly codecType: 'video' | 'audio' | 'subtitle' | 'data' | 'attachment' | string;
  readonly width?: number;
  readonly height?: number;
  /** Real frame rate, e.g. `'30/1'`. */
  readonly rFrameRate?: string;
  readonly pixFmt?: string;
  readonly durationSec?: number;
  readonly bitRate?: number;
  readonly sampleRate?: number;
  readonly channels?: number;
}

export interface FfprobeFormat {
  readonly filename: string;
  readonly formatName: string;
  readonly durationSec?: number;
  readonly sizeBytes?: number;
  readonly bitRate?: number;
}

export interface FfprobeReport {
  readonly format: FfprobeFormat;
  readonly streams: readonly FfprobeStream[];
  /** Raw JSON text ffprobe emitted, for diagnostic spillover. */
  readonly raw: string;
}

export class FfprobeError extends Error {
  public readonly code: number | null;
  public readonly stderr: string;

  constructor(code: number | null, stderr: string) {
    super(
      `ffprobe exited with code ${code === null ? '(signal)' : String(code)}\n${stderr.slice(-4096)}`,
    );
    this.name = 'FfprobeError';
    this.code = code;
    this.stderr = stderr;
  }
}

export interface FfprobeOptions {
  readonly filePath: string;
  readonly ffprobePath?: string;
  readonly runner?: ChildRunner;
}

export async function ffprobe(opts: FfprobeOptions): Promise<FfprobeReport> {
  if (typeof opts.filePath !== 'string' || opts.filePath.length === 0) {
    throw new Error('ffprobe: filePath must be a non-empty string');
  }
  const runner = opts.runner ?? createNodeChildRunner();
  const binary = opts.ffprobePath ?? 'ffprobe';
  const args = [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    opts.filePath,
  ];

  const proc = runner.spawn(binary, args);
  await proc.stdin.end();
  const { code, stderr } = await proc.wait();
  if (code !== 0) throw new FfprobeError(code, stderr);

  // `stderr` on `SpawnedProcess.wait()` is a combined stdout+stderr
  // buffer (see child-runner.ts — the field name is historical, kept
  // for contract compatibility with the encoder path). ffprobe writes
  // its `-print_format json` output to stdout; that arrives here.
  return parseFfprobeJson(stderr);
}

/** Exported for test use — parses the exact JSON shape ffprobe emits. */
export function parseFfprobeJson(raw: string): FfprobeReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`ffprobe: output was not valid JSON (first 256 bytes: ${raw.slice(0, 256)})`);
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('ffprobe: output JSON was not an object');
  }
  const obj = parsed as { format?: unknown; streams?: unknown };

  const format = parseFormat(obj.format);
  const streams = Array.isArray(obj.streams) ? obj.streams.map(parseStream) : [];

  return { format, streams, raw };
}

// ---- parsing helpers ------------------------------------------------------

function asNum(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function parseFormat(v: unknown): FfprobeFormat {
  if (typeof v !== 'object' || v === null) {
    throw new Error('ffprobe: missing `format` object in output');
  }
  const o = v as Record<string, unknown>;
  const filename = asStr(o.filename);
  const formatName = asStr(o.format_name);
  if (filename === undefined || formatName === undefined) {
    throw new Error('ffprobe: format missing filename or format_name');
  }
  const out: { -readonly [K in keyof FfprobeFormat]: FfprobeFormat[K] } = {
    filename,
    formatName,
  };
  const dur = asNum(o.duration);
  if (dur !== undefined) out.durationSec = dur;
  const size = asNum(o.size);
  if (size !== undefined) out.sizeBytes = size;
  const br = asNum(o.bit_rate);
  if (br !== undefined) out.bitRate = br;
  return out;
}

function parseStream(v: unknown): FfprobeStream {
  if (typeof v !== 'object' || v === null) {
    throw new Error('ffprobe: stream entry was not an object');
  }
  const o = v as Record<string, unknown>;
  const index = asNum(o.index);
  const codecName = asStr(o.codec_name);
  const codecType = asStr(o.codec_type);
  if (index === undefined || codecName === undefined || codecType === undefined) {
    throw new Error('ffprobe: stream missing index / codec_name / codec_type');
  }
  const out: { -readonly [K in keyof FfprobeStream]: FfprobeStream[K] } = {
    index,
    codecName,
    codecType,
  };
  const w = asNum(o.width);
  if (w !== undefined) out.width = w;
  const h = asNum(o.height);
  if (h !== undefined) out.height = h;
  const r = asStr(o.r_frame_rate);
  if (r !== undefined) out.rFrameRate = r;
  const p = asStr(o.pix_fmt);
  if (p !== undefined) out.pixFmt = p;
  const d = asNum(o.duration);
  if (d !== undefined) out.durationSec = d;
  const br = asNum(o.bit_rate);
  if (br !== undefined) out.bitRate = br;
  const sr = asNum(o.sample_rate);
  if (sr !== undefined) out.sampleRate = sr;
  const ch = asNum(o.channels);
  if (ch !== undefined) out.channels = ch;
  return out;
}
