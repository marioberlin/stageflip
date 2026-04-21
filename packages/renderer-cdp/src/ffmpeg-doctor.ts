// packages/renderer-cdp/src/ffmpeg-doctor.ts
// Validate the system ffmpeg install via the ChildRunner seam. Spawns
// `ffmpeg -version` once and parses the output for (a) the version line
// and (b) the configure flags indicating which codec libraries the
// binary was built against. StageFlip needs libx264 / libx265 / libvpx
// (vp9) via --enable-* flags; prores_ks is a built-in that counts as
// present whenever ffmpeg runs.
//
// All IO goes through the same ChildRunner the encoder uses — no direct
// use of Node's child_process here; tests inject a fake runner.

import { type ChildRunner, createNodeChildRunner } from './child-runner';

export interface DoctorCodecs {
  readonly libx264: boolean;
  readonly libx265: boolean;
  readonly libvpx: boolean;
  readonly prores: boolean;
}

export interface DoctorReport {
  /** True iff version parsed AND every StageFlip-required codec is present. */
  readonly ok: boolean;
  readonly ffmpegPath: string;
  readonly version: string | null;
  readonly codecs: DoctorCodecs;
  /** Human-readable issues. Empty when `ok` is true. */
  readonly issues: readonly string[];
  /**
   * Stderr captured during the probe — ffmpeg writes version + configure
   * info here on most builds. Kept for diagnostics; log when `issues` is
   * non-empty.
   */
  readonly raw: string;
}

export interface DoctorOptions {
  readonly ffmpegPath?: string;
  readonly runner?: ChildRunner;
}

export async function doctor(opts: DoctorOptions = {}): Promise<DoctorReport> {
  const runner = opts.runner ?? createNodeChildRunner();
  const ffmpegPath = opts.ffmpegPath ?? 'ffmpeg';

  let raw = '';
  try {
    const proc = runner.spawn(ffmpegPath, ['-version']);
    await proc.stdin.end();
    const { stderr } = await proc.wait();
    raw = stderr;
  } catch (err) {
    return fail(ffmpegPath, [
      `could not spawn '${ffmpegPath}': ${err instanceof Error ? err.message : String(err)}`,
    ]);
  }

  const issues: string[] = [];

  if (raw.length === 0) {
    issues.push('ffmpeg produced no output (run `ffmpeg -version` manually to verify)');
  }

  const version = parseVersion(raw);
  if (version === null && raw.length > 0) {
    issues.push(
      "could not parse version from ffmpeg output (expected a line starting with 'ffmpeg version')",
    );
  }

  const codecs = parseCodecs(raw);
  if (!codecs.libx264) {
    issues.push('ffmpeg was not built with --enable-libx264 (required for h264 profile)');
  }
  if (!codecs.libx265) {
    issues.push('ffmpeg was not built with --enable-libx265 (required for h265 profile)');
  }
  if (!codecs.libvpx) {
    issues.push('ffmpeg was not built with --enable-libvpx (required for vp9 profile)');
  }
  // prores_ks is bundled; raw.length > 0 already covered above.

  return {
    ok: issues.length === 0,
    ffmpegPath,
    version,
    codecs,
    issues,
    raw,
  };
}

function fail(ffmpegPath: string, issues: readonly string[]): DoctorReport {
  return {
    ok: false,
    ffmpegPath,
    version: null,
    codecs: { libx264: false, libx265: false, libvpx: false, prores: false },
    issues,
    raw: '',
  };
}

function parseVersion(raw: string): string | null {
  const match = /^ffmpeg version (\S+)/m.exec(raw);
  return match ? (match[1] ?? null) : null;
}

function parseCodecs(raw: string): DoctorCodecs {
  const has = (flag: string): boolean => raw.includes(`--enable-${flag}`);
  return {
    libx264: has('libx264'),
    libx265: has('libx265'),
    libvpx: has('libvpx'),
    prores: raw.length > 0,
  };
}
