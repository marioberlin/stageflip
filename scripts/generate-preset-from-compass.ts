// scripts/generate-preset-from-compass.ts
// T-314 — markdown -> preset frontmatter generator. Reads docs/compass_artifact.md
// (or any caller-supplied compass markdown), locates a section by slug, and
// emits a preset SKILL.md scaffold with a frontmatter block that satisfies
// presetFrontmatterSchema. Tooling-only; no runtime dependency.
//
// CLI:
//   pnpm -w run generate-preset-from-compass \
//     --compass=docs/compass_artifact.md \
//     --section=<heading-slug> \
//     --cluster=<news|sports|...> \
//     --id=<preset-id> \
//     --clip-kind=<kind> \
//     [--out=<path>] \
//     [--source-license=ofl|proprietary-byo|...] \
//     [--preferred-font=<family>] \
//     [--force]
//
// Determinism: scripts/** is OUT of CLAUDE.md section 3 scope.

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

import matter from 'gray-matter';

import {
  PRESET_CLUSTERS,
  type PresetCluster,
  type PresetFrontmatter,
  presetFrontmatterSchema,
} from '../packages/schema/src/presets/frontmatter.js';

// ---------- constants ----------

/** Default compass markdown path - workspace-relative. */
export const COMPASS_PATH_DEFAULT = 'docs/compass_artifact.md';

/** Default presets root - workspace-relative. */
export const PRESETS_ROOT_DEFAULT = 'skills/stageflip/presets';

/**
 * Clusters A/B/D/F/G - per ADR-004 D4 and check-preset-integrity.ts
 * (TYPE_DESIGN_REQUIRED_CLUSTERS). Type-design batch sign-off applies
 * only to these clusters; the rest exempt with signOff.typeDesign='na'.
 */
const TYPE_DESIGN_REQUIRED_CLUSTERS: ReadonlySet<PresetCluster> = new Set([
  'news',
  'sports',
  'titles',
  'captions',
  'ctas',
]);

/** License atoms that MUST pair with a fallbackFont per ADR-004 D4. */
const BESPOKE_LICENSE_ATOMS: ReadonlySet<string> = new Set(['proprietary-byo', 'commercial-byo']);

// ---------- slugification (mirrors loadCompassAnchors in check-preset-integrity.ts) ----------

/**
 * Slugify a Markdown heading using the convention loadCompassAnchors uses:
 * lowercase, whitespace/underscore -> hyphen, strip non-alphanumeric, collapse
 * hyphens, trim leading/trailing hyphens.
 */
export function slugify(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------- compass section parsing ----------

export interface CompassSection {
  /** Heading slug (per slugify). */
  slug: string;
  /** Heading text without leading hash characters. */
  title: string;
  /** Heading level (number of leading hash characters). */
  level: number;
  /** Body text (lines between this heading and the next equal-or-greater-level heading). */
  body: string;
}

/**
 * Parse a compass markdown blob into ordered sections. Each ATX heading
 * starts a section; the section body is every line up to the next heading
 * at an equal or higher level (i.e. equal-or-fewer hash characters).
 * Sub-headings are kept in the body.
 */
export function parseCompassSections(raw: string): CompassSection[] {
  interface Marker {
    line: number;
    title: string;
    level: number;
    slug: string;
  }
  const lines = raw.split('\n');
  const markers: Marker[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const m = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line.trim());
    if (!m || m[1] === undefined || m[2] === undefined) continue;
    const level = m[1].length;
    const title = m[2];
    const slug = slugify(title);
    if (slug.length === 0) continue;
    markers.push({ line: i, title, level, slug });
  }
  const sections: CompassSection[] = [];
  for (let i = 0; i < markers.length; i++) {
    const here = markers[i];
    if (here === undefined) continue;
    let endLine = lines.length;
    for (let j = i + 1; j < markers.length; j++) {
      const next = markers[j];
      if (next === undefined) continue;
      if (next.level <= here.level) {
        endLine = next.line;
        break;
      }
    }
    const bodyLines = lines.slice(here.line + 1, endLine);
    const body = bodyLines.join('\n').trim();
    sections.push({ slug: here.slug, title: here.title, level: here.level, body });
  }
  return sections;
}

