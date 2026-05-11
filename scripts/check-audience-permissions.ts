// scripts/check-audience-permissions.ts
// CI gate (T-455, ADR-005 §D2, ADR-009 §D13, ADR-010 §D6): every Live
// Audience clip module under `packages/runtimes/audience/src/clips/**`
// must declare a co-located `MANIFEST: AudienceClipManifest` export whose
// `permissions` array literal is exactly `['audience-network']`.
//
// **Inaugural state**: no concrete audience clips exist on `main` until
// T-461..T-471 land. The discovery step yields zero candidates; the
// gate exits 0 with the message "0 audience clips registered;
// audience-network whitelist not yet exercised" — mirrors
// `check-asset-licenses.ts` (T-422) inaugural posture.
//
// **Static, source-only scan**: this gate scans the on-disk TypeScript
// source for the `MANIFEST` export. It does NOT dynamic-import the clip
// module (no transpile-on-the-fly, no side-effects, no determinism
// perimeter concerns). Mirrors `check-asset-licenses` in spirit but is
// simpler — the manifest is a typed literal, not a Zod-validated object.
//
// **Failure modes** (per docs/tasks/T-455.md §6 acceptance criteria):
//   1. `MISSING-MANIFEST` — clip directory has neither `manifest.ts`
//      nor `index.ts`, or neither contains a `MANIFEST` export.
//   2. `MISSING-PERMISSIONS-KEY` — `MANIFEST` export found but its
//      object literal has no `permissions` key.
//   3. `WRONG-PERMISSIONS` — `permissions` literal is present but is
//      not strict-equal to `['audience-network']`.
//   4. `EXTRA-PERMISSIONS` — `permissions` literal contains
//      `'audience-network'` plus one or more additional entries.
//   5. `NON-LITERAL` — `permissions` is a non-literal expression
//      (function call, identifier reference, spread); static check
//      cannot verify the value, so reject conservatively.
//
// Determinism: pure script. Output is a deterministic function of the
// workspace state (sorted directory walk + regex match). No `Date.now()`,
// `Math.random()`, `fetch()`. CLAUDE.md §3 determinism rules scope to
// clip/runtime code; gates at scripts/ are out of scope (same posture as
// `check-licenses.ts` / `check-asset-licenses.ts`).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Verdict + report shapes
// ---------------------------------------------------------------------------

/**
 * Per-clip classification verdict produced by `classifyClip`.
 */
export type AudiencePermissionVerdict =
  | 'allowed'
  | 'missing-manifest'
  | 'missing-permissions-key'
  | 'wrong-permissions'
  | 'extra-permissions'
  | 'non-literal';

/**
 * Per-clip failure detail. The `clipKind` is the directory basename
 * (which by convention matches the `AudienceClipKind` discriminant for
 * audience clips); the source path is the discovered `manifest.ts` /
 * `index.ts` path, undefined when the directory has neither file.
 */
export interface ClipFailure {
  readonly clipKind: string;
  readonly verdict: Exclude<AudiencePermissionVerdict, 'allowed'>;
  readonly source: string | undefined;
  readonly detail: string;
}

/**
 * Pure summary returned by `runCheck`. The CLI entry consumes this and
 * formats it via `formatReport`.
 */
export interface CheckResult {
  readonly clipsInspected: number;
  readonly failures: ReadonlyArray<ClipFailure>;
  readonly exitCode: 0 | 1;
}

// ---------------------------------------------------------------------------
// Manifest discovery + parsing (source-only)
// ---------------------------------------------------------------------------

/**
 * Discover the immediate subdirectories of `clipsDir` (sorted), each of
 * which is presumed to hold one audience clip module. Returns an empty
 * list if `clipsDir` does not exist (inaugural state).
 */
export function discoverClipDirs(clipsDir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(clipsDir);
  } catch {
    return [];
  }
  entries.sort();
  const out: string[] = [];
  for (const entry of entries) {
    // Skip dotfiles (e.g. the inaugural-state `.gitkeep` marker).
    if (entry.startsWith('.')) continue;
    const dir = join(clipsDir, entry);
    let isDir: boolean;
    try {
      isDir = statSync(dir).isDirectory();
    } catch {
      continue;
    }
    if (!isDir) continue;
    out.push(dir);
  }
  return out;
}

/**
 * Resolve a clip directory to its manifest source file. Prefers
 * `manifest.ts` (the convention documented in ADR-005 §D2 / ADR-010 §D6),
 * falls back to `index.ts`. Returns undefined when neither exists.
 */
export function resolveManifestSource(clipDir: string): string | undefined {
  const manifestPath = join(clipDir, 'manifest.ts');
  try {
    if (statSync(manifestPath).isFile()) return manifestPath;
  } catch {
    // fall through
  }
  const indexPath = join(clipDir, 'index.ts');
  try {
    if (statSync(indexPath).isFile()) return indexPath;
  } catch {
    // fall through
  }
  return undefined;
}

