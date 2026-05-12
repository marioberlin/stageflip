// scripts/generate-audience-clip-parity-fixture.ts
// CLI parallel to `generate-preset-parity-fixture.ts` (T-313) driving the
// audience-runtime static-fallback renderer for the eleven Cluster I clip
// kinds (T-476).
//
// Workflow:
//
//   1. Resolve the target audience clip kind from `--clip-kind=<kind>`.
//   2. Read `parity-fixtures/audience/<kind>/snapshot.json` and validate
//      against `aggregationValueSchema` from `@stageflip/audience-contract`.
//   3. Read `parity-fixtures/audience/<kind>/manifest.json` for composition
//      + reference-frame metadata.
//   4. Invoke a dependency-injected `AudienceFixtureRenderer` — production
//      passes the real renderer (bound via `bindProductionRenderer`); tests
//      pass a stub. Mirrors T-313's DI pattern.
//   5. Write `golden-frame-<n>.png` per `referenceFrames`.
//
// Determinism: `scripts/**` is OUT of CLAUDE.md §3 scope. The CLI is
// operationally invoked, not bundled into runtime/clip code.
//
// **§13 verification posture per CLAUDE.md option 2**: the goldens this CLI
// emits become the parity-comparison artifacts the audience runtime is
// regressed against. The PO ratification post-merge is the formal §13
// sign-off (per T-451 ADR-010 deferral).

import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AUDIENCE_CLIP_KINDS,
  type AggregationValue,
  type AudienceClipKind,
  type AudienceProvenance,
  aggregationValueSchema,
} from '../packages/audience-contract/src/index.js';

// ---------- defaults / constants ----------

/** Default fixtures root — workspace-relative. Audience fixtures live under `<root>/audience/<kind>/`. */
export const FIXTURES_ROOT_DEFAULT = 'parity-fixtures';

/** Cluster name for audience fixtures — keyed under `parity-fixtures/audience/`. */
export const AUDIENCE_CLUSTER_NAME = 'audience';

/**
 * Default canonical reference frame for audience fixtures — mid-hold per the
 * task spec (frame 75 of a 150-frame composition at 30 fps = 2.5 s).
 */
export const DEFAULT_CANONICAL_FRAME = 75;

/** Default composition: 1920x1080 @ 30 fps × 5 s (150 frames). Per T-476 spec. */
export const DEFAULT_COMPOSITION = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 150,
} as const;

// ---------- types ----------

/** Composition shape — width / height / fps / durationInFrames in frames. */
export interface FixtureComposition {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

/** The shape persisted to `manifest.json`. */
export interface AudienceFixtureManifest {
  /** Audience clip kind (matches directory name + `kind` discriminant). */
  name: string;
  /** Cluster label — always `'audience'`. */
  cluster: string;
  /** Clip kind discriminant (`AudienceClipKind`). */
  kind: AudienceClipKind;
  /** Short human description; surfaces in parity reports. */
  description: string;
  /** Composition dimensions. */
  composition: FixtureComposition;
  /** Reference frames captured for this fixture (single mid-hold per v1). */
  referenceFrames: number[];
  /** Pattern describing the golden filenames on disk. */
  goldens: { dir: string; pattern: string };
  /** Audit trail — references the originating task + sign-off status. */
  auditTagged: string;
}

/**
 * Renderer that produces a PNG buffer for a single (kind, snapshot, frame)
 * tuple. Production passes the real CDP-backed renderer; tests pass a stub.
 */
export interface AudienceFixtureRenderer {
  /**
   * Render the audience clip's static-fallback path for the given
   * provenance + composition + frame, returning the PNG byte buffer.
   *
   * Implementations may throw `RenderUnavailableError` to signal the
   * rendering pipeline isn't reachable.
   */
  render(args: {
    clipKind: AudienceClipKind;
    provenance: AudienceProvenance;
    composition: FixtureComposition;
    frame: number;
  }): Promise<Uint8Array> | Uint8Array;
}

/**
 * Marker error signaling the rendering pipeline is unavailable (no Chrome,
 * no audience runtime registration, etc.). The CLI catches this and exits
 * with a clean error message rather than crashing.
 */
export class RenderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RenderUnavailableError';
  }
}

// ---------- pure helpers ----------

/**
 * Compute the on-disk directory for an audience fixture's artifacts.
 *
 * @param args.clipKind Audience clip kind discriminant.
 * @param args.fixturesRoot Top-level fixtures root (defaults to `parity-fixtures`).
 */
export function fixtureDirFor(args: {
  clipKind: AudienceClipKind;
  fixturesRoot?: string;
}): string {
  return resolve(args.fixturesRoot ?? FIXTURES_ROOT_DEFAULT, AUDIENCE_CLUSTER_NAME, args.clipKind);
}