// ---------- closest-anchor suggestions (Levenshtein) ----------

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev: number[] = new Array(b.length + 1);
  const curr: number[] = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const del = (prev[j] ?? 0) + 1;
      const ins = (curr[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j] ?? 0;
  }
  return prev[b.length] ?? 0;
}

/** Return up to limit candidates ranked by edit distance to target. */
export function closestAnchors(
  target: string,
  candidates: readonly string[],
  limit = 10,
): string[] {
  return candidates
    .map((c) => ({ c, d: levenshtein(target, c) }))
    .sort((a, b) => a.d - b.d || a.c.localeCompare(b.c))
    .slice(0, limit)
    .map((x) => x.c);
}

// ---------- preset markdown synthesis ----------

export interface BuildPresetArgs {
  id: string;
  cluster: PresetCluster;
  clipKind: string;
  compassPath: string;
  sectionSlug: string;
  title: string;
  bodyText: string;
  preferredFontFamily: string;
  preferredFontLicense: string;
}

/**
 * Build the on-disk markdown for the preset stub: a leading HTML comment with
 * the header line, gray-matter-stringified frontmatter, then a body that opens
 * with the heading title and includes the section's compass text as a seed.
 *
 * Throws FrontmatterValidationError if the frontmatter does not satisfy
 * presetFrontmatterSchema.
 */
export function buildPresetMarkdown(args: BuildPresetArgs): string {
  const fm = buildFrontmatter(args);
  const parsed = presetFrontmatterSchema.safeParse(fm);
  if (!parsed.success) {
    throw new FrontmatterValidationError(parsed.error.issues.map((i) => i.message).join('; '));
  }

  const headerLine = `<!-- skills/stageflip/presets/${args.cluster}/${args.id}.md - Generated from compass section #${args.sectionSlug} via T-314 tooling. -->`;
  const body = [
    headerLine,
    '',
    `# ${args.title}`,
    '',
    '<!-- T-314 stub: replace the seed below with the distilled compass-canon rule set. -->',
    '',
    args.bodyText.length > 0 ? args.bodyText : '_(no compass body extracted)_',
    '',
    '## Visual tokens',
    '',
    '_TODO_',
    '',
    '## Typography',
    '',
    '_TODO_',
    '',
    '## Animation',
    '',
    '_TODO_',
    '',
    '## Rules',
    '',
    '_TODO_',
    '',
    '## Acceptance',
    '',
    '_TODO_',
    '',
    '## References',
    '',
    `- [Compass section](${args.compassPath}#${args.sectionSlug})`,
    '',
  ].join('\n');

  // gray-matter serialises with js-yaml; lineWidth=-1 keeps long values on one line.
  // Frontmatter must lead the file (gray-matter only recognises `---` at line 1
  // when re-parsing); the file-header HTML comment is included as the first
  // line of the body content.
  return matter.stringify(body, fm, { lineWidth: -1 } as never);
}

function buildFrontmatter(args: BuildPresetArgs): PresetFrontmatter {
  const license = args.preferredFontLicense;
  const isBespoke = BESPOKE_LICENSE_ATOMS.has(license);
  const requiresTypeDesign = TYPE_DESIGN_REQUIRED_CLUSTERS.has(args.cluster);

  const fm: PresetFrontmatter = {
    id: args.id,
    cluster: args.cluster,
    clipKind: args.clipKind,
    source: `${args.compassPath}#${args.sectionSlug}`,
    status: 'stub',
    preferredFont: {
      family: args.preferredFontFamily,
      license,
    },
    permissions: [],
    signOff: {
      parityFixture: 'pending-user-review',
      typeDesign: requiresTypeDesign ? 'pending-cluster-batch' : 'na',
    },
  };

  if (isBespoke) {
    fm.fallbackFont = { family: 'Inter', weight: 600, license: 'ofl' };
  }

  return fm;
}

