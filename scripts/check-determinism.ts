// scripts/check-determinism.ts
// CI gate for invariant I-2 (CLAUDE.md §3, skills/stageflip/concepts/determinism/SKILL.md).
// Scans every `.ts`/`.tsx` file under the deterministic paths for forbidden
// non-deterministic API usage. The runtime shim (T-027,
// @stageflip/determinism) is the runtime safety net; this gate is the
// source-lint first line of defense.
//
// Implementation note: docs/implementation-plan.md T-028 and ADR-002 §D5
// described this gate as "a narrow custom ESLint plugin". We opted for the
// TypeScript compiler API instead: no new tool category, no new CI dep, and
// rule logic lives next to our other check-* scripts. ADR-002 will be amended
// via a small revision note when we next touch it.
//
// T-309 layered a SHADER SUB-RULE on top: per ADR-003 §D5 + ADR-005 §D2,
// uniform-updater functions inside the otherwise-exempt interactive tier
// must accept `frame` only and must not read `Date.now`, `performance.now`,
// `Math.random`, `setTimeout`/`setInterval`, or
// `requestAnimationFrame`/`cancelAnimationFrame`. The sub-rule fires for
// path-matched files (shader / three-scene clip directories) AND for any
// function tagged with the `@uniformUpdater` JSDoc decorator anywhere in the
// repo.

import { readFileSync, readdirSync } from 'node:fs';
import { glob, readFile as readFilePromise } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

/**
 * Paths that must not use non-deterministic APIs. See CLAUDE.md §3. The
 * determinism shim package itself is excluded because it IS the tool that
 * replaces these APIs at runtime — its code necessarily references them.
 *
 * `packages/runtimes/*\/src/clips/**` covers every runtime tier's clip code
 * EXCEPT the interactive runtime tier — see `EXCLUDED_PREFIXES` below.
 */
const DETERMINISTIC_GLOBS = [
  'packages/frame-runtime/src/**/*.{ts,tsx}',
  'packages/runtimes/*/src/clips/**/*.{ts,tsx}',
  'packages/renderer-core/src/clips/**/*.{ts,tsx}',
];

/**
 * Path prefixes excluded from the BROAD determinism walk per ADR-003 §D5 +
 * T-306 D-T306-5. The interactive runtime tier is explicitly OUT of scope
 * for the broad rule: clips mounted via this tier may use `Date.now`,
 * `performance.now`, `fetch`, `requestAnimationFrame`, `setTimeout`, etc.
 * The tier's contract requires a deterministic `staticFallback` for
 * parity-safe export targets, so the MP4 / PPTX / display invariants (I-2)
 * hold via that path.
 *
 * T-309's SHADER SUB-RULE narrows this exemption: see {@link scanShaderSubRule}.
 */
const EXCLUDED_PREFIXES = ['packages/runtimes/interactive/'];

/**
 * Path prefixes that opt files INTO the shader sub-rule (D-T309-3, D-T309-1).
 * Inside these prefixes, every top-level function-like declaration is
 * inspected against {@link SHADER_FORBIDDEN_APIS}, regardless of whether it
 * carries the `@uniformUpdater` JSDoc tag.
 */
const SHADER_SUB_RULE_PATH_PREFIXES = [
  'packages/runtimes/interactive/src/clips/shader/',
  'packages/runtimes/interactive/src/clips/three-scene/',
];

/**
 * Escape-hatch comment. A source line prefixed by an inline or preceding
 * comment containing this token is exempted from the check. Callers should
 * link an ADR or rationale in the comment body.
 */
const ESCAPE_HATCH = 'determinism-safe';

/**
 * The shader sub-rule's forbidden-API set per ADR-003 §D5 + D-T309-2.
 * Surfaced as a stable public string-array for tests (AC #7).
 */
export const SHADER_FORBIDDEN_APIS = [
  'Date.now',
  'new Date()',
  'performance.now',
  'Math.random',
  'setTimeout/setInterval',
  'requestAnimationFrame/cancelAnimationFrame',
] as const;

/**
 * The JSDoc tag (without `@`) that opts a function INTO the shader sub-rule
 * regardless of its file path.
 */
const UNIFORM_UPDATER_TAG = 'uniformUpdater';

