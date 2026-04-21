// packages/renderer-cdp/src/video-frame-extractor.ts
// Pre-extract a video's frames to a directory at the composition's fps,
// one PNG per frame. The CDP live-capture path then swaps these stills in
// on a per-frame basis instead of relying on HTML <video> playback timing
// during capture — which is non-deterministic under BeginFrame.
//
// Adapted from the vendored engine's videoFrameExtractor (see
// vendor/engine/src/services/videoFrameExtractor.ts). The parts we
// preserve: the flag semantics that drive decoder behaviour — `-ss`
// before `-i` (fast keyframe seek), `-t` for duration, `-vf fps=N` at
// output rate, the 5-digit pattern `frame_%05d.<ext>`, and the upstream
// JPG quality curve `Math.ceil((100 - quality) / 3)`. Decoded pixels are
// identical to upstream for the same inputs on these shared paths.
//
// Deliberate deviations (decoded pixels unaffected):
//   - We add `-hide_banner -loglevel error` up-front to match this
//     package's own ffmpeg-encoder.ts house style.
//   - We emit `-y` once up-front, not at the end as upstream does.
//   - PNG path omits upstream's `-q:v 0` (PNG is lossless; that arg is
//     a no-op). We keep `-compression_level 6`.
//
// The wrapper layer is fresh and uses the T-085 ChildRunner seam so
// fake spawns drive every test.

import { type ChildRunner, createNodeChildRunner } from './child-runner';

export interface ExtractVideoFramesOptions {
  /** Local file path to the source video (post T-084a asset preflight). */
  readonly videoPath: string;
  /** Directory to write `frame_NNNNN.<ext>` files into. Must exist. */
  readonly outputDir: string;
  /** Composition frame rate. Positive finite. */
  readonly fps: number;
  /** Start time in seconds. Default 0. */
  readonly startTimeSec?: number;
  /**
   * Duration in seconds. Omit to extract from `startTimeSec` to end of
   * source. Positive finite when provided.
   */
  readonly durationSec?: number;
  /** Output image format. Default 'png'. JPG requires `quality`. */
  readonly format?: 'png' | 'jpg';
  /**
   * JPG quality 0..100 (higher = better). Ignored for PNG. Defaults to
   * 85 when omitted and format is JPG.
   */
  readonly quality?: number;
  /** ffmpeg binary path. Default `'ffmpeg'` on PATH. */
  readonly ffmpegPath?: string;
  /** Process seam; defaults to the Node child_process-backed runner. */
  readonly runner?: ChildRunner;
}

export interface ExtractVideoFramesResult {
  readonly outputDir: string;
  /** printf-style pattern ffmpeg was told to write, e.g. `frame_%05d.png`. */
  readonly framePattern: string;
  /** Full argv ffmpeg was invoked with, for logs / reproducibility. */
  readonly ffmpegArgs: readonly string[];
}

export class ExtractVideoFramesError extends Error {
  public readonly code: number | null;
  public readonly stderr: string;

  constructor(code: number | null, stderr: string) {
    super(
      `video frame extractor: ffmpeg exited with code ${code === null ? '(signal)' : String(code)}\n${stderr.slice(-4096)}`,
    );
    this.name = 'ExtractVideoFramesError';
    this.code = code;
    this.stderr = stderr;
  }
}

/**
 * Build the ffmpeg argv for frame extraction. Pure — no IO. Exposed so
 * tests and consumers can inspect the command without spawning.
 */
export function buildExtractFramesArgs(opts: ExtractVideoFramesOptions): {
  readonly args: readonly string[];
  readonly framePattern: string;
  readonly outputPath: string;
} {
  validateFps(opts.fps);
  validateStartAndDuration(opts.startTimeSec, opts.durationSec);
  validateVideoPath(opts.videoPath);

  const format = opts.format ?? 'png';
  // Normalise-then-validate: a caller that passes `quality: undefined`
  // with `format: 'jpg'` still gets the 0..100 bounds check on the
  // effective value.
  const effectiveQuality = format === 'jpg' ? (opts.quality ?? 85) : undefined;
  if (effectiveQuality !== undefined) validateQuality(effectiveQuality);

  const framePattern = `frame_%05d.${format}`;
  const outputPath = joinPath(opts.outputDir, framePattern);

  const args: string[] = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-ss',
    String(opts.startTimeSec ?? 0),
    '-i',
    opts.videoPath,
  ];
  if (opts.durationSec !== undefined) {
    args.push('-t', String(opts.durationSec));
  }
  args.push('-vf', `fps=${opts.fps}`);
  if (format === 'jpg') {
    // Upstream's quality → `-q:v` mapping: 100 = best (q:v 1), 0 = worst
    // (q:v 33). `Math.ceil((100 - quality) / 3)` preserves that curve.
    // effectiveQuality is always defined on the jpg branch.
    args.push('-q:v', String(Math.ceil((100 - (effectiveQuality ?? 85)) / 3)));
  } else {
    // PNG: lossless by definition; compression_level only affects file size.
    args.push('-compression_level', '6');
  }
  args.push(outputPath);

  return { args, framePattern, outputPath };
}

/**
 * Spawn ffmpeg, extract frames, resolve on success. Throws
 * ExtractVideoFramesError on non-zero exit with ffmpeg's stderr attached.
 */
export async function extractVideoFrames(
  opts: ExtractVideoFramesOptions,
): Promise<ExtractVideoFramesResult> {
  const { args, framePattern } = buildExtractFramesArgs(opts);
  const runner = opts.runner ?? createNodeChildRunner();
  const binary = opts.ffmpegPath ?? 'ffmpeg';

  const proc = runner.spawn(binary, args);
  // No stdin data — close it immediately so ffmpeg doesn't wait for EOF.
  await proc.stdin.end();
  const { code, stderr } = await proc.wait();
  if (code !== 0) {
    throw new ExtractVideoFramesError(code, stderr);
  }
  return {
    outputDir: opts.outputDir,
    framePattern,
    ffmpegArgs: args,
  };
}

// ---- internals -------------------------------------------------------------

function validateFps(fps: number): void {
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new RangeError(`extractVideoFrames: fps must be positive finite (got ${fps})`);
  }
}

function validateStartAndDuration(start: number | undefined, duration: number | undefined): void {
  if (start !== undefined && (!Number.isFinite(start) || start < 0)) {
    throw new RangeError(
      `extractVideoFrames: startTimeSec must be non-negative finite (got ${start})`,
    );
  }
  if (duration !== undefined && (!Number.isFinite(duration) || duration <= 0)) {
    throw new RangeError(
      `extractVideoFrames: durationSec must be positive finite (got ${duration})`,
    );
  }
}

function validateQuality(q: number): void {
  if (!Number.isFinite(q) || q < 0 || q > 100) {
    throw new RangeError(`extractVideoFrames: quality must be 0..100 (got ${q})`);
  }
}

function validateVideoPath(p: string): void {
  if (typeof p !== 'string' || p.length === 0) {
    throw new Error('extractVideoFrames: videoPath must be a non-empty string');
  }
}

/**
 * Path join that handles empty outputDir and doesn't require `node:path`
 * in the hot call — keeps the pure arg-builder dependency-free. The real
 * Node-backed extractor can pass a pre-joined outputDir/pattern; this
 * helper only exists for tests and simple callers.
 */
function joinPath(dir: string, file: string): string {
  if (dir.length === 0) return file;
  if (dir.endsWith('/')) return dir + file;
  return `${dir}/${file}`;
}