/**
 * Regex that locates the `MANIFEST` export with the `AudienceClipManifest`
 * type annotation and captures the opening brace position. Tolerant of
 * leading whitespace + optional type annotation; the body capture stops
 * at the matching brace via a manual scan in `extractManifestBody`
 * (regex alone cannot count nested braces reliably in TypeScript
 * literals containing nested objects).
 */
const MANIFEST_HEADER_RE = /export\s+const\s+MANIFEST\s*(?::\s*AudienceClipManifest\s*)?=\s*\{/m;

/**
 * Find the `MANIFEST` object-literal body in the given source. Returns
 * the substring between the opening `{` and the matching `}`, or
 * undefined when the export is absent / not assigned a brace-literal.
 *
 * Brace counting handles strings naively; this is acceptable for the
 * manifest convention which only contains a `kind` string + a
 * `permissions` array. If a future manifest shape adds nested literals
 * with string-embedded braces, switch to an AST walk.
 */
export function extractManifestBody(source: string): string | undefined {
  const match = source.match(MANIFEST_HEADER_RE);
  if (!match || match.index === undefined) return undefined;
  const openIdx = match.index + match[0].length - 1; // index of `{`
  let depth = 0;
  let inString: '"' | "'" | '`' | undefined;
  let escape = false;
  for (let i = openIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (inString !== undefined) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === inString) {
        inString = undefined;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openIdx + 1, i);
      }
    }
  }
  return undefined;
}

/**
 * Regex matching a literal `permissions:` key with a bracket-array
 * literal RHS. Captures the array contents (between the brackets).
 * Reject non-literal RHS (function call, identifier reference) by
 * returning undefined from `extractPermissions`.
 */
const PERMISSIONS_LITERAL_RE = /permissions\s*:\s*\[([^\]]*)\]/;

/**
 * Regex detecting *any* `permissions:` key, regardless of the RHS shape.
 * Used to distinguish MISSING-PERMISSIONS-KEY (no match) from
 * NON-LITERAL (key present, RHS not a `[...]` literal).
 */
const PERMISSIONS_ANY_RE = /permissions\s*:/;

/**
 * Extract the `permissions` array literal from a manifest body. Returns:
 *   - `{ kind: 'literal', entries: [...] }` — RHS was `[...]`; entries
 *     are the parsed string-literal entries (in source order).
 *   - `{ kind: 'non-literal' }` — `permissions:` key present but RHS is
 *     not a bracket-literal (computed, function-call, identifier).
 *   - `{ kind: 'missing' }` — no `permissions:` key at all.
 */
export type PermissionsExtraction =
  | { readonly kind: 'literal'; readonly entries: ReadonlyArray<string> }
  | { readonly kind: 'non-literal' }
  | { readonly kind: 'missing' };

export function extractPermissions(body: string): PermissionsExtraction {
  const literalMatch = body.match(PERMISSIONS_LITERAL_RE);
  if (literalMatch) {
    const inner = literalMatch[1] ?? '';
    const entries = parseStringTuple(inner);
    if (entries === undefined) return { kind: 'non-literal' };
    return { kind: 'literal', entries };
  }
  if (PERMISSIONS_ANY_RE.test(body)) {
    return { kind: 'non-literal' };
  }
  return { kind: 'missing' };
}

/**
 * Parse the inside of a bracket array into a list of string-literal
 * entries. Accepts both single- and double-quoted strings (the bracket
 * regex already stripped the brackets). Returns undefined if any entry
 * is not a plain string literal (e.g., an identifier reference, a
 * spread, a template literal with substitution).
 *
 * Whitespace + trailing commas are tolerated; empty input → `[]`.
 */
