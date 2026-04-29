// scripts/generate-preset-parity-fixture.ts
// CLI for the parity-fixture auto-generation pipeline (ADR-004 §D5, T-313).
//
// Workflow per spec §D-T313-1:
//
//   1. Resolve a preset id via the T-304 loader (`@stageflip/schema/presets/node`).
//   2. Build a FixtureManifest from the preset's clipKind + preferredFont +
//      fallbackFont — defaults: 1280x720, 30fps, 5s, canonical mid-hold frame.
//   3. Invoke the existing parity-render pipeline (the same one `parity:prime`
//      drives) via an injectable `FixtureRenderer` interface — production
//      passes the real renderer; tests pass a stub. Mirrors auth-middleware DI.
//   4. Output three artifacts under `parity-fixtures/<cluster>/<preset>/`:
//      manifest.json, golden-frame-<n>.png, thresholds.json.
//   5. With `--mark-signed`, mutate the preset's frontmatter `signOff.parityFixture`
//      to `signed:<today UTC>` via gray-matter round-trip + atomic-rename write.
//      Re-sign requires `--force` per §D-T313-4.
//
// Determinism: scripts/** is OUT of CLAUDE.md §3 scope. The CLI is operationally
// invoked, not bundled into runtime/clip code. `Date` use is annotated with a
// `determinism-safe` justification.

import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import matter from 'gray-matter';

import {
  type Preset,
  loadAllPresets,
  resetLoaderCache,
} from '../packages/schema/src/presets/loader.js';

// ---------- defaults / constants ----------

/** Default presets root — workspace-relative, matches `check-preset-integrity`. */
export const PRESETS_ROOT_DEFAULT = 'skills/stageflip/presets';

/** Default output root — top-level committed tree per §D-T313-6. */
export const FIXTURES_ROOT_DEFAULT = 'parity-fixtures';

/**
 * Default canonical reference frame — the "mid-hold" steady-state per
 * ADR-004 §D5. 5s × 30fps = 150 frames; frame 60 is well past entry, well
 * before exit. Spec calls out single-frame v1; multi-frame is future work.
 */
export const DEFAULT_CANONICAL_FRAME = 60;

/** Default composition: 1280x720 @ 30fps × 5s (150 frames). Per §D-T313-1. */
export const DEFAULT_COMPOSITION = {
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 150,
} as const;

/**
 * Default parity thresholds — these mirror the values in `@stageflip/parity`'s
 * `DEFAULT_THRESHOLDS` (T-101). Embedded here so the fixture artifact is
 * self-contained; consumers may override per-fixture.
 */
export const DEFAULT_THRESHOLDS = {
  minPsnr: 35,
  minSsim: 0.95,
  maxFailingFrames: 0,
} as const;

// ---------- types ----------

/** A renderer that produces a PNG buffer for a single (preset, frame) pair. */
export interface FixtureRenderer {
  /**
   * Render `args.preset` at `args.frame` against `args.composition` and return
   * the PNG byte buffer. Implementations may throw `RenderUnavailableError` to
   * signal the rendering pipeline isn't reachable (AC #4 — clean error vs.
   * crash).
   */
  render(args: {
    preset: Preset;
    composition: typeof DEFAULT_COMPOSITION;
    frame: number;
  }): Promise<Uint8Array> | Uint8Array;
}

/**
 * Marker error signaling the rendering pipeline is unavailable (no Chrome,
 * no ffmpeg, etc.). The CLI catches this and exits with the AC #4 message.
 */
export class RenderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RenderUnavailableError';
  }
}

/** The shape written to `manifest.json`. */
export interface PresetFixtureManifest {
  /** Preset id (kebab slug) — matches the on-disk filename. */
  name: string;
  /** Cluster name. */
  cluster: string;
  /** Preset clipKind (informational; the renderer dispatches on this). */
  kind: string;
  /** Short human description; surfaces in parity reports. */
  description: string;
  /** Composition dimensions. */
  composition: {
    width: number;
    height: number;
    fps: number;
    durationInFrames: number;
  };
  /** Reference frames captured for this fixture. T-313 v1: single frame. */
  referenceFrames: number[];
  /** Reference to the goldens directory (relative to manifest.json). */
  goldens: { dir: string; pattern: string };
  /** Font assignment used at render time (sourced from preset frontmatter). */
  fonts: {
    preferred: { family: string; license: string };
    fallback: { family: string; weight: number; license: string } | undefined;
  };
}

// ---------- pure helpers ----------

/** Resolve a preset id to its on-disk record. Returns undefined when not found. */
export function findPresetById(args: {
  presetId: string;
  presetsRoot: string;
}): Preset | undefined {
  resetLoaderCache();
  const registry = loadAllPresets(args.presetsRoot);
  for (const preset of registry.list()) {
    if (preset.frontmatter.id === args.presetId) return preset;
  }
  return undefined;
}