/**
 * Parse + validate `snapshot.json` for a clip kind. Returns the typed
 * `AggregationValue` when the discriminant matches the requested kind;
 * otherwise raises.
 *
 * @throws Error when the JSON fails to parse, schema validation fails, or
 *   the `kind` discriminant disagrees with the directory name.
 */
export function readSnapshot(args: {
  clipKind: AudienceClipKind;
  fixtureDir: string;
}): AggregationValue {
  const snapshotPath = resolve(args.fixtureDir, 'snapshot.json');
  const raw = readFileSync(snapshotPath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `failed to parse ${snapshotPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const result = aggregationValueSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `snapshot.json at ${snapshotPath} failed aggregationValueSchema validation: ${result.error.message}`,
    );
  }
  if (result.data.kind !== args.clipKind) {
    throw new Error(
      `snapshot.json at ${snapshotPath} has kind '${result.data.kind}' but directory is '${args.clipKind}'`,
    );
  }
  return result.data;
}

/**
 * Parse `manifest.json` for a clip kind. Returns the typed
 * `AudienceFixtureManifest` shape. No deep schema validation — the on-disk
 * file is operator-authored data and consumed by the generator only.
 */
export function readManifest(args: { fixtureDir: string }): AudienceFixtureManifest {
  const manifestPath = resolve(args.fixtureDir, 'manifest.json');
  const raw = readFileSync(manifestPath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `failed to parse ${manifestPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(`${manifestPath} is not a JSON object`);
  }
  return parsed as AudienceFixtureManifest;
}

/**
 * Build the synthetic `AudienceProvenance` payload the renderer consumes,
 * sourced from the fixture's snapshot + the requested frame number. The
 * synthetic envelope fields (`sessionId`, `provider`, etc.) are stable
 * literal values so the same fixture deterministically yields the same
 * rendered output across CI invocations.
 */
export function buildProvenance(args: {
  clipKind: AudienceClipKind;
  aggregation: AggregationValue;
  frame: number;
}): AudienceProvenance {
  return {
    provider: 'parity-fixture',
    sessionId: `audience-fixture-${args.clipKind}`,
    snapshotFrame: args.frame,
    voterCountAtCapture: 0,
    capturedAt: '2026-01-01T00:00:00.000Z',
    snapshotPolicy: 'final',
    clipKind: args.clipKind,
    aggregation: args.aggregation,
  };
}

/**
 * Atomic-ish file write: write to a sibling temp file, fsync, rename over
 * the destination. On rename failure the temp file is unlinked and the
 * error re-thrown — the original (if any) is left intact.
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
  clipKind: AudienceClipKind | undefined;
  fixturesRoot: string;
  help: boolean;
}

const DEFAULT_CLI_ARGS: CliArgs = {
  clipKind: undefined,
  fixturesRoot: FIXTURES_ROOT_DEFAULT,
  help: false,
};

/**
 * Parse argv (`['--clip-kind=heatmap', '--fixtures-root=...']`). Pure —
 * never reads env, never throws. Unknown flags raise a soft error.
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
    const eq = raw.indexOf('=');
    if (!raw.startsWith('--') || eq < 0) {
      errors.push(`unrecognised argument '${raw}'`);
      continue;
    }
    const key = raw.slice(2, eq);
    const value = raw.slice(eq + 1);
    switch (key) {
      case 'clip-kind': {
        if ((AUDIENCE_CLIP_KINDS as readonly string[]).includes(value)) {
          args.clipKind = value as AudienceClipKind;
        } else {
          errors.push(
            `--clip-kind must be one of ${AUDIENCE_CLIP_KINDS.join('|')} (got '${value}')`,
          );
        }
        break;
      }
      case 'fixtures-root':
        args.fixturesRoot = value;
        break;
      default:
        errors.push(`unknown flag '--${key}'`);
    }
  }

  return { args, errors };
}

/** CLI usage string. */
export function usage(): string {
  return [
    'Usage: pnpm generate-audience-clip-parity-fixture --clip-kind=<kind>',
    '                                                  [--fixtures-root=<path>]',
    '',
    'Generates the parity-fixture golden PNG for an audience clip kind:',
    '  parity-fixtures/audience/<kind>/golden-frame-<n>.png',
    '',
    `Valid clip kinds: ${AUDIENCE_CLIP_KINDS.join(', ')}`,
    '',
    'Reads existing snapshot.json + manifest.json from the fixture directory.',
    'The static-fallback path is rendered for the manifest.referenceFrames[0]',
    'frame; the resulting PNG is written next to the manifest.',
    '',
    "The fixture's goldens are written UNSIGNED — PO ratification post-merge",
    'is the formal §13 sign-off (T-451 ADR-010 deferral; carried by T-476).',
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
  renderer: AudienceFixtureRenderer;
}

/**
 * Pure orchestration: parse → resolve fixture dir → load snapshot +
 * manifest → render → write golden PNG. Errors return non-zero + stderr;
 * never throws on a known-error path.
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

  if (args.clipKind === undefined) {
    stderr.push('--clip-kind=<kind> is required');
    stderr.push(usage());
    return { exitCode: 2, stdout, stderr, written };
  }

  const fixtureDir = fixtureDirFor({
    clipKind: args.clipKind,
    fixturesRoot: args.fixturesRoot,
  });
  if (!existsSync(fixtureDir)) {
    stderr.push(`fixture directory does not exist: ${fixtureDir}`);
    return { exitCode: 1, stdout, stderr, written };
  }

  // Load + validate snapshot.json.
  let aggregation: AggregationValue;
  try {
    aggregation = readSnapshot({ clipKind: args.clipKind, fixtureDir });
  } catch (err) {
    stderr.push(err instanceof Error ? err.message : String(err));
    return { exitCode: 1, stdout, stderr, written };
  }

  // Load manifest.json.
  let manifest: AudienceFixtureManifest;
  try {
    manifest = readManifest({ fixtureDir });
  } catch (err) {
    stderr.push(err instanceof Error ? err.message : String(err));
    return { exitCode: 1, stdout, stderr, written };
  }

  const composition = manifest.composition ?? DEFAULT_COMPOSITION;
  const referenceFrames =
    manifest.referenceFrames !== undefined && manifest.referenceFrames.length > 0
      ? manifest.referenceFrames
      : [DEFAULT_CANONICAL_FRAME];

  // Render each reference frame BEFORE writing any artifact. Mirrors the
  // T-313 atomic-per-manifest invariant: partial render failure leaves
  // the on-disk fixture untouched.
  const renderedPngs: Array<{ frame: number; png: Uint8Array }> = [];
  for (const frame of referenceFrames) {
    const provenance = buildProvenance({
      clipKind: args.clipKind,
      aggregation,
      frame,
    });
    try {
      const result = opts.renderer.render({
        clipKind: args.clipKind,
        provenance,
        composition,
        frame,
      });
      const png = result instanceof Promise ? await result : result;
      renderedPngs.push({ frame, png });
    } catch (err) {
      if (err instanceof RenderUnavailableError) {
        stderr.push(`rendering pipeline unavailable: ${err.message}`);
        return { exitCode: 1, stdout, stderr, written };
      }
      stderr.push(
        `render failed for clip-kind '${args.clipKind}' at frame ${frame}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { exitCode: 1, stdout, stderr, written };
    }
  }

  // Ensure the directory exists (it must — checked above — but recursive
  // mkdir is idempotent and guards against operator overrides of
  // `--fixtures-root`).
  mkdirSync(fixtureDir, { recursive: true });

  for (const { frame, png } of renderedPngs) {
    const goldenPath = resolve(fixtureDir, `golden-frame-${frame}.png`);
    writeFileAtomic(goldenPath, png);
    written.push(goldenPath);
    stdout.push(`wrote ${goldenPath}`);
  }

  return { exitCode: 0, stdout, stderr, written };
}

// ---------- production renderer (late-binding hook) ----------

/**
 * Module-scoped late binding (mirrors T-313 / T-359a): the standalone
 * entrypoint observes the unbound default and surfaces a clean
 * "unavailable" error. The parity-prime pipeline calls
 * {@link bindProductionRenderer} at module load to swap in the real
 * audience-runtime-backed renderer.
 *
 * Module-scoped state is acceptable here per CLAUDE.md §3 (scripts/** is
 * outside the determinism-gated scope).
 */
const UNBOUND_RENDERER: AudienceFixtureRenderer = {
  render(_args) {
    throw new RenderUnavailableError(
      'production renderer not bound — invoke from within the parity-prime pipeline ' +
        '(packages/parity-cli) or pass an explicit renderer in tests',
    );
  },
};

let _productionRendererImpl: AudienceFixtureRenderer = UNBOUND_RENDERER;

/**
 * Bind the production-renderer implementation. Called by the parity-prime
 * pipeline at process start; safe to call repeatedly (last-wins).
 */
export function bindProductionRenderer(renderer: AudienceFixtureRenderer): void {
  _productionRendererImpl = renderer;
}

/**
 * Reset the production-renderer impl to the unbound default. Test-only.
 */
export function __resetProductionRendererForTests(): void {
  _productionRendererImpl = UNBOUND_RENDERER;
}

/**
 * Production renderer surface. Defers every call to whichever
 * {@link AudienceFixtureRenderer} is currently bound — `UNBOUND_RENDERER`
 * until `bindProductionRenderer` swaps in the real impl.
 */
export const productionRenderer: AudienceFixtureRenderer = {
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
  argvEntry === resolve(dirname(moduleEntry), 'generate-audience-clip-parity-fixture.ts')
) {
  main().catch((err) => {
    process.stderr.write(
      `generate-audience-clip-parity-fixture: crashed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    if (err instanceof Error && err.stack) {
      process.stderr.write(`${err.stack}\n`);
    }
    process.exit(2);
  });
}
/* v8 ignore stop */
