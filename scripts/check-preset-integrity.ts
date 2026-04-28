// scripts/check-preset-integrity.ts
// CI gate (CLAUDE.md §3, ADR-004 §D6) for the seven preset-integrity invariants.
// Consumes T-304's loader (`@stageflip/schema/presets/node`) and T-307's
// `parseFontLicenseExpression` to enforce, on every push:
//
//   1. Every preset has valid frontmatter.
//   2. Every preset's `clipKind` exists in the clip registry (script-internal set).
//   3. Every preset referencing a bespoke font has `fallbackFont` populated.
//   4. Every preset with an interactive-family clipKind has non-empty `staticFallback`.
//   5. Every preset in clusters A/B/D/F/G has `signOff.typeDesign` populated.
//   6. Every preset has `signOff.parityFixture` populated (warning until cluster merge).
//   7. Every preset's `source` resolves to a real anchor in the compass file.
//
// Aggregates violations: a single run reports every error across every preset,
// matching the T-304 loader's aggregating posture. Mirrors the script style of
// `check-licenses.ts` and `check-determinism.ts` (per-check progress lines +
// final PASS/FAIL).

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import matter from 'gray-matter';

import { parseFontLicenseExpression } from '../packages/schema/src/presets/font-license.js';
import { PresetRegistryLoadError } from '../packages/schema/src/presets/errors.js';
import {
  loadAllPresets,
  resetLoaderCache,
  type Preset,
} from '../packages/schema/src/presets/loader.js';

// ---------- script-level constants ----------

const PRESETS_ROOT_DEFAULT = 'skills/stageflip/presets';
const COMPASS_PATH_DEFAULT = 'docs/compass.md';

/**
 * The set of valid `clipKind` strings a preset may declare. Per ADR-004 §D6
 * invariant 2, this is the "clip registry" the gate enforces. New clip kinds
 * (or a new interactive-family addition) update this set + INTERACTIVE_CLIP_KINDS.
 *
 * The list is a script-internal contract — if a stub uses a kind outside this
 * set, the gate fails. Per T-308 §D-T308-5 the spec call is "ship hardcoded".
 */
export const VALID_CLIP_KINDS = new Set<string>([
  // Cluster A — news
  'lowerThird',
  'breakingBanner',
  // Cluster B — sports
  'scoreBug',
  'newsTicker',
  'standings',
  // Cluster C — weather
  'weatherMap',
  'stormTracker',
  // Cluster D — titles
  'titleSequence',
  // Cluster E — data
  'bigNumber',
  'fullScreen',
  // Cluster F — captions
  'caption',
  'lyrics',
  // Cluster G — CTAs
  'socialMedia',
  'subscribeButton',
  'followPrompt',
  'qrCodeBounce',
  // Cluster H — AR
  'arOverlay',
  // Interactive family (frontier — clipKind references the family per ADR-005).
  'shader',
  'three-scene',
  'voice',
  'webgl',
  // Generic element kinds — not a preset target today, but reserved.
  'text',
  'image',
  'shape',
  'group',
  'table',
  'blender-clip',
  'interactive-clip',
]);

/**
 * Subset of {@link VALID_CLIP_KINDS} that are "interactive" per ADR-003 D2.
 * Invariant 4 applies only to these. New entries must also live in
 * VALID_CLIP_KINDS.
 */
export const INTERACTIVE_CLIP_KINDS = new Set<string>([
  'shader',
  'three-scene',
  'voice',
  'webgl',
  'interactive-clip',
]);

/**
 * Clusters A/B/D/F/G — per ADR-004 D4, the type-design-consultant batch
 * sign-off applies only to these. Clusters C (weather), E (data), H (AR) are
 * exempt because they don't carry bespoke broadcaster fonts at the cluster level.
 */
const TYPE_DESIGN_REQUIRED_CLUSTERS = new Set<string>([
  'news',
  'sports',
  'titles',
  'captions',
  'ctas',
]);

/**
 * Bespoke license atoms — invariant 3 fires when a preset's preferredFont uses
 * any of these and has no `fallbackFont`. Per T-308 D-T308-3.
 */
const BESPOKE_LICENSE_ATOMS = new Set(['proprietary-byo', 'commercial-byo']);

// ---------- types ----------

export type CheckResult =
  | { ok: true }
  | { ok: false; message: string }
  | { ok: false; severity: 'warning'; message: string };