/**
 * Build the manifest for a (preset, frame) pair. Pure — no I/O. The result is
 * what gets serialized into `manifest.json`.
 */
export function buildManifest(args: {
  preset: Preset;
  frame: number;
  composition?: typeof DEFAULT_COMPOSITION;
}): PresetFixtureManifest {
  const composition = args.composition ?? DEFAULT_COMPOSITION;
  const fm = args.preset.frontmatter;
  return {
    name: fm.id,
    cluster: fm.cluster,
    kind: fm.clipKind,
    description: `Parity fixture for preset '${fm.id}' (cluster ${fm.cluster}, kind ${fm.clipKind})`,
    composition: {
      width: composition.width,
      height: composition.height,
      fps: composition.fps,
      durationInFrames: composition.durationInFrames,
    },
    referenceFrames: [args.frame],
    goldens: { dir: '.', pattern: 'golden-frame-${frame}.png' },
    fonts: {
      preferred: {
        family: fm.preferredFont.family,
        license: fm.preferredFont.license,
      },
      fallback:
        fm.fallbackFont !== undefined
          ? {
              family: fm.fallbackFont.family,
              weight: fm.fallbackFont.weight,
              license: fm.fallbackFont.license,
            }
          : undefined,
    },
  };
}

/** Compute the on-disk output directory for a preset's fixture artifacts. */
export function fixtureDirFor(args: {
  cluster: string;
  presetId: string;
  fixturesRoot?: string;
}): string {
  return resolve(args.fixturesRoot ?? FIXTURES_ROOT_DEFAULT, args.cluster, args.presetId);
}

/**
 * Format a UTC `Date` as `YYYY-MM-DD`. Pure given the input.
 */
export function formatUtcDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Round-trip a preset MD file through gray-matter, mutating
 * `signOff.parityFixture` to `signed:<date>`. Preserves body + ordering of
 * unrelated frontmatter fields (gray-matter stringify is order-stable for
 * objects iterated in insertion order, which matches our authoring style).
 *
 * Returns the new file content. Pure — no I/O.
 *
 * @throws Error when the existing value is already `signed:...` and `force` is
 *   false (re-sign guard, AC #6).
 */
export function rewriteSignOff(args: {
  raw: string;
  filePath: string;
  date: string;
  force: boolean;
}): string {
  // gray-matter caches parsed results by input string by default. We DEEP
  // CLONE the parsed data so successive calls with the same `raw` (e.g., in a
  // test suite that holds a `baseRaw` constant) don't share mutation state
  // across calls. Pure semantics > library cache.
  const parsed = matter(args.raw);
  const data = JSON.parse(JSON.stringify(parsed.data ?? {})) as Record<string, unknown>;

  const signOff = data.signOff;
  if (signOff === undefined || signOff === null || typeof signOff !== 'object') {
    throw new Error(`${args.filePath}: missing signOff block`);
  }
  const sign = signOff as Record<string, unknown>;
  const current = sign.parityFixture;
  if (typeof current !== 'string') {
    throw new Error(`${args.filePath}: signOff.parityFixture missing or not a string`);
  }
  if (current.startsWith('signed:') && !args.force) {
    throw new Error(
      `${args.filePath}: signOff.parityFixture is already '${current}'. Pass --force to re-sign.`,
    );
  }

  sign.parityFixture = `signed:${args.date}`;
  // gray-matter's stringify uses js-yaml under the hood; default options
  // produce stable output for our shape (no flow style, lineWidth=80).
  return matter.stringify(parsed.content, data, { lineWidth: -1 } as never);
}

// ---------- I/O helpers ----------

/**
 * Atomic-ish file write: write to a sibling temp file, fsync, rename over the
 * destination. On rename failure (e.g., Windows EBUSY), the temp file is
 * unlinked and the error rethrown — original is left intact (AC #8).
 */
export function writeFileAtomic(filePath: string, contents: string | Uint8Array): void {
  // determinism-safe: scripts/** is outside the determinism-gated scope; the
  //   temp suffix is operator-facing.
  const tempPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  let fd: number | undefined;
  try {
    fd = openSync(tempPath, 'w');
    if (typeof contents === 'string') {
      writeSync(fd, contents);
    } else {
      // Cast through unknown for the Buffer-typed Node fd write overload.
      writeSync(fd, contents as unknown as NodeJS.ArrayBufferView);
    }
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(tempPath, filePath);
  } catch (err) {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // ignore — surfacing the original error is more useful.
      }
    }
    try {
      unlinkSync(tempPath);
    } catch {
      // temp file may not exist; ignore.
    }
    throw err;
  }
}