export function parseStringTuple(inner: string): string[] | undefined {
  const trimmed = inner.trim();
  if (trimmed.length === 0) return [];
  // Split on commas at depth 0 (no nested brackets/parens inside string
  // literals because we forbid those — the regex would not have matched).
  const parts: string[] = [];
  let current = '';
  let inString: '"' | "'" | undefined;
  let escape = false;
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (inString !== undefined) {
      current += ch;
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === inString) inString = undefined;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      current += ch;
      continue;
    }
    if (ch === ',') {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim().length > 0) parts.push(current);

  const out: string[] = [];
  for (const raw of parts) {
    const token = raw.trim();
    if (token.length === 0) continue;
    const m = token.match(/^(['"])(.*)\1$/);
    if (!m) return undefined;
    out.push(m[2] ?? '');
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-clip classification
// ---------------------------------------------------------------------------

/**
 * Classify a single clip directory. Pure function — takes the clip
 * directory + the resolved manifest-source contents and returns a
 * verdict. Tested directly by `check-audience-permissions.test.ts`.
 */
export function classifyClip(args: {
  readonly clipKind: string;
  readonly sourcePath: string | undefined;
  readonly source: string | undefined;
}): ClipFailure | undefined {
  if (args.sourcePath === undefined || args.source === undefined) {
    return {
      clipKind: args.clipKind,
      verdict: 'missing-manifest',
      source: undefined,
      detail:
        'no `manifest.ts` or `index.ts` in clip directory (T-455 requires a co-located MANIFEST export)',
    };
  }
  const body = extractManifestBody(args.source);
  if (body === undefined) {
    return {
      clipKind: args.clipKind,
      verdict: 'missing-manifest',
      source: args.sourcePath,
      detail: '`export const MANIFEST = { ... }` not found in source',
    };
  }
  const perms = extractPermissions(body);
  if (perms.kind === 'missing') {
    return {
      clipKind: args.clipKind,
      verdict: 'missing-permissions-key',
      source: args.sourcePath,
      detail: 'MANIFEST object literal has no `permissions:` key',
    };
  }
  if (perms.kind === 'non-literal') {
    return {
      clipKind: args.clipKind,
      verdict: 'non-literal',
      source: args.sourcePath,
      detail:
        '`permissions:` value is not a `[...]` literal; static gate cannot verify (use a literal array of string literals)',
    };
  }
  const entries = perms.entries;
  if (entries.length === 1 && entries[0] === 'audience-network') {
    return undefined; // allowed
  }
  if (entries.includes('audience-network') && entries.length > 1) {
    return {
      clipKind: args.clipKind,
      verdict: 'extra-permissions',
      source: args.sourcePath,
      detail: `permissions: [${entries.map((e) => `'${e}'`).join(', ')}] — additional permissions defeat the audience-network scope (ADR-009 §D13)`,
    };
  }
  return {
    clipKind: args.clipKind,
    verdict: 'wrong-permissions',
    source: args.sourcePath,
    detail: `permissions: [${entries.map((e) => `'${e}'`).join(', ')}] — expected exactly ['audience-network']`,
  };
}

// ---------------------------------------------------------------------------
// runCheck — top-level pure entry (tests inject `clipsDir`)
// ---------------------------------------------------------------------------

/**
 * Walk `opts.clipsDir`, classify each immediate subdirectory, and
 * return a structured report. Pure function — no `process.exit`, no
 * stdout. The CLI entry below calls this then formats + writes output.
 */
export function runCheck(opts: { readonly clipsDir: string }): CheckResult {
  const clipDirs = discoverClipDirs(opts.clipsDir);
  const failures: ClipFailure[] = [];

  for (const clipDir of clipDirs) {
    const clipKind = clipDir.split(/[\\/]/).pop() ?? clipDir;
    const sourcePath = resolveManifestSource(clipDir);
    let source: string | undefined;
    if (sourcePath !== undefined) {
      try {
        source = readFileSync(sourcePath, 'utf8');
      } catch {
        source = undefined;
      }
    }
    const failure = classifyClip({ clipKind, sourcePath, source });
    if (failure !== undefined) failures.push(failure);
  }

  return {
    clipsInspected: clipDirs.length,
    failures,
    exitCode: failures.length === 0 ? 0 : 1,
  };
}

// ---------------------------------------------------------------------------
// formatReport — stdout / stderr surface
// ---------------------------------------------------------------------------

/**
 * Render a `CheckResult` to a human-readable string. PASS / FAIL footer
 * mirrors `check-asset-licenses` for operator parity.
 */
export function formatReport(report: CheckResult): string {
  const lines: string[] = [];
  if (report.clipsInspected === 0) {
    lines.push(
      'check-audience-permissions: 0 audience clips registered; audience-network whitelist not yet exercised',
    );
  } else {
    const noun = report.clipsInspected === 1 ? 'clip' : 'clips';
    lines.push(`check-audience-permissions: ${report.clipsInspected} audience ${noun} inspected`);
  }

  if (report.failures.length > 0) {
    lines.push('');
    lines.push(`  FAILURES (${report.failures.length}):`);
    for (const failure of report.failures) {
      const src = failure.source ?? '(no source)';
      lines.push(`    ${failure.clipKind}  [${failure.verdict}]  ${src}`);
      lines.push(`      ${failure.detail}`);
    }
  }

  lines.push('');
  lines.push(`check-audience-permissions: ${report.exitCode === 0 ? 'PASS' : 'FAIL'}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// scripts/ is at repo root.
const REPO_ROOT = resolve(__dirname, '..');
const CLIPS_DIR_DEFAULT = resolve(REPO_ROOT, 'packages', 'runtimes', 'audience', 'src', 'clips');

/**
 * CLI entry. Resolves the default `clipsDir` from the workspace root,
 * runs the check, prints the report, and returns the exit code. The
 * top-level `if (import.meta.url === ...)` guard wires this to
 * `process.exit` only when the script is invoked directly (not when
 * imported by the test suite).
 */
export function main(clipsDir: string = CLIPS_DIR_DEFAULT): number {
  const report = runCheck({ clipsDir });
  const out = formatReport(report);
  if (report.exitCode === 0) {
    process.stdout.write(`${out}\n`);
  } else {
    process.stderr.write(`${out}\n`);
  }
  return report.exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const code = main();
    process.exit(code);
  } catch (err) {
    process.stderr.write(
      `check-audience-permissions: crashed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(2);
  }
}
