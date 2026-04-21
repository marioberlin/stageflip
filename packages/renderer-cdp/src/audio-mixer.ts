// packages/renderer-cdp/src/audio-mixer.ts
// Build an ffmpeg `-filter_complex` graph that mixes N audio tracks onto
// the already-rendered video, synchronised to the composition timeline,
// and mux the result. Driven by per-track metadata that mirrors the RIR
// audio-content schema: source path, comp-time window, trim, loop, gain,
// pan, fade-in/out.
//
// The argv builder is pure (testable); the orchestrator spawns via the
// T-085 ChildRunner seam. Real ffmpeg runs land in T-090; here we test
// the filter-graph shape against the inputs that drive its correctness.
//
// Per-track filter chain (applied in order):
//   atrim[=start=Ts:end=Te]          — respect trimStartMs / trimEndMs
//   asetpts=PTS-STARTPTS              — reset timestamps after trim
//   aloop=loop=-1:size=2e9            — when `loop` true
//   volume=<gain>                      — linear gain
//   pan=stereo|c0=...|c1=...           — stereo pan (-1..1)
//   adelay=<D>|<D>                     — comp-timing delay in ms
//   afade=t=in:st=<D/1000>:d=<fadeIn>  — when fadeInMs > 0
//   afade=t=out:st=<(D+dur-fadeOut)/1000>:d=<fadeOut>  — when fadeOutMs > 0
//
// Then amix across all tracks, and mux -map 0:v + [mix] with -c:v copy +
// -c:a aac. -shortest keeps the video timeline authoritative.

import { type ChildRunner, createNodeChildRunner } from './child-runner';

export interface AudioTrack {
  /** Local source path (post T-084a asset preflight). */
  readonly sourcePath: string;
  /** Absolute composition frame at which this track starts playing. */
  readonly startFrame: number;
  /** Absolute composition frame at which this track stops. */
  readonly endFrame: number;
  /** Trim source in-point in milliseconds. Default 0. */
  readonly trimStartMs?: number;
  /** Trim source out-point in milliseconds. Omit to play to source end. */
  readonly trimEndMs?: number;
  /** Loop the (trimmed) source if comp window > source length. Default false. */
  readonly loop?: boolean;
  /** Linear gain applied via `volume`. Default 1. */
  readonly gain?: number;
  /** Stereo pan: -1 = hard left, 0 = center, +1 = hard right. Default 0. */
  readonly pan?: number;
  /** Fade-in duration in milliseconds. Default 0. */
  readonly fadeInMs?: number;
  /** Fade-out duration in milliseconds. Default 0. */
  readonly fadeOutMs?: number;
}

export interface MixAudioOptions {
  readonly tracks: readonly AudioTrack[];
  /** Composition fps (for frame → seconds conversion). Positive integer. */
  readonly fps: number;
  /** Input video path (typically T-085 encoder output; no audio yet). */
  readonly videoPath: string;
  /** Output path for the muxed video + audio. Container inferred from extension. */
  readonly outputPath: string;
  /** ffmpeg binary path. Default `'ffmpeg'`. */
  readonly ffmpegPath?: string;
  /** Process seam; defaults to the Node child_process-backed runner. */
  readonly runner?: ChildRunner;
}

export interface MixAudioResult {
  readonly outputPath: string;
  readonly ffmpegArgs: readonly string[];
  /**
   * The `-filter_complex` graph string, or `null` when no tracks were
   * supplied (in which case the run is a pure video stream-copy).
   */
  readonly filterGraph: string | null;
}

export class MixAudioError extends Error {
  public readonly code: number | null;
  public readonly stderr: string;

  constructor(code: number | null, stderr: string) {
    super(
      `audio mixer: ffmpeg exited with code ${code === null ? '(signal)' : String(code)}\n${stderr.slice(-4096)}`,
    );
    this.name = 'MixAudioError';
    this.code = code;
    this.stderr = stderr;
  }
}

/** Build the ffmpeg argv + filter graph for the given options. Pure. */
export function buildMixAudioArgs(opts: MixAudioOptions): {
  readonly args: readonly string[];
  readonly filterGraph: string | null;
} {
  validateFps(opts.fps);
  if (typeof opts.videoPath !== 'string' || opts.videoPath.length === 0) {
    throw new Error('mixAudio: videoPath must be a non-empty string');
  }
  if (typeof opts.outputPath !== 'string' || opts.outputPath.length === 0) {
    throw new Error('mixAudio: outputPath must be a non-empty string');
  }

  if (opts.tracks.length === 0) {
    // No audio — just stream-copy the video through to the output path.
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      opts.videoPath,
      '-c',
      'copy',
      opts.outputPath,
    ];
    return { args, filterGraph: null };
  }

  for (const [i, t] of opts.tracks.entries()) {
    validateTrack(t, i);
  }

  const filterGraph = buildFilterGraph(opts.tracks, opts.fps);

  const args: string[] = ['-hide_banner', '-loglevel', 'error', '-y', '-i', opts.videoPath];
  for (const track of opts.tracks) {
    args.push('-i', track.sourcePath);
  }
  args.push(
    '-filter_complex',
    filterGraph,
    '-map',
    '0:v',
    '-map',
    '[mix]',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-shortest',
    opts.outputPath,
  );
  return { args, filterGraph };
}

/** Spawn ffmpeg, mix, resolve on success. Raises MixAudioError on non-zero. */
export async function mixAudio(opts: MixAudioOptions): Promise<MixAudioResult> {
  const { args, filterGraph } = buildMixAudioArgs(opts);
  const runner = opts.runner ?? createNodeChildRunner();
  const binary = opts.ffmpegPath ?? 'ffmpeg';

  const proc = runner.spawn(binary, args);
  await proc.stdin.end();
  const { code, stderr } = await proc.wait();
  if (code !== 0) throw new MixAudioError(code, stderr);
  return { outputPath: opts.outputPath, ffmpegArgs: args, filterGraph };
}