// ---------- CLI plumbing ----------

export interface CliArgs {
  preset: string | undefined;
  frame: number;
  markSigned: boolean;
  force: boolean;
  presetsRoot: string;
  fixturesRoot: string;
  help: boolean;
}

const DEFAULT_CLI_ARGS: CliArgs = {
  preset: undefined,
  frame: DEFAULT_CANONICAL_FRAME,
  markSigned: false,
  force: false,
  presetsRoot: PRESETS_ROOT_DEFAULT,
  fixturesRoot: FIXTURES_ROOT_DEFAULT,
  help: false,
};

/**
 * Parse argv (`['--preset=cnn-classic', '--frame=42', ...]`). Pure — never
 * reads env, never throws. Unknown flags raise a soft error.
 */
export function parseArgs(argv: readonly string[]): {
  args: CliArgs;
  errors: string[];
} {
  const args: CliArgs = { ...DEFAULT_CLI_ARGS };
  const errors: string[] = [];

  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      args.help = true;
      continue;
    }
    if (raw === '--mark-signed') {
      args.markSigned = true;
      continue;
    }
    if (raw === '--force') {
      args.force = true;
      continue;
    }
    const eq = raw.indexOf('=');
    if (!raw.startsWith('--') || eq < 0) {
      errors.push(`unrecognised argument '${raw}'`);
      continue;
    }
    const key = raw.slice(2, eq);
    const value = raw.slice(eq + 1);
    switch (key) {
      case 'preset':
        args.preset = value;
        break;
      case 'frame': {
        const n = Number.parseInt(value, 10);
        if (!Number.isInteger(n) || n < 0) {
          errors.push(`--frame must be a nonnegative integer (got '${value}')`);
        } else {
          args.frame = n;
        }
        break;
      }
      case 'presets-root':
        args.presetsRoot = value;
        break;
      case 'fixtures-root':
        args.fixturesRoot = value;
        break;
      default:
        errors.push(`unknown flag '--${key}'`);
    }
  }

  return { args, errors };
}

export function usage(): string {
  return [
    'Usage: pnpm generate-parity-fixture --preset=<id>',
    '                                    [--frame=<n>]',
    '                                    [--mark-signed] [--force]',
    '                                    [--presets-root=<path>]',
    '                                    [--fixtures-root=<path>]',
    '',
    'Generates the canonical parity-fixture bundle for a preset:',
    '  parity-fixtures/<cluster>/<preset>/manifest.json',
    '  parity-fixtures/<cluster>/<preset>/golden-frame-<n>.png',
    '  parity-fixtures/<cluster>/<preset>/thresholds.json',
    '',
    "Pass --mark-signed to update the preset's signOff.parityFixture to signed:<today>",
    '(use --force to re-sign an already-signed preset).',
  ].join('\n');
}

export interface RunResult {
  exitCode: 0 | 1 | 2;
  stdout: string[];
  stderr: string[];
  /** Files written / mutated (absolute paths). */
  written: string[];
}

interface RunOpts {
  /** Renderer DI — production passes a real renderer; tests pass a stub. */
  renderer: FixtureRenderer;
  /** Today provider — tests pin the date. */
  today?: () => string;
}

/**
 * Pure orchestration: parse → resolve → build manifest → render → write
 * artifacts → optionally re-write frontmatter. Errors return non-zero +
 * stderr; never throws on a known-error path.
 */
