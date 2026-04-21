// packages/renderer-cdp/src/reference-render.ts
// T-090 reference render helper: ties the full Phase 4 pipeline into a
// single call — open browser via `PuppeteerCdpSession`, run
// `exportDocument` with an `FFmpegEncoder` sink, then verify the
// resulting MP4 with `ffprobe`. Returns both the `ExportResult` and
// the `FfprobeReport` so tests can assert on shape + on container/stream
// metadata without decoding pixels.
//
// This helper is what Phase 4's exit criterion uses:
//   "stageflip render produces valid MP4 from a fixture document".
//
// Real browser + real ffmpeg + real ffprobe are all required. For
// CI-unfriendly or offline hosts, see `canRunReferenceRenders()` for
// the detection used by the integration test guard.

import { access } from 'node:fs/promises';
import { platform } from 'node:os';

import type { RIRDocument } from '@stageflip/rir';

import { type ExportResult, exportDocument } from './export-dispatcher';
import { FFmpegEncoder, type FFmpegEncoderOptions } from './ffmpeg-encoder';
import { type FfprobeReport, ffprobe } from './ffprobe';
import {
  type BrowserFactory,
  PuppeteerCdpSession,
  createPuppeteerBrowserFactory,
} from './puppeteer-session';

export interface RenderReferenceFixtureOptions {
  readonly document: RIRDocument;
  readonly outputPath: string;
  /** Encoder knobs; codec defaults to 'h264'. */
  readonly encoder?: Partial<FFmpegEncoderOptions>;
  readonly chromePath?: string;
  readonly ffmpegPath?: string;
  readonly ffprobePath?: string;
  /** Override the browser factory (tests). Default: launches real Chrome. */
  readonly browserFactory?: BrowserFactory;
}

export interface RenderReferenceFixtureResult {
  readonly export: ExportResult;
  readonly probe: FfprobeReport;
}

/**
 * Render a single fixture document end-to-end: browser → frames →
 * FFmpegEncoder → ffprobe. Callers pass `outputPath` and receive both
 * the export dispatcher result and the ffprobe report; tests assert on
 * stream/format metadata.
 */
export async function renderReferenceFixture(
  opts: RenderReferenceFixtureOptions,
): Promise<RenderReferenceFixtureResult> {
  const browserFactory =
    opts.browserFactory ??
    createPuppeteerBrowserFactory(
      opts.chromePath !== undefined ? { executablePath: opts.chromePath } : {},
    );
  const session = new PuppeteerCdpSession({ browserFactory });
  const encoder = FFmpegEncoder.create({
    outputPath: opts.outputPath,
    width: opts.document.width,
    height: opts.document.height,
    fps: opts.document.frameRate,
    profile: opts.encoder?.profile ?? 'h264',
    ...(opts.encoder?.crf !== undefined ? { crf: opts.encoder.crf } : {}),
    ...(opts.ffmpegPath !== undefined ? { ffmpegPath: opts.ffmpegPath } : {}),
  });

  try {
    const result = await exportDocument(opts.document, {
      session,
      sink: encoder,
    });
    const probe = await ffprobe({
      filePath: opts.outputPath,
      ...(opts.ffprobePath !== undefined ? { ffprobePath: opts.ffprobePath } : {}),
    });
    return { export: result, probe };
  } finally {
    await session.closeSession();
  }
}

/**
 * Best-effort detection of whether the host can run the full reference
 * render pipeline. Checks: (a) a Chrome/Chromium binary is reachable at
 * a likely path or via PUPPETEER_EXECUTABLE_PATH, (b) `ffmpeg` is on
 * PATH (or at FFMPEG_PATH). Used by the integration-test guard so the
 * suite skips cleanly on offline CI.
 */
export async function canRunReferenceRenders(): Promise<{
  readonly ok: boolean;
  readonly chromePath: string | null;
  readonly ffmpegPath: string | null;
  readonly ffprobePath: string | null;
  readonly reason: string | null;
}> {
  const chromePath = await findChrome();
  const ffmpegPath = await findOnPath('ffmpeg', 'FFMPEG_PATH');
  const ffprobePath = await findOnPath('ffprobe', 'FFPROBE_PATH');
  if (chromePath === null) {
    return { ok: false, chromePath, ffmpegPath, ffprobePath, reason: 'no Chrome/Chromium binary' };
  }
  if (ffmpegPath === null) {
    return { ok: false, chromePath, ffmpegPath, ffprobePath, reason: 'no ffmpeg on PATH' };
  }
  if (ffprobePath === null) {
    return { ok: false, chromePath, ffmpegPath, ffprobePath, reason: 'no ffprobe on PATH' };
  }
  return { ok: true, chromePath, ffmpegPath, ffprobePath, reason: null };
}

async function findChrome(): Promise<string | null> {
  const env = process.env.PUPPETEER_EXECUTABLE_PATH ?? process.env.CHROME_BIN;
  if (env !== undefined && env.length > 0 && (await exists(env))) return env;
  const candidates =
    platform() === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ]
      : platform() === 'win32'
        ? [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          ]
        : ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}

async function findOnPath(binary: string, envVar: string): Promise<string | null> {
  const env = process.env[envVar];
  if (env !== undefined && env.length > 0 && (await exists(env))) return env;
  const pathEnv = process.env.PATH ?? '';
  const sep = platform() === 'win32' ? ';' : ':';
  for (const dir of pathEnv.split(sep).filter(Boolean)) {
    const candidate = platform() === 'win32' ? `${dir}\\${binary}.exe` : `${dir}/${binary}`;
    if (await exists(candidate)) return candidate;
  }
  return null;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