// ---- filter graph ---------------------------------------------------------

function buildFilterGraph(tracks: readonly AudioTrack[], fps: number): string {
  const chains: string[] = [];
  const labels: string[] = [];

  for (const [i, t] of tracks.entries()) {
    const inputLabel = `[${i + 1}:a]`;
    const outputLabel = `[a${i}]`;
    labels.push(outputLabel);

    const delayMs = Math.max(0, Math.round((t.startFrame / fps) * 1000));
    const windowDurSec = Math.max(0, (t.endFrame - t.startFrame) / fps);
    const trimStartSec = (t.trimStartMs ?? 0) / 1000;
    const trimEndSec = t.trimEndMs === undefined ? undefined : t.trimEndMs / 1000;
    const gain = t.gain ?? 1;
    const pan = t.pan ?? 0;
    const fadeInSec = (t.fadeInMs ?? 0) / 1000;
    const fadeOutSec = (t.fadeOutMs ?? 0) / 1000;
    const loop = t.loop ?? false;

    const steps: string[] = [];

    // 1. trim the source
    const atrimParts: string[] = [`start=${trimStartSec}`];
    if (trimEndSec !== undefined) atrimParts.push(`end=${trimEndSec}`);
    steps.push(`atrim=${atrimParts.join(':')}`);
    steps.push('asetpts=PTS-STARTPTS');

    // 2. loop if requested (bounded size so aloop returns)
    if (loop) steps.push('aloop=loop=-1:size=2147483647');

    // 3. volume + pan
    if (gain !== 1) steps.push(`volume=${gain}`);
    steps.push(formatPanFilter(pan));

    // 4. comp-timing delay (adelay takes per-channel ms)
    if (delayMs > 0) steps.push(`adelay=${delayMs}|${delayMs}`);

    // 5. fades at absolute (delayed) offsets
    const delaySec = delayMs / 1000;
    if (fadeInSec > 0) {
      steps.push(`afade=t=in:st=${delaySec}:d=${fadeInSec}`);
    }
    if (fadeOutSec > 0) {
      const fadeOutStart = Math.max(0, delaySec + windowDurSec - fadeOutSec);
      steps.push(`afade=t=out:st=${fadeOutStart}:d=${fadeOutSec}`);
    }

    chains.push(`${inputLabel}${steps.join(',')}${outputLabel}`);
  }

  // amix: `normalize=0` preserves per-track gains; `dropout_transition=0`
  // avoids auto-fade when shorter tracks end.
  const mixed = `${labels.join('')}amix=inputs=${tracks.length}:dropout_transition=0:normalize=0[mix]`;
  chains.push(mixed);

  return chains.join(';');
}

function formatPanFilter(pan: number): string {
  // Stereo-to-stereo linear pan. pan=-1 routes all to left, pan=+1 to
  // right, pan=0 is passthrough. Full surround / channel-aware panning
  // is future work — RIR's pan field is documented as stereo-only today.
  if (pan === 0) return 'pan=stereo|c0=c0|c1=c1';
  const left = Math.max(0, 1 - Math.max(0, pan));
  const right = Math.max(0, 1 + Math.min(0, pan));
  return `pan=stereo|c0=${left}*c0|c1=${right}*c1`;
}

function validateFps(fps: number): void {
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new RangeError(`mixAudio: fps must be positive finite (got ${fps})`);
  }
}

function validateTrack(t: AudioTrack, i: number): void {
  const ctx = `mixAudio: track[${i}]`;
  if (typeof t.sourcePath !== 'string' || t.sourcePath.length === 0) {
    throw new Error(`${ctx}: sourcePath must be a non-empty string`);
  }
  if (!Number.isInteger(t.startFrame) || t.startFrame < 0) {
    throw new RangeError(`${ctx}: startFrame must be a non-negative integer`);
  }
  if (!Number.isInteger(t.endFrame) || t.endFrame <= t.startFrame) {
    throw new RangeError(`${ctx}: endFrame must be an integer > startFrame`);
  }
  if (t.trimStartMs !== undefined && (!Number.isFinite(t.trimStartMs) || t.trimStartMs < 0)) {
    throw new RangeError(`${ctx}: trimStartMs must be non-negative finite`);
  }
  if (t.trimEndMs !== undefined) {
    if (!Number.isFinite(t.trimEndMs) || t.trimEndMs <= (t.trimStartMs ?? 0)) {
      throw new RangeError(`${ctx}: trimEndMs must be finite and > trimStartMs`);
    }
  }
  if (t.gain !== undefined && (!Number.isFinite(t.gain) || t.gain < 0)) {
    throw new RangeError(`${ctx}: gain must be non-negative finite`);
  }
  if (t.pan !== undefined && (!Number.isFinite(t.pan) || t.pan < -1 || t.pan > 1)) {
    throw new RangeError(`${ctx}: pan must be in [-1, 1]`);
  }
  if (t.fadeInMs !== undefined && (!Number.isFinite(t.fadeInMs) || t.fadeInMs < 0)) {
    throw new RangeError(`${ctx}: fadeInMs must be non-negative finite`);
  }
  if (t.fadeOutMs !== undefined && (!Number.isFinite(t.fadeOutMs) || t.fadeOutMs < 0)) {
    throw new RangeError(`${ctx}: fadeOutMs must be non-negative finite`);
  }
}