export interface CompassAnchors {
  filePath: string;
  anchors: Set<string>;
}

interface InvariantBucket {
  errors: Array<{ presetId: string; filePath: string; message: string }>;
  warnings: Array<{ presetId: string; filePath: string; message: string }>;
}

const INVARIANT_KEYS = [
  'frontmatter',
  'clipKind',
  'bespoke-fallback',
  'interactive-staticFallback',
  'typeDesign-signOff',
  'parityFixture-signOff',
  'compass-anchor',
] as const;

type InvariantKey = (typeof INVARIANT_KEYS)[number];

export interface IntegrityReport {
  scannedPresets: number;
  scannedClusters: number;
  byInvariant: Record<InvariantKey, InvariantBucket>;
  compassSkipped: boolean;
  compassPath: string;
  loaderError: string | undefined;
  exitCode: 0 | 1;
}

// ---------- per-invariant checks ----------

/**
 * Invariant 1 — re-validate frontmatter for the file. The loader has already
 * validated; this function is exposed for direct synthetic-test use (AC #1).
 * Returns ok unless the file's frontmatter cannot be parsed at all.
 */
export function checkFrontmatter(args: { filePath: string; raw: string }): CheckResult {
  // Light defensive parse — the heavy lifting is in `loadAllPresets`. Used by
  // tests to drive the synthetic AC #1 case.
  if (!args.raw.startsWith('---')) {
    return { ok: false, message: `${args.filePath}: missing frontmatter delimiter` };
  }
  let parsed: ReturnType<typeof matter>;
  try {
    parsed = matter(args.raw);
  } catch (err) {
    return {
      ok: false,
      message: `${args.filePath}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const data = parsed.data as Record<string, unknown>;
  // Required field smoke-test — exact validation lives in the loader's Zod schema.
  for (const field of [
    'id',
    'cluster',
    'clipKind',
    'source',
    'status',
    'preferredFont',
    'signOff',
  ]) {
    if (data[field] === undefined) {
      return {
        ok: false,
        message: `${args.filePath}: missing required frontmatter field '${field}'`,
      };
    }
  }
  return { ok: true };
}

/** Invariant 2 — clipKind must be in the registry (AC #2). */
export function checkClipKindExists(args: { clipKind: string; presetId: string }): CheckResult {
  if (VALID_CLIP_KINDS.has(args.clipKind)) return { ok: true };
  return {
    ok: false,
    message: `clipKind '${args.clipKind}' not in the registry. Add it to VALID_CLIP_KINDS in scripts/check-preset-integrity.ts if intentional.`,
  };
}

/**
 * Invariant 3 — bespoke-font presets must declare a `fallbackFont` (AC #3, #4).
 * A bespoke font is one whose preferredFont license expression includes
 * `proprietary-byo` or `commercial-byo` per T-308 D-T308-3.
 */
export function checkBespokeFontHasFallback(args: {
  presetId: string;
  preferredFontFamily: string;
  preferredFontLicense: string;
  hasFallback: boolean;
}): CheckResult {
  let isBespoke: boolean;
  try {
    const expr = parseFontLicenseExpression(args.preferredFontLicense);
    isBespoke = expr.atoms.some((atom) => BESPOKE_LICENSE_ATOMS.has(atom));
  } catch {
    // Parser failure surfaces in the font-license CI gate (check-licenses.ts).
    // Skip here so we don't double-report.
    return { ok: true };
  }
  if (!isBespoke) return { ok: true };
  if (args.hasFallback) return { ok: true };
  return {
    ok: false,
    message: `preferredFont '${args.preferredFontFamily}' is ${args.preferredFontLicense} but no fallbackFont declared`,
  };
}

/**
 * Invariant 4 — interactive-family presets must have a non-empty `staticFallback`
 * field in their raw frontmatter (AC #5). Reads raw frontmatter because the
 * Zod loader schema is `.strict()` and doesn't currently include the field.
 */
export function checkInteractiveStaticFallback(args: {
  presetId: string;
  clipKind: string;
  raw: Record<string, unknown>;
}): CheckResult {
  if (!INTERACTIVE_CLIP_KINDS.has(args.clipKind)) return { ok: true };
  const sf = args.raw['staticFallback'];
  if (sf === undefined || sf === null) {
    return {
      ok: false,
      message: `interactive clipKind '${args.clipKind}' requires a non-empty staticFallback (ADR-003 D2)`,
    };
  }
  if (typeof sf === 'string' && sf.trim().length === 0) {
    return {
      ok: false,
      message: `interactive clipKind '${args.clipKind}' has empty staticFallback (ADR-003 D2)`,
    };
  }
  if (Array.isArray(sf) && sf.length === 0) {
    return {
      ok: false,
      message: `interactive clipKind '${args.clipKind}' has empty staticFallback array (ADR-003 D2)`,
    };
  }
  return { ok: true };
}

/**
 * Invariant 5 — clusters A/B/D/F/G must have `signOff.typeDesign` populated
 * (AC #6, #7). The clusters scoping is the most common bug class: invariant 5
 * does NOT apply to weather, data, ar.
 *
 * Refinement (T-308 D-T308-2 follow-up): invariant 5 is conditional on the
 * preset having a typographic identity. Presets whose `preferredFont.license`
 * is the `na` sentinel (text-free presets — e.g., the Coinbase Super Bowl
 * QR-code CTA) are exempt: ADR-004 D4 frames the type-design batch as
 * "broadcaster bespoke-font review," which has no purchase on a font-free
 * preset. The exemption is narrow (license atom 'na' only) and visible in code
 * to keep the spec's intent legible.
 */
export function checkTypeDesignSignOff(args: {
  presetId: string;
  cluster: string;
  typeDesign: string;
  preferredFontLicense: string;
}): CheckResult {
  if (!TYPE_DESIGN_REQUIRED_CLUSTERS.has(args.cluster)) return { ok: true };
  // Text-free preset (license: 'na') — type-design review does not apply.
  if (args.preferredFontLicense === 'na') return { ok: true };
  if (args.typeDesign === 'na') {
    return {
      ok: false,
      message: `cluster '${args.cluster}' requires signOff.typeDesign to be 'pending-cluster-batch' or 'signed:YYYY-MM-DD' (ADR-004 D4); got 'na'`,
    };
  }
  // Loader enforces the regex (pending-cluster-batch | signed:YYYY-MM-DD | na);
  // anything else would have failed schema validation upstream.
  return { ok: true };
}

/**
 * Invariant 6 — `signOff.parityFixture` populated (AC #8). Per T-308
 * D-T308-2: we ship this as a WARNING (not error) at gate time. Cluster-merge
 * enforcement is a separate operational gate.
 */
export function checkParityFixtureSignOff(args: {
  presetId: string;
  parityFixture: string;
}): CheckResult {
  if (args.parityFixture === 'pending-user-review') {
    return {
      ok: false,
      severity: 'warning',
      message: 'parityFixture is pending-user-review (non-blocking pre-cluster-merge)',
    };
  }
  return { ok: true };
}

/**
 * Invariant 7 — preset's `source` resolves to a real anchor in the compass
 * file (AC #9, #10). External https URLs pass without verification. Missing
 * compass file -> invariant 7 globally skipped (handled by caller).
 */
export function checkCompassAnchor(args: {
  presetId: string;
  source: string;
  compass: CompassAnchors | undefined;
}): CheckResult {
  // External URL — no verification at this gate.
  if (/^https?:\/\//i.test(args.source)) return { ok: true };
  // Compass not loaded — caller handles the global skip-with-warning. Treating
  // it as ok at the per-preset level is a defense-in-depth measure.
  if (args.compass === undefined) return { ok: true };

  // Parse out the anchor (after first `#`).
  const hashIdx = args.source.indexOf('#');
  if (hashIdx < 0) {
    return {
      ok: false,
      message: `source '${args.source}' has no anchor; expected '<path>#<anchor>'`,
    };
  }
  const anchor = args.source.slice(hashIdx + 1).toLowerCase();
  if (anchor.length === 0) {
    return { ok: false, message: `source '${args.source}' has empty anchor` };
  }
  if (!args.compass.anchors.has(anchor)) {
    return {
      ok: false,
      message: `source '${args.source}' anchor '#${anchor}' not found in ${args.compass.filePath}`,
    };
  }
  return { ok: true };
}

// ---------- compass loading ----------

/**
 * Read the compass file and extract every Markdown heading slug. Returns
 * undefined when the file is missing — the gate degrades gracefully and skips
 * invariant 7 (T-308 D-T308-4, AC #10).
 */
export function loadCompassAnchors(filePath: string): CompassAnchors | undefined {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
  const anchors = new Set<string>();
  // Accept ATX headings (one to six `#`s followed by a space).
  // Strip leading `#`s + whitespace, lowercase, replace whitespace runs with hyphens,
  // strip non-alphanumeric/hyphen characters, collapse hyphens.
  for (const line of raw.split('\n')) {
    const m = /^#{1,6}\s+(.+?)\s*#*$/.exec(line.trim());
    if (!m || m[1] === undefined) continue;
    const slug = m[1]
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (slug.length > 0) anchors.add(slug);
  }
  return { filePath, anchors };
}

// ---------- aggregation ----------

function emptyBuckets(): Record<InvariantKey, InvariantBucket> {
  const buckets = {} as Record<InvariantKey, InvariantBucket>;
  for (const k of INVARIANT_KEYS) {
    buckets[k] = { errors: [], warnings: [] };
  }
  return buckets;
}

interface RunOpts {
  presetsRoot: string;
  compassPath?: string;
}

/**
 * Run every invariant against every preset under {@link RunOpts.presetsRoot}.
 * Returns a structured report; never throws (loader errors are folded into
 * `loaderError` + the frontmatter bucket).
 */
export function runIntegrityChecks(opts: RunOpts): IntegrityReport {
  const buckets = emptyBuckets();
  const compassPath = opts.compassPath ?? COMPASS_PATH_DEFAULT;
  const compass = loadCompassAnchors(compassPath);

  resetLoaderCache();
  let presets: Preset[] = [];
  let scannedClusters = 0;
  let loaderError: string | undefined;

  try {
    const registry = loadAllPresets(opts.presetsRoot);
    presets = registry.list();
    scannedClusters = registry.clusters().length;
  } catch (err) {
    if (err instanceof PresetRegistryLoadError) {
      loaderError = err.message;
      for (const issue of err.issues) {
        buckets.frontmatter.errors.push({
          presetId: issue.filePath,
          filePath: issue.filePath,
          message: issue.error.message,
        });
      }
    } else {
      loaderError = err instanceof Error ? err.message : String(err);
      buckets.frontmatter.errors.push({
        presetId: opts.presetsRoot,
        filePath: opts.presetsRoot,
        message: loaderError,
      });
    }
  }

  for (const preset of presets) {
    const fm = preset.frontmatter;
    const id = fm.id;
    const filePath = preset.filePath;

    // Invariant 2.
    {
      const r = checkClipKindExists({ clipKind: fm.clipKind, presetId: id });
      if (!r.ok) buckets.clipKind.errors.push({ presetId: id, filePath, message: r.message });
    }

    // Invariant 3.
    {
      const r = checkBespokeFontHasFallback({
        presetId: id,
        preferredFontFamily: fm.preferredFont.family,
        preferredFontLicense: fm.preferredFont.license,
        hasFallback: fm.fallbackFont !== undefined,
      });
      if (!r.ok)
        buckets['bespoke-fallback'].errors.push({ presetId: id, filePath, message: r.message });
    }

    // Invariant 4 — read raw frontmatter (loader strips unknown keys via .strict()
    // schema, so we re-parse to inspect staticFallback if present).
    {
      let raw: Record<string, unknown> = {};
      try {
        const parsed = matter(readFileSync(filePath, 'utf8'));
        raw = (parsed.data as Record<string, unknown>) ?? {};
      } catch {
        // If we can't reread, the loader path would have caught it; safe to skip.
      }
      const r = checkInteractiveStaticFallback({
        presetId: id,
        clipKind: fm.clipKind,
        raw,
      });
      if (!r.ok)
        buckets['interactive-staticFallback'].errors.push({
          presetId: id,
          filePath,
          message: r.message,
        });
    }

    // Invariant 5.
    {
      const r = checkTypeDesignSignOff({
        presetId: id,
        cluster: fm.cluster,
        typeDesign: fm.signOff.typeDesign,
        preferredFontLicense: fm.preferredFont.license,
      });
      if (!r.ok)
        buckets['typeDesign-signOff'].errors.push({ presetId: id, filePath, message: r.message });
    }

    // Invariant 6 (warning).
    {
      const r = checkParityFixtureSignOff({
        presetId: id,
        parityFixture: fm.signOff.parityFixture,
      });
      if (!r.ok) {
        buckets['parityFixture-signOff'].warnings.push({
          presetId: id,
          filePath,
          message: r.message,
        });
      }
    }

    // Invariant 7.
    {
      const r = checkCompassAnchor({ presetId: id, source: fm.source, compass });
      if (!r.ok)
        buckets['compass-anchor'].errors.push({ presetId: id, filePath, message: r.message });
    }
  }

  const hasErrors =
    Object.values(buckets).some((b) => b.errors.length > 0) || loaderError !== undefined;

  return {
    scannedPresets: presets.length,
    scannedClusters,
    byInvariant: buckets,
    compassSkipped: compass === undefined,
    compassPath,
    loaderError,
    exitCode: hasErrors ? 1 : 0,
  };
}

// ---------- CLI entry ----------

function formatPassFail(bucket: InvariantBucket): string {
  if (bucket.errors.length > 0) return `FAIL (${bucket.errors.length} error)`;
  if (bucket.warnings.length > 0) return `WARN (${bucket.warnings.length} pending)`;
  return 'PASS';
}

/**
 * Render a {@link IntegrityReport} into the user-facing stdout/stderr text.
 * Pure function — no I/O — so the formatting logic can be unit-tested.
 */
export function formatReport(report: IntegrityReport): { stdout: string; stderr: string } {
  let stdout = '';
  let stderr = '';

  stdout += `check-preset-integrity: ${report.scannedPresets} presets, ${report.scannedClusters} clusters scanned\n`;

  if (report.compassSkipped) {
    stdout += `check-preset-integrity [compass-anchor]: SKIP (${report.compassPath} not found - invariant 7 disabled per T-308 D-T308-4)\n`;
  }

  for (const key of INVARIANT_KEYS) {
    if (key === 'compass-anchor' && report.compassSkipped) continue;
    stdout += `check-preset-integrity [${key}]: ${formatPassFail(report.byInvariant[key])}\n`;
  }

  for (const key of INVARIANT_KEYS) {
    const bucket = report.byInvariant[key];
    if (bucket.errors.length === 0 && bucket.warnings.length === 0) continue;
    if (bucket.errors.length > 0) {
      stderr += `\ncheck-preset-integrity [${key}]: FAIL\n`;
      for (const e of bucket.errors) {
        stderr += `  - ${e.filePath}: ${e.message}\n`;
      }
    }
    if (bucket.warnings.length > 0) {
      stdout += `\ncheck-preset-integrity [${key}]: WARN\n`;
      for (const w of bucket.warnings) {
        stdout += `  - ${w.filePath}: ${w.message}\n`;
      }
    }
  }

  if (report.exitCode === 0) {
    stdout += '\ncheck-preset-integrity: PASS\n';
  } else {
    const totalErrors = Object.values(report.byInvariant).reduce(
      (acc, b) => acc + b.errors.length,
      0,
    );
    stderr += `\ncheck-preset-integrity: FAIL (${totalErrors} violation${totalErrors === 1 ? '' : 's'})\n`;
  }

  return { stdout, stderr };
}

/* v8 ignore start */
// `main()` + CLI guard run only when the script is invoked as a process. The
// subprocess CLI test (AC #11, #12) exercises the surface; in-process v8
// coverage does NOT record subprocess execution, so these blocks would
// otherwise depress the script's coverage to under 85%.
function main(): void {
  const presetsRoot = PRESETS_ROOT_DEFAULT;
  process.stdout.write(`check-preset-integrity: scanning ${presetsRoot}/...\n`);
  const report = runIntegrityChecks({ presetsRoot });
  const { stdout, stderr } = formatReport(report);
  if (stdout.length > 0) process.stdout.write(stdout);
  if (stderr.length > 0) process.stderr.write(stderr);
  process.exit(report.exitCode);
}

// CLI guard — only run main when invoked directly. Lets tests import the
// module without triggering process.exit. Mirrors backup-restore.ts pattern.
const __thisFile = fileURLToPath(import.meta.url);
const argvEntry = process.argv[1] ? resolve(process.argv[1]) : '';
const moduleEntry = resolve(__thisFile);
if (
  argvEntry === moduleEntry ||
  argvEntry === resolve(dirname(moduleEntry), 'check-preset-integrity.ts')
) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`check-preset-integrity: crashed: ${String(err)}\n`);
    if (err instanceof Error && err.stack) process.stderr.write(`${err.stack}\n`);
    process.exit(2);
  }
}
/* v8 ignore stop */