/** Thrown when generated frontmatter fails Zod validation. */
export class FrontmatterValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FrontmatterValidationError';
  }
}

// ---------- I/O helpers ----------

/**
 * Atomic-ish file write: write to a sibling temp file, fsync, rename over the
 * destination. On rename failure the temp file is unlinked and the error
 * re-thrown - original (if any) is left intact. Mirrors
 * scripts/generate-audience-clip-parity-fixture.ts.
 */
export function writeFileAtomic(filePath: string, contents: string): void {
  // determinism-safe: scripts/** is outside the determinism-gated scope; the
  //   temp suffix is operator-facing.
  const tempPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  let fd: number | undefined;
  try {
    fd = openSync(tempPath, 'w');
    writeSync(fd, contents);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(tempPath, filePath);
  } catch (err) {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // ignore
      }
    }
    try {
      unlinkSync(tempPath);
    } catch {
      // ignore - temp may not exist.
    }
    throw err;
  }
}

// ---------- CLI plumbing ----------

export interface CliArgs {
  compass: string;
  section: string | undefined;
  cluster: PresetCluster | undefined;
  id: string | undefined;
  clipKind: string | undefined;
  out: string | undefined;
  sourceLicense: string;
  preferredFont: string;
  force: boolean;
  help: boolean;
}

const DEFAULT_CLI_ARGS: CliArgs = {
  compass: COMPASS_PATH_DEFAULT,
  section: undefined,
  cluster: undefined,
  id: undefined,
  clipKind: undefined,
  out: undefined,
  sourceLicense: 'ofl',
  preferredFont: 'Inter',
  force: false,
  help: false,
};

/**
 * Parse argv. Pure - never reads env, never throws. Unknown flags emit a soft
 * error in the returned errors array.
 */
export function parseArgs(argv: readonly string[]): { args: CliArgs; errors: string[] } {
  const args: CliArgs = { ...DEFAULT_CLI_ARGS };
  const errors: string[] = [];

  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      args.help = true;
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
      case 'compass':
        args.compass = value;
        break;
      case 'section':
        args.section = value;
        break;
      case 'cluster': {
        if ((PRESET_CLUSTERS as readonly string[]).includes(value)) {
          args.cluster = value as PresetCluster;
        } else {
          errors.push(`--cluster must be one of ${PRESET_CLUSTERS.join('|')} (got '${value}')`);
        }
        break;
      }
      case 'id':
        args.id = value;
        break;
      case 'clip-kind':
        args.clipKind = value;
        break;
      case 'out':
        args.out = value;
        break;
      case 'source-license':
        args.sourceLicense = value;
        break;
      case 'preferred-font':
        args.preferredFont = value;
        break;
      default:
        errors.push(`unknown flag '--${key}'`);
    }
  }

  return { args, errors };
}

export function usage(): string {
  return [
    'Usage: pnpm -w run generate-preset-from-compass \\',
    '         --compass=<path>          (default: docs/compass_artifact.md)',
    '         --section=<slug>          (required - heading slug from the compass)',
    `         --cluster=<name>          (required - one of: ${PRESET_CLUSTERS.join('|')})`,
    '         --id=<preset-id>          (required - lowercase kebab slug)',
    '         --clip-kind=<kind>        (required - registered clip kind)',
    '         [--out=<path>]            (default: skills/stageflip/presets/<cluster>/<id>.md)',
    '         [--source-license=<atom>] (default: ofl)',
    '         [--preferred-font=<fam>]  (default: Inter)',
    '         [--force]                 (overwrite existing target)',
  ].join('\n');
}

export interface RunResult {
  exitCode: 0 | 1 | 2;
  stdout: string[];
  stderr: string[];
  /** Files written / mutated (absolute paths). */
  written: string[];
}

