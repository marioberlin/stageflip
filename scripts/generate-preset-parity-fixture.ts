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

/** A renderer that produces a PNG buffer for a single (preset, frame, variant?) tuple. */
export interface FixtureRenderer {
  /**
   * Render `args.preset` at `args.frame` against `args.composition` and return
   * the PNG byte buffer. Implementations may throw `RenderUnavailableError` to
   * signal the rendering pipeline isn't reachable (AC #4 — clean error vs.
   * crash).
   *
   * `args.variant`, when present, names the variant being rendered (T-359a
   * D-T359a-1). Single-variant invocations omit it; the renderer is expected
   * to use it as the `state` (or otherwise variant-discriminating) prop value
   * passed to the bound clipKind component.
   */
  render(args: {
    preset: Preset;
    composition: typeof DEFAULT_COMPOSITION;
    frame: number;
    variant?: string;
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

/** Per-variant entry in the multi-variant manifest (T-359a D-T359a-1). */
export interface PresetFixtureVariantEntry {
  /** Frames captured for this variant. v1: single frame mirroring `referenceFrames`. */
  frames: number[];
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
  /**
   * Object-keyed multi-variant slot (T-359a D-T359a-1). Present only when one
   * or more `--variant=<name>` flags were passed; absent for single-variant
   * legacy manifests so the on-disk shape is byte-identical to T-313 (AC #11).
   */
  variants?: Record<string, PresetFixtureVariantEntry>;
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
 *
 * When `args.variants` is provided and non-empty, the returned manifest carries
 * an object-keyed `variants` field (T-359a D-T359a-1) and the goldens pattern
 * widens to include `${variant}`. When omitted (or empty), the manifest matches
 * the T-313 single-variant shape byte-for-byte (AC #11).
 */
export function buildManifest(args: {
  preset: Preset;
  frame: number;
  composition?: typeof DEFAULT_COMPOSITION;
  variants?: readonly string[];
}): PresetFixtureManifest {
  const composition = args.composition ?? DEFAULT_COMPOSITION;
  const fm = args.preset.frontmatter;
  const variants = args.variants ?? [];
  const isMulti = variants.length > 0;

  const base: PresetFixtureManifest = {
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
    goldens: {
      dir: '.',
      pattern: isMulti ? 'golden-frame-${frame}-${variant}.png' : 'golden-frame-${frame}.png',
    },
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

  if (isMulti) {
    const variantsMap: Record<string, PresetFixtureVariantEntry> = {};
    for (const v of variants) {
      variantsMap[v] = { frames: [args.frame] };
    }
    base.variants = variantsMap;
  }

  return base;
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
  /**
   * Variant names declared via `--variant=<name>` (repeatable, comma-
   * separated). Empty array means single-variant legacy mode (T-313 shape,
   * AC #11). Order is the operator's declaration order; duplicates are
   * de-duplicated by `parseArgs`.
   */
  variants: string[];
}

const DEFAULT_CLI_ARGS: CliArgs = {
  preset: undefined,
  frame: DEFAULT_CANONICAL_FRAME,
  markSigned: false,
  force: false,
  presetsRoot: PRESETS_ROOT_DEFAULT,
  fixturesRoot: FIXTURES_ROOT_DEFAULT,
  help: false,
  variants: [],
};

/**
 * Variant-name regex — camelCase, must start lowercase letter, no hyphens.
 * Per T-359a D-T359a-8.
 */
export const VARIANT_NAME_REGEX = /^[a-z][a-zA-Z0-9]*$/;

/**
 * Parse argv (`['--preset=cnn-classic', '--frame=42', ...]`). Pure — never
 * reads env, never throws. Unknown flags raise a soft error.
 */
export function parseArgs(argv: readonly string[]): {
  args: CliArgs;
  errors: string[];
} {
  // Fresh `variants` array per invocation — the spread copies the default's
  // empty array reference, but parseArgs may push into it; without a fresh
  // allocation, repeated parseArgs calls would mutate shared state.
  const args: CliArgs = { ...DEFAULT_CLI_ARGS, variants: [] };
  const errors: string[] = [];
  const variantSet = new Set<string>();

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
      case 'variant': {
        // T-359a D-T359a-8: comma-separated form folded into the same set as
        // repeated `--variant=` flags. Empty entries are an error (e.g. `a,,b`).
        const parts = value.split(',');
        for (const part of parts) {
          if (!VARIANT_NAME_REGEX.test(part)) {
            errors.push(
              `--variant '${part}' must match ${VARIANT_NAME_REGEX.source} (camelCase, no hyphens)`,
            );
            continue;
          }
          if (!variantSet.has(part)) {
            variantSet.add(part);
            args.variants.push(part);
          }
        }
        break;
      }
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
    '                                    [--variant=<name>]...',
    '                                    [--mark-signed] [--force]',
    '                                    [--presets-root=<path>]',
    '                                    [--fixtures-root=<path>]',
    '',
    'Generates the canonical parity-fixture bundle for a preset:',
    '  parity-fixtures/<cluster>/<preset>/manifest.json',
    '  parity-fixtures/<cluster>/<preset>/golden-frame-<n>.png',
    '  parity-fixtures/<cluster>/<preset>/thresholds.json',
    '',
    'Multi-variant (T-359a):',
    '  Pass --variant=<name> one or more times (or --variant=a,b,c) to render',
    '  one golden per declared variant, written as golden-frame-<n>-<variant>.png.',
    '  The manifest gains an object-keyed `variants` field. Variant names must',
    '  match camelCase (^[a-z][a-zA-Z0-9]*$). With --mark-signed, ALL declared',
    '  variants must render cleanly — partial failure aborts the sign-off.',
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

  // Multi-variant render loop (T-359a). With no `--variant` flags this
  // collapses to a single render with `variant: undefined`, preserving the
  // T-313 single-variant filename `golden-frame-<n>.png` (AC #11).
  const isMulti = args.variants.length > 0;
  const renderTargets: ReadonlyArray<{ variant: string | undefined; goldenPath: string }> = isMulti
    ? args.variants.map((v) => ({
        variant: v,
        goldenPath: resolve(outDir, `golden-frame-${args.frame}-${v}.png`),
      }))
    : [{ variant: undefined, goldenPath: resolve(outDir, `golden-frame-${args.frame}.png`) }];

  // Render every target BEFORE writing any artifact. This preserves the
  // atomic-per-manifest sign-off invariant (T-359a D-T359a-2 / AC #5):
  // partial render failure leaves the on-disk fixture untouched and aborts
  // before any frontmatter mutation.
  const renderedPngs: Uint8Array[] = [];
  for (const target of renderTargets) {
    try {
      const result = opts.renderer.render({
        preset,
        composition: DEFAULT_COMPOSITION,
        frame: args.frame,
        ...(target.variant !== undefined ? { variant: target.variant } : {}),
      });
      renderedPngs.push(result instanceof Promise ? await result : result);
    } catch (err) {
      if (err instanceof RenderUnavailableError) {
        stderr.push(`rendering pipeline unavailable: ${err.message}`);
        return { exitCode: 1, stdout, stderr, written };
      }
      const tag = target.variant !== undefined ? ` (variant '${target.variant}')` : '';
      stderr.push(
        `render failed for preset '${fm.id}'${tag}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { exitCode: 1, stdout, stderr, written };
    }
  }

  // Write artifacts.
  const manifest = buildManifest({
    preset,
    frame: args.frame,
    ...(isMulti ? { variants: args.variants } : {}),
  });
  const manifestPath = resolve(outDir, 'manifest.json');
  const thresholdsPath = resolve(outDir, 'thresholds.json');

  writeFileAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  written.push(manifestPath);
  stdout.push(`wrote ${manifestPath}`);

  for (let i = 0; i < renderTargets.length; i++) {
    const target = renderTargets[i];
    const png = renderedPngs[i];
    if (target === undefined || png === undefined) continue; // unreachable; guards noUncheckedIndexedAccess.
    writeFileAtomic(target.goldenPath, png);
    written.push(target.goldenPath);
    stdout.push(`wrote ${target.goldenPath}`);
  }

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

// ---------- production renderer (T-359a — bindProductionRenderer hook) ----------

/**
 * The current production-renderer impl. Module-scoped late binding (T-359a
 * D-T359a-3): the standalone script entrypoint observes the unbound default
 * and surfaces the clean "unavailable" error; `packages/parity-cli`'s
 * `generate-fixture` bin calls {@link bindProductionRenderer} at module load
 * to swap in the real puppeteer/CDP-backed renderer.
 *
 * Module-scoped state is acceptable here per CLAUDE.md §3 (scripts/** is
 * outside the determinism-gated scope) and per D-T359a-9 (operator invokes
 * once per process — no shared-mutation hazard).
 */
const UNBOUND_RENDERER: FixtureRenderer = {
  render(_args) {
    throw new RenderUnavailableError(
      'production renderer not bound — invoke from within the parity-prime pipeline ' +
        '(packages/parity-cli) or pass an explicit renderer in tests',
    );
  },
};

let _productionRendererImpl: FixtureRenderer = UNBOUND_RENDERER;

/**
 * Bind the production-renderer implementation. Called by
 * `packages/parity-cli` at process start; safe to call repeatedly (last-wins
 * semantics). Tests should prefer the {@link FixtureRenderer} DI parameter
 * to `runGenerate` over binding the singleton.
 *
 * T-359a D-T359a-3 / AC #8.
 */
export function bindProductionRenderer(renderer: FixtureRenderer): void {
  _productionRendererImpl = renderer;
}

/**
 * Reset the production-renderer impl to the unbound default. Test-only —
 * the underscore prefix marks it as not part of the public API. Tests use it
 * to keep the module-scoped `_productionRendererImpl` from leaking across
 * test boundaries.
 */
export function __resetProductionRendererForTests(): void {
  _productionRendererImpl = UNBOUND_RENDERER;
}

/**
 * Production renderer surface. Defers every call to whichever
 * {@link FixtureRenderer} is currently bound — `UNBOUND_RENDERER` until
 * `bindProductionRenderer` swaps in the real impl. The standalone script's
 * `main()` invokes this; backward compat with T-313's "unavailable" error
 * (AC #9) is preserved by the unbound default.
 */
export const productionRenderer: FixtureRenderer = {
  render(args) {
    return _productionRendererImpl.render(args);
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