export interface Violation {
  file: string;
  line: number;
  column: number;
  api: string;
  source: string;
}

/**
 * Per-violation diagnostic emitted by {@link scanShaderSubRule}. Tests pin the
 * shape (AC #9). The `functionName` field is the static name of the enclosing
 * uniform-updater (helps reviewers find the offender quickly).
 */
export interface ShaderViolation {
  file: string;
  line: number;
  column: number;
  api: string;
  hint: string;
  functionName: string;
}

/** Rules: each matches a node shape and returns an API name. */
interface Rule {
  name: string;
  match(node: ts.Node): string | null;
}

const RULES: Rule[] = [
  {
    name: 'Date.now / Date.parse variants of concern',
    match(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const { expression, name } = node.expression;
        if (ts.isIdentifier(expression) && expression.text === 'Date') {
          if (name.text === 'now') return 'Date.now()';
        }
      }
      return null;
    },
  },
  {
    name: 'new Date() with no args',
    match(node) {
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'Date' &&
        (!node.arguments || node.arguments.length === 0)
      ) {
        return 'new Date()';
      }
      return null;
    },
  },
  {
    name: 'performance.now()',
    match(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const { expression, name } = node.expression;
        if (
          ts.isIdentifier(expression) &&
          expression.text === 'performance' &&
          name.text === 'now'
        ) {
          return 'performance.now()';
        }
      }
      return null;
    },
  },
  {
    name: 'Math.random()',
    match(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const { expression, name } = node.expression;
        if (ts.isIdentifier(expression) && expression.text === 'Math' && name.text === 'random') {
          return 'Math.random()';
        }
      }
      return null;
    },
  },
  {
    name: 'fetch / XHR / sendBeacon',
    match(node) {
      if (ts.isCallExpression(node)) {
        if (ts.isIdentifier(node.expression) && node.expression.text === 'fetch') return 'fetch()';
        if (ts.isPropertyAccessExpression(node.expression)) {
          const { expression, name } = node.expression;
          if (
            ts.isIdentifier(expression) &&
            expression.text === 'navigator' &&
            name.text === 'sendBeacon'
          ) {
            return 'navigator.sendBeacon()';
          }
        }
      }
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'XMLHttpRequest'
      ) {
        return 'new XMLHttpRequest()';
      }
      return null;
    },
  },
  {
    name: 'requestAnimationFrame / cancelAnimationFrame',
    match(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const t = node.expression.text;
        if (t === 'requestAnimationFrame') return 'requestAnimationFrame()';
        if (t === 'cancelAnimationFrame') return 'cancelAnimationFrame()';
      }
      return null;
    },
  },
  {
    name: 'setTimeout / setInterval',
    match(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const t = node.expression.text;
        if (t === 'setTimeout') return 'setTimeout()';
        if (t === 'setInterval') return 'setInterval()';
      }
      return null;
    },
  },
  {
    name: 'Worker / SharedWorker construction',
    match(node) {
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
        const t = node.expression.text;
        if (t === 'Worker') return 'new Worker()';
        if (t === 'SharedWorker') return 'new SharedWorker()';
      }
      return null;
    },
  },
];

/**
 * Subset of {@link RULES} that fires inside a uniform-updater body. Same set
 * minus `fetch / XHR` (per D-T309-2 — fetch isn't in the shader sub-rule's
 * forbidden set; the broad rule still catches it elsewhere) minus
 * `Worker/SharedWorker` (same reasoning).
 */
const SHADER_SUB_RULE_RULES: Rule[] = RULES.filter(
  (r) => r.name !== 'fetch / XHR / sendBeacon' && r.name !== 'Worker / SharedWorker construction',
);

/** True if a source line should be exempt because of a nearby escape-hatch comment. */
function isExempt(lineText: string, prevLineText: string): boolean {
  return lineText.includes(ESCAPE_HATCH) || prevLineText.includes(ESCAPE_HATCH);
}

/**
 * Scan a single file for broad-rule (§3) violations. Exported for tests.
 * Returns violations sorted by source order.
 */