/**
 * Pure orchestration: parse -> read compass -> locate section -> build
 * markdown -> atomic write. Errors return non-zero + stderr; never throws on
 * a known-error path.
 */
export async function runGenerate(argv: readonly string[]): Promise<RunResult> {
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

  // Required-arg checks.
  const missing: string[] = [];
  if (args.section === undefined) missing.push('--section');
  if (args.cluster === undefined) missing.push('--cluster');
  if (args.id === undefined) missing.push('--id');
  if (args.clipKind === undefined) missing.push('--clip-kind');
  if (missing.length > 0) {
    stderr.push(`missing required flag(s): ${missing.join(', ')}`);
    stderr.push(usage());
    return { exitCode: 2, stdout, stderr, written };
  }

  // Read compass.
  let raw: string;
  try {
    raw = readFileSync(args.compass, 'utf8');
  } catch {
    stderr.push(`compass file not found: ${args.compass}`);
    return { exitCode: 1, stdout, stderr, written };
  }

  const sections = parseCompassSections(raw);
  // Type-narrowed locals (TS otherwise can't see post-`missing` non-undefined).
  const sectionSlug = args.section as string;
  const cluster = args.cluster as PresetCluster;
  const id = args.id as string;
  const clipKind = args.clipKind as string;

  const found = sections.find((s) => s.slug === sectionSlug);
  if (found === undefined) {
    stderr.push(`compass section '${sectionSlug}' not found in ${args.compass}`);
    const all = sections.map((s) => s.slug);
    const suggestions = closestAnchors(sectionSlug, all, 10);
    if (suggestions.length > 0) {
      stderr.push('did you mean one of:');
      for (const s of suggestions) stderr.push(`  - ${s}`);
    }
    return { exitCode: 1, stdout, stderr, written };
  }

  // Compute target path.
  const out = args.out ?? `${PRESETS_ROOT_DEFAULT}/${cluster}/${id}.md`;
  const outAbs = resolve(out);

  if (existsSync(outAbs) && !args.force) {
    stderr.push(`file exists: ${outAbs} (pass --force to overwrite)`);
    return { exitCode: 1, stdout, stderr, written };
  }

  // Build the markdown - frontmatter validation happens inside.
  let markdown: string;
  try {
    markdown = buildPresetMarkdown({
      id,
      cluster,
      clipKind,
      compassPath: args.compass,
      sectionSlug,
      title: found.title,
      bodyText: found.body,
      preferredFontFamily: args.preferredFont,
      preferredFontLicense: args.sourceLicense,
    });
  } catch (err) {
    if (err instanceof FrontmatterValidationError) {
      stderr.push(`frontmatter validation failed: ${err.message}`);
      return { exitCode: 1, stdout, stderr, written };
    }
    stderr.push(err instanceof Error ? err.message : String(err));
    return { exitCode: 1, stdout, stderr, written };
  }

  mkdirSync(dirname(outAbs), { recursive: true });

  try {
    writeFileAtomic(outAbs, markdown);
  } catch (err) {
    stderr.push(`write failed: ${err instanceof Error ? err.message : String(err)}`);
    return { exitCode: 1, stdout, stderr, written };
  }
  written.push(outAbs);
  stdout.push(`wrote ${outAbs}`);

  return { exitCode: 0, stdout, stderr, written };
}

/* v8 ignore start */
function main(): Promise<void> {
  const argv = process.argv.slice(2);
  return runGenerate(argv).then((result) => {
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
  argvEntry === resolve(dirname(moduleEntry), 'generate-preset-from-compass.ts')
) {
  main().catch((err) => {
    process.stderr.write(
      `generate-preset-from-compass: crashed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    if (err instanceof Error && err.stack) {
      process.stderr.write(`${err.stack}\n`);
    }
    process.exit(2);
  });
}
/* v8 ignore stop */