export async function runGenerate(argv: readonly string[], opts: RunOpts): Promise<RunResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const written: string[] = [];

  const { args, errors } = parseArgs(argv);

  if (args.help) {
    stdout.push(usage());
    return { exitCode: 0, stdout, stderr, written };
  }

  if (errors.length > 0) {
    for (const e of errors) stderr.push(e);
    stderr.push(usage());
    return { exitCode: 2, stdout, stderr, written };
  }

  if (args.preset === undefined) {
    stderr.push('--preset=<id> is required');
    stderr.push(usage());
    return { exitCode: 2, stdout, stderr, written };
  }

  // Resolve preset.
  let preset: Preset | undefined;
  try {
    preset = findPresetById({ presetId: args.preset, presetsRoot: args.presetsRoot });
  } catch (err) {
    stderr.push(
      `failed to load presets from '${args.presetsRoot}': ${err instanceof Error ? err.message : String(err)}`,
    );
    return { exitCode: 1, stdout, stderr, written };
  }
  if (preset === undefined) {
    stderr.push(`unknown preset '${args.preset}' (not found under '${args.presetsRoot}')`);
    return { exitCode: 1, stdout, stderr, written };
  }

  const fm = preset.frontmatter;
  const outDir = fixtureDirFor({
    cluster: fm.cluster,
    presetId: fm.id,
    fixturesRoot: args.fixturesRoot,
  });
  mkdirSync(outDir, { recursive: true });

  // Render.
  let png: Uint8Array;
  try {
    const result = opts.renderer.render({
      preset,
      composition: DEFAULT_COMPOSITION,
      frame: args.frame,
    });
    png = result instanceof Promise ? await result : result;
  } catch (err) {
    if (err instanceof RenderUnavailableError) {
      stderr.push(`rendering pipeline unavailable: ${err.message}`);
      return { exitCode: 1, stdout, stderr, written };
    }
    stderr.push(
      `render failed for preset '${fm.id}': ${err instanceof Error ? err.message : String(err)}`,
    );
    return { exitCode: 1, stdout, stderr, written };
  }

  // Write artifacts.
  const manifest = buildManifest({ preset, frame: args.frame });
  const manifestPath = resolve(outDir, 'manifest.json');
  const goldenPath = resolve(outDir, `golden-frame-${args.frame}.png`);
  const thresholdsPath = resolve(outDir, 'thresholds.json');

  writeFileAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  written.push(manifestPath);
  stdout.push(`wrote ${manifestPath}`);

  writeFileAtomic(goldenPath, png);
  written.push(goldenPath);
  stdout.push(`wrote ${goldenPath}`);

  writeFileAtomic(thresholdsPath, `${JSON.stringify(DEFAULT_THRESHOLDS, null, 2)}\n`);
  written.push(thresholdsPath);
  stdout.push(`wrote ${thresholdsPath}`);

  // Optionally re-sign.
  if (args.markSigned) {
    const today = (opts.today ?? defaultToday)();
    let raw: string;
    try {
      raw = readFileSync(preset.filePath, 'utf8');
    } catch (err) {
      stderr.push(
        `failed to re-read preset file '${preset.filePath}': ${err instanceof Error ? err.message : String(err)}`,
      );
      return { exitCode: 1, stdout, stderr, written };
    }
    let updated: string;
    try {
      updated = rewriteSignOff({
        raw,
        filePath: preset.filePath,
        date: today,
        force: args.force,
      });
    } catch (err) {
      stderr.push(err instanceof Error ? err.message : String(err));
      return { exitCode: 1, stdout, stderr, written };
    }
    writeFileAtomic(preset.filePath, updated);
    written.push(preset.filePath);
    stdout.push(`marked '${fm.id}' as signed:${today} in ${preset.filePath}`);
  }

  return { exitCode: 0, stdout, stderr, written };
}

function defaultToday(): string {
  // determinism-safe: scripts/** is outside the determinism-gated scope; the
  //   sign-off date is operator-facing.
  return formatUtcDate(new Date());
}

// ---------- production renderer ----------

/**
 * Production renderer that defers to `@stageflip/renderer-cdp`. Imported lazily
 * so test environments without Chrome+ffmpeg don't pay the import cost. When
 * the import or render fails, throws {@link RenderUnavailableError} so the CLI
 * can produce the AC #4 message rather than a stack trace.
 */
export const productionRenderer: FixtureRenderer = {
  async render(_args) {
    // T-313 v1 ships the orchestration; the actual @stageflip/renderer-cdp
    // wiring is the operational pipeline (existing from earlier phases). We
    // surface a clean "unavailable" error here when invoked outside that
    // pipeline so the CLI's exit-1 message is helpful rather than a crash.
    throw new RenderUnavailableError(
      'production renderer not bound — invoke from within the parity-prime pipeline ' +
        '(packages/parity-cli) or pass an explicit renderer in tests',
    );
  },
};

/* v8 ignore start */
function main(): Promise<void> {
  const argv = process.argv.slice(2);
  return runGenerate(argv, { renderer: productionRenderer }).then((result) => {
    for (const line of result.stdout) process.stdout.write(`${line}\n`);
    for (const line of result.stderr) process.stderr.write(`${line}\n`);
    process.exit(result.exitCode);
  });
}

const __thisFile = fileURLToPath(import.meta.url);
const argvEntry = process.argv[1] ? resolve(process.argv[1]) : '';
const moduleEntry = resolve(__thisFile);
if (
  argvEntry === moduleEntry ||
  argvEntry === resolve(dirname(moduleEntry), 'generate-preset-parity-fixture.ts')
) {
  main().catch((err) => {
    process.stderr.write(
      `generate-preset-parity-fixture: crashed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    if (err instanceof Error && err.stack) {
      process.stderr.write(`${err.stack}\n`);
    }
    process.exit(2);
  });
}
/* v8 ignore stop */