export async function scanFile(absPath: string): Promise<Violation[]> {
  const raw = await readFilePromise(absPath, 'utf8');
  const source = ts.createSourceFile(basename(absPath), raw, ts.ScriptTarget.Latest, true);
  const lines = raw.split('\n');
  const found: Violation[] = [];

  const visit = (node: ts.Node): void => {
    for (const rule of RULES) {
      const api = rule.match(node);
      if (!api) continue;
      const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
      const lineText = lines[line] ?? '';
      const prevLineText = line > 0 ? (lines[line - 1] ?? '') : '';
      if (isExempt(lineText, prevLineText)) continue;
      found.push({
        file: absPath,
        line: line + 1,
        column: character + 1,
        api,
        source: lineText.trim(),
      });
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return found;
}

async function collectFiles(): Promise<string[]> {
  const out: string[] = [];
  for (const pattern of DETERMINISTIC_GLOBS) {
    for await (const match of glob(pattern)) {
      if (match.endsWith('.test.ts') || match.endsWith('.test.tsx')) continue;
      // ADR-003 §D5: interactive runtime tier is exempt from the broad rule.
      const normalized = match.replace(/\\/g, '/');
      if (EXCLUDED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) continue;
      out.push(resolve(match));
    }
  }
  return out.sort();
}

// ---------- shader sub-rule (T-309) ----------

/**
 * A function-like AST node tagged as a uniform-updater (path-matched OR
 * decorator-tagged). The pair of `node` + `sourceFile` is what the inspector
 * needs.
 */
interface UniformUpdater {
  node: ts.FunctionLikeDeclaration;
  name: string;
  pathMatched: boolean;
  decoratorTagged: boolean;
}

/**
 * Walk a single source file collecting every uniform-updater. Path-matched
 * files contribute every top-level exported function-like declaration;
 * decorator-tagged functions contribute regardless of file path.
 */
function collectUniformUpdaters(args: {
  sourceFile: ts.SourceFile;
  pathMatched: boolean;
}): UniformUpdater[] {
  const out: UniformUpdater[] = [];
  const { sourceFile, pathMatched } = args;

  const visit = (node: ts.Node): void => {
    let name = '<anonymous>';
    let isFunctionLike = false;
    let funcNode: ts.FunctionLikeDeclaration | undefined;

    if (ts.isFunctionDeclaration(node)) {
      isFunctionLike = true;
      funcNode = node;
      name = node.name?.text ?? name;
    } else if (ts.isVariableStatement(node)) {
      // `export const uFrame = (frame) => ...` form.
      for (const decl of node.declarationList.declarations) {
        if (
          decl.initializer &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
        ) {
          const declName = ts.isIdentifier(decl.name) ? decl.name.text : '<anonymous>';
          // JSDoc is attached to the variable statement.
          const tagged = hasUniformUpdaterTag(node);
          if (pathMatched || tagged) {
            out.push({
              node: decl.initializer as ts.FunctionLikeDeclaration,
              name: declName,
              pathMatched,
              decoratorTagged: tagged,
            });
          }
        }
      }
    }

    if (isFunctionLike && funcNode) {
      const tagged = hasUniformUpdaterTag(node);
      if (pathMatched || tagged) {
        out.push({
          node: funcNode,
          name,
          pathMatched,
          decoratorTagged: tagged,
        });
      }
    }

    // No recursion into function bodies — top-level exports only per
    // D-T309-3. (Nested functions inside a uniform-updater inherit their
    // parent's body inspection.)
    if (!isFunctionLike && !ts.isVariableStatement(node)) {
      ts.forEachChild(node, visit);
    }
  };

  visit(sourceFile);
  return out;
}

/**
 * True iff the node carries a `@uniformUpdater` JSDoc tag. Uses TypeScript's
 * structured JSDoc parse rather than a regex on the raw text to avoid the
 * `/** @uniformUpdater @deprecated * /` edge case (T-309 escalation list).
 */
function hasUniformUpdaterTag(node: ts.Node): boolean {
  const tags = ts.getJSDocTags(node);
  for (const tag of tags) {
    if (tag.tagName.text === UNIFORM_UPDATER_TAG) return true;
  }
  return false;
}

/**
 * Inspect a uniform-updater's signature + body. Emits violations for:
 * - Missing `frame` parameter (D-T309-2; AC #5/#6).
 * - Calls to {@link SHADER_SUB_RULE_RULES} (D-T309-2; AC #7).
 *
 * Both kinds surface independently — AC #6 explicitly requires both to
 * report when both apply.
 */
function inspectUniformUpdater(args: {
  updater: UniformUpdater;
  sourceFile: ts.SourceFile;
  absPath: string;
  lines: string[];
}): ShaderViolation[] {
  const { updater, sourceFile, absPath, lines } = args;
  const out: ShaderViolation[] = [];

  // Frame parameter check.
  const params = updater.node.parameters;
  const hasFrameParam = params.some((p) => {
    if (ts.isIdentifier(p.name)) return p.name.text === 'frame';
    return false;
  });
  if (!hasFrameParam) {
    const start = updater.node.getStart(sourceFile);
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
    out.push({
      file: absPath,
      line: line + 1,
      column: character + 1,
      api: 'missing-frame-parameter',
      hint: `uniform-updater '${updater.name}' must accept 'frame' as a parameter (ADR-003 §D5)`,
      functionName: updater.name,
    });
  }

  // Body API check.
  const body = updater.node.body;
  if (!body) return out;

  const visit = (node: ts.Node): void => {
    for (const rule of SHADER_SUB_RULE_RULES) {
      const api = rule.match(node);
      if (!api) continue;
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      const lineText = lines[line] ?? '';
      const prevLineText = line > 0 ? (lines[line - 1] ?? '') : '';
      if (isExempt(lineText, prevLineText)) continue;
      out.push({
        file: absPath,
        line: line + 1,
        column: character + 1,
        api,
        hint: `forbidden API '${api}' in uniform-updater '${updater.name}'; use 'frame' parameter instead (ADR-003 §D5)`,
        functionName: updater.name,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(body);

  return out;
}

export interface ShaderSubRuleResult {
  inspectedCount: number;
  violations: ShaderViolation[];
}

export interface ShaderSubRuleOpts {
  /** Workspace root to scan; defaults to process.cwd(). */
  workspaceRoot?: string;
}

/**
 * Synchronous variant of the path/decorator scan. Used in tests to keep the
 * vitest output predictable; the CLI path uses the async glob iterator
 * upstream and aggregates here.
 */
export function scanShaderSubRule(opts: ShaderSubRuleOpts = {}): ShaderSubRuleResult {
  const root = opts.workspaceRoot ?? process.cwd();
  const violations: ShaderViolation[] = [];
  let inspectedCount = 0;

  // Use Node's sync glob (via fs.readdirSync recursion) to keep the public
  // API synchronous. The test fixtures live in temp dirs of <100 files, so
  // a hand-rolled walk is faster than spinning up async iterators.
  const allFiles = walkSync(root);

  // Path-matched set.
  const pathMatched = new Set<string>();
  for (const f of allFiles) {
    if (!f.endsWith('.ts') && !f.endsWith('.tsx')) continue;
    if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue;
    if (f.endsWith('.d.ts')) continue;
    const rel = relative(root, f).replace(/\\/g, '/');
    if (SHADER_SUB_RULE_PATH_PREFIXES.some((prefix) => rel.startsWith(prefix))) {
      pathMatched.add(f);
    }
  }

  // Build the union of path-matched + every-other-source-for-decorator-scan.
  const filesToInspect = new Set<string>(pathMatched);
  for (const f of allFiles) {
    if (!f.endsWith('.ts') && !f.endsWith('.tsx')) continue;
    if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue;
    if (f.endsWith('.d.ts')) continue;
    const rel = relative(root, f).replace(/\\/g, '/');
    // Only consider package source files for decorator scan to bound the
    // walk — D-T309-5 budget.
    if (rel.startsWith('packages/') && rel.includes('/src/')) {
      filesToInspect.add(f);
    }
  }

  for (const file of filesToInspect) {
    const raw = readFileSyncSafe(file);
    if (raw === undefined) continue;
    const sourceFile = ts.createSourceFile(basename(file), raw, ts.ScriptTarget.Latest, true);
    const lines = raw.split('\n');
    const updaters = collectUniformUpdaters({
      sourceFile,
      pathMatched: pathMatched.has(file),
    });
    for (const updater of updaters) {
      inspectedCount += 1;
      const v = inspectUniformUpdater({ updater, sourceFile, absPath: file, lines });
      violations.push(...v);
    }
  }

  return { inspectedCount, violations };
}

/** Synchronous file walk; returns a flat list of absolute paths. */
function walkSync(root: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (dir === undefined) break;
    let entries: import('node:fs').Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      // Skip node_modules + dot-dirs — keeps the walk bounded.
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
      } else if (entry.isFile()) {
        out.push(abs);
      }
    }
  }
  return out;
}

function readFileSyncSafe(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

// ---------- CLI entry ----------

/* v8 ignore start */
// `main()` runs only when the script is invoked as a process. The subprocess
// CLI test (check-determinism gate run in CI) exercises the surface; in-process
// v8 coverage does NOT record subprocess execution, so this block would
// otherwise depress the script's coverage.
async function main(): Promise<void> {
  const self = fileURLToPath(import.meta.url);
  const files = (await collectFiles()).filter((f) => f !== self);

  // Broad rule (existing).
  let total = 0;
  const byFile = new Map<string, Violation[]>();
  for (const file of files) {
    const violations = await scanFile(file);
    if (violations.length > 0) {
      total += violations.length;
      byFile.set(file, violations);
    }
  }
  process.stdout.write(`check-determinism: scanned ${files.length} source files\n`);
  if (total === 0) {
    process.stdout.write('check-determinism [§3 broad rule]: PASS\n');
  } else {
    process.stdout.write('check-determinism [§3 broad rule]: FAIL\n');
  }

  // Shader sub-rule (T-309).
  const subResult = scanShaderSubRule({ workspaceRoot: process.cwd() });
  if (subResult.violations.length === 0) {
    process.stdout.write(
      `check-determinism [shader sub-rule]: PASS (${subResult.inspectedCount} uniform-updater${subResult.inspectedCount === 1 ? '' : 's'} detected)\n`,
    );
  } else {
    process.stdout.write(
      `check-determinism [shader sub-rule]: FAIL (${subResult.violations.length} violation${subResult.violations.length === 1 ? '' : 's'} across ${subResult.inspectedCount} uniform-updaters)\n`,
    );
  }

  if (total === 0 && subResult.violations.length === 0) {
    process.stdout.write('\ncheck-determinism: PASS\n');
    process.exit(0);
  }

  if (total > 0) {
    process.stderr.write(`\n  BROAD-RULE VIOLATIONS (${total}):\n`);
    for (const [file, violations] of byFile) {
      const rel = relative(process.cwd(), file);
      for (const v of violations) {
        process.stderr.write(`    ${rel}:${v.line}:${v.column}  ${v.api}\n`);
        process.stderr.write(`      ${v.source}\n`);
      }
    }
  }
  if (subResult.violations.length > 0) {
    process.stderr.write(`\n  SHADER SUB-RULE VIOLATIONS (${subResult.violations.length}):\n`);
    for (const v of subResult.violations) {
      const rel = relative(process.cwd(), v.file);
      process.stderr.write(`    ${rel}:${v.line}:${v.column}  ${v.api}\n`);
      process.stderr.write(`      ${v.hint}\n`);
    }
  }
  process.stderr.write(
    '\ncheck-determinism: FAIL — invariant I-2 forbids non-deterministic APIs in clip/runtime code.\n',
  );
  process.stderr.write(
    `If you truly need the API on a specific line, annotate with "// ${ESCAPE_HATCH}: <reason>" and link an ADR.\n`,
  );
  process.exit(1);
}

// CLI guard — only run main when invoked directly. Lets tests import the
// module without triggering process.exit. Mirrors check-preset-integrity.ts.
const __thisFile = fileURLToPath(import.meta.url);
const argvEntry = process.argv[1] ? resolve(process.argv[1]) : '';
const moduleEntry = resolve(__thisFile);
if (
  argvEntry === moduleEntry ||
  argvEntry === resolve(dirname(moduleEntry), 'check-determinism.ts')
) {
  main().catch((err: unknown) => {
    process.stderr.write(`check-determinism: crashed: ${String(err)}\n`);
    if (err instanceof Error && err.stack) process.stderr.write(`${err.stack}\n`);
    process.exit(2);
  });
}
/* v8 ignore stop */
