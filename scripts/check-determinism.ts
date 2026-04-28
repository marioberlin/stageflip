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

import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';
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
 * Path prefixes excluded from the determinism walk per ADR-003 §D5 + T-306
 * D-T306-5. The interactive runtime tier is explicitly OUT of scope: clips
 * mounted via this tier may use `Date.now`, `performance.now`, `fetch`,
 * `requestAnimationFrame`, `setTimeout`, etc. The tier's contract requires
 * a deterministic `staticFallback` for parity-safe export targets, so the
 * MP4 / PPTX / display invariants (I-2) hold via that path.
 *
 * T-309 will land a shader sub-rule that re-applies determinism inside the
 * tier (uniform-updaters must use `frame` only). T-306 ships only the
 * package-level exemption.
 */
const EXCLUDED_PREFIXES = ['packages/runtimes/interactive/'];

/**
 * Escape-hatch comment. A source line prefixed by an inline or preceding
 * comment containing this token is exempted from the check. Callers should
 * link an ADR or rationale in the comment body.
 */
const ESCAPE_HATCH = 'determinism-safe';

interface Violation {
  file: string;
  line: number;
  column: number;
  api: string;
  source: string;
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

/** True if a source line should be exempt because of a nearby escape-hatch comment. */
function isExempt(lineText: string, prevLineText: string): boolean {
  return lineText.includes(ESCAPE_HATCH) || prevLineText.includes(ESCAPE_HATCH);
}

async function scanFile(absPath: string): Promise<Violation[]> {
  const raw = await readFile(absPath, 'utf8');
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
      // ADR-003 §D5: interactive runtime tier is exempt.
      const normalized = match.replace(/\\/g, '/');
      if (EXCLUDED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) continue;
      out.push(resolve(match));
    }
  }
  return out.sort();
}

async function main(): Promise<void> {
  const self = fileURLToPath(import.meta.url);
  const files = (await collectFiles()).filter((f) => f !== self);
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
    process.stdout.write('check-determinism: PASS\n');
    process.exit(0);
  }

  process.stderr.write(`\n  VIOLATIONS (${total}):\n`);
  for (const [file, violations] of byFile) {
    const rel = relative(process.cwd(), file);
    for (const v of violations) {
      process.stderr.write(`    ${rel}:${v.line}:${v.column}  ${v.api}\n`);
      process.stderr.write(`      ${v.source}\n`);
    }
  }
  process.stderr.write(
    `\ncheck-determinism: FAIL — invariant I-2 forbids non-deterministic APIs in clip/runtime code.\n`,
  );
  process.stderr.write(
    `If you truly need the API on a specific line, annotate with "// ${ESCAPE_HATCH}: <reason>" and link an ADR.\n`,
  );
  process.exit(1);
}

main().catch((err: unknown) => {
  process.stderr.write(`check-determinism: crashed: ${String(err)}\n`);
  if (err instanceof Error && err.stack) process.stderr.write(`${err.stack}\n`);
  process.exit(2);
});
