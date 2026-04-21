// packages/renderer-cdp/src/ffmpeg-encoder.ts
// FrameSink backed by a spawned ffmpeg process. Accepts PNG buffers (one
// per frame) on stdin, encodes with the configured profile, writes to
// `outputPath`. Composes with the T-084 export dispatcher via the shared
// FrameSink contract.
//
// The child process is spawned eagerly in `create` so argv errors surface
// before any frame is captured. Frames flow to stdin as they arrive; close
// ends stdin and awaits process exit. A non-zero exit code is raised as
// an FFmpegEncoderError carrying the accumulated stderr — the caller has
// enough context to surface a useful error without scraping logs.
//
// System ffmpeg binary path is configurable (defaults to 'ffmpeg' on
// PATH). The `doctor` helper in ffmpeg-doctor.ts validates the install
// up-front.

import { type ChildRunner, type SpawnedProcess, createNodeChildRunner } from './child-runner';
import {
  ENCODER_PROFILES,
  type EncoderProfile,
  type EncoderProfileId,
  getEncoderProfile,
} from './ffmpeg-profiles';
import type { FrameSink } from './frame-sink';

export interface FFmpegEncoderOptions {
  readonly outputPath: string;
  /** Composition width in CSS pixels; must match captured frame width. */
  readonly width: number;
  /** Composition height in CSS pixels; must match captured frame height. */
  readonly height: number;
  /** Composition frame rate. Positive integer. */
  readonly fps: number;
  /** Encoder profile id or inline profile object. */
  readonly profile: EncoderProfileId | EncoderProfile;
  /**
   * Optional CRF (constant rate factor). Ignored by profiles whose
   * `crfRange` is null (ProRes). When omitted, the profile's
   * `crfRange.default` is used.
   */
  readonly crf?: number;
  /** Override the ffmpeg binary path (default: 'ffmpeg' on PATH). */
  readonly ffmpegPath?: string;
  /** Process seam; defaults to Node's child_process-backed runner. */
  readonly runner?: ChildRunner;
}

/** Raised by `close()` when ffmpeg exits non-zero or closes unexpectedly. */
export class FFmpegEncoderError extends Error {
  public readonly code: number | null;
  public readonly stderr: string;

  constructor(code: number | null, stderr: string) {
    super(
      `ffmpeg exited with code ${code === null ? '(signal)' : String(code)}\n${stderr.slice(-4096)}`,
    );
    this.name = 'FFmpegEncoderError';
    this.code = code;
    this.stderr = stderr;
  }
}

/**
 * Build the ffmpeg argv for the given options. Exposed for tests and for
 * doctoring — callers can check that expected codec flags are in place
 * before they pay for the spawn.
 */
export function buildFfmpegArgs(opts: FFmpegEncoderOptions): readonly string[] {
  const profile = resolveProfile(opts.profile);
  validateDimensions(opts.width, opts.height);
  validateFps(opts.fps);
  const crfArgs = buildCrfArgs(profile, opts.crf);

  return [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'image2pipe',
    '-c:v',
    'png',
    '-r',
    String(opts.fps),
    '-i',
    '-',
    ...profile.codecArgs,
    ...crfArgs,
    '-r',
    String(opts.fps),
    opts.outputPath,
  ];
}

export class FFmpegEncoder implements FrameSink {
  public readonly outputPath: string;
  public readonly ffmpegArgs: readonly string[];
  public readonly profile: EncoderProfile;

  private readonly process: SpawnedProcess;
  private closed = false;
  private closeResult: Promise<void> | null = null;

  /**
   * Spawn ffmpeg and return a ready-to-write encoder. Throws immediately
   * on argv validation failure; ffmpeg process errors surface via
   * `onFrame` / `close` rejections.
   */
  static create(opts: FFmpegEncoderOptions): FFmpegEncoder {
    const args = buildFfmpegArgs(opts);
    const runner = opts.runner ?? createNodeChildRunner();
    const binary = opts.ffmpegPath ?? 'ffmpeg';
    const proc = runner.spawn(binary, args);
    const profile = resolveProfile(opts.profile);
    return new FFmpegEncoder(opts.outputPath, args, profile, proc);
  }

  private constructor(
    outputPath: string,
    args: readonly string[],
    profile: EncoderProfile,
    process: SpawnedProcess,
  ) {
    this.outputPath = outputPath;
    this.ffmpegArgs = args;
    this.profile = profile;
    this.process = process;
  }

  async onFrame(_frame: number, buffer: Uint8Array): Promise<void> {
    if (this.closed) {
      throw new Error('FFmpegEncoder: onFrame called after close');
    }
    await this.process.stdin.write(buffer);
  }

  async close(): Promise<void> {
    if (this.closed) {
      // close is documented as idempotent (FrameSink contract); share the
      // original exit promise so a re-entrant caller sees the same result.
      return this.closeResult ?? Promise.resolve();
    }
    this.closed = true;
    this.closeResult = this.finalize();
    return this.closeResult;
  }

  private async finalize(): Promise<void> {
    await this.process.stdin.end();
    const { code, stderr } = await this.process.wait();
    if (code !== 0) {
      throw new FFmpegEncoderError(code, stderr);
    }
  }
}

// ---- internals -------------------------------------------------------------

function resolveProfile(p: EncoderProfileId | EncoderProfile): EncoderProfile {
  if (typeof p === 'string') return getEncoderProfile(p);
  // Caller passed a literal profile — validate it is one of ours.
  if (!(p.id in ENCODER_PROFILES)) {
    throw new Error(`FFmpegEncoder: unknown profile id '${p.id}'`);
  }
  return p;
}

function validateDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || width <= 0 || width % 2 !== 0) {
    throw new RangeError(`FFmpegEncoder: width must be a positive even integer (got ${width})`);
  }
  if (!Number.isInteger(height) || height <= 0 || height % 2 !== 0) {
    throw new RangeError(`FFmpegEncoder: height must be a positive even integer (got ${height})`);
  }
}

function validateFps(fps: number): void {
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new RangeError(`FFmpegEncoder: fps must be a positive finite number (got ${fps})`);
  }
}

function buildCrfArgs(profile: EncoderProfile, requested: number | undefined): readonly string[] {
  if (profile.crfRange === null) {
    if (requested !== undefined) {
      // Silently dropping would surprise; fail loud.
      throw new RangeError(`FFmpegEncoder: profile '${profile.id}' does not accept a crf knob`);
    }
    return [];
  }
  const effective = requested ?? profile.crfRange.default;
  if (
    !Number.isFinite(effective) ||
    effective < profile.crfRange.min ||
    effective > profile.crfRange.max
  ) {
    throw new RangeError(
      `FFmpegEncoder: crf ${effective} out of range [${profile.crfRange.min}, ${profile.crfRange.max}] for profile '${profile.id}'`,
    );
  }
  return ['-crf', String(effective)];
}
