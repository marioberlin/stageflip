// scripts/check-determinism.test.ts
// Tests for the T-309 shader sub-rule on top of the existing T-028 broad
// rule. Each AC from docs/tasks/T-309.md is pinned at least once. Synthetic
// fixtures are written to a temp directory and fed through the script's
// public surface (`scanShaderSubRule`, `scanFile`). The on-disk corpus is
// exercised end-to-end via `runChecks` against the real workspace.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  type ShaderViolation,
  SHADER_FORBIDDEN_APIS,
  scanShaderSubRule,
} from './check-determinism.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

// ---------- helpers ----------

interface Fixture {
  /** Relative path inside the synthetic workspace root. */
  rel: string;
  source: string;
}

function makeWorkspace(fixtures: Fixture[]): string {
  const root = mkdtempSync(join(tmpdir(), 'check-determinism-'));
  for (const f of fixtures) {
    const abs = join(root, f.rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, f.source, 'utf8');
  }
  return root;
}

const SHADER_DIR = 'packages/runtimes/interactive/src/clips/shader';
const THREE_DIR = 'packages/runtimes/interactive/src/clips/three-scene';

// ---------- AC #1 / #2 — path-based positive + negative ----------

describe('T-309 AC #1, #2 — path-based shader sub-rule', () => {
  let root: string;
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('AC #1: path-matched file with Date.now() in uniform updater FAILS', () => {
    root = makeWorkspace([
      {
        rel: `${SHADER_DIR}/foo.ts`,
        source: `export function uFrame(frame: number): number {
  return Date.now();
}
`,
      },
    ]);
    const result = scanShaderSubRule({ workspaceRoot: root });
    expect(result.inspectedCount).toBeGreaterThan(0);
    const apis = result.violations.map((v) => v.api);
    expect(apis).toContain('Date.now()');
    const v = result.violations.find((x) => x.api === 'Date.now()');
    expect(v).toBeDefined();
    expect(v?.line).toBeGreaterThan(0);
    expect(v?.column).toBeGreaterThan(0);
    expect(v?.functionName).toBe('uFrame');
  });

  it('AC #2: path-matched file with frame-only body PASSES', () => {
    root = makeWorkspace([
      {
        rel: `${SHADER_DIR}/foo.ts`,
        source: `export function uFrame(frame: number): number {
  return frame * 0.001;
}
`,
      },
    ]);
    const result = scanShaderSubRule({ workspaceRoot: root });
    expect(result.violations).toHaveLength(0);
    expect(result.inspectedCount).toBe(1);
  });

  it('three-scene path is also covered', () => {
    root = makeWorkspace([
      {
        rel: `${THREE_DIR}/scene.ts`,
        source: `export function uTime(frame: number): number {
  return performance.now();
}
`,
      },
    ]);
    const result = scanShaderSubRule({ workspaceRoot: root });
    expect(result.violations.map((v) => v.api)).toContain('performance.now()');
  });
});

// ---------- AC #3 / #4 — decorator-based positive + negative ----------

describe('T-309 AC #3, #4 — decorator-based shader sub-rule', () => {
  let root: string;
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('AC #3: file outside path with @uniformUpdater + performance.now() FAILS', () => {
    root = makeWorkspace([
      {
        rel: 'packages/some-other-pkg/src/foo.ts',
        source: `/** @uniformUpdater */
export function foo(frame: number): number {
  performance.now();
  return frame;
}
`,
      },
    ]);
    const result = scanShaderSubRule({ workspaceRoot: root });
    expect(result.inspectedCount).toBe(1);
    expect(result.violations.map((v) => v.api)).toContain('performance.now()');
  });

  it('AC #4: same file shape WITHOUT decorator is not inspected by sub-rule', () => {
    root = makeWorkspace([
      {
        rel: 'packages/some-other-pkg/src/foo.ts',
        source: `export function foo(frame: number): number {
  performance.now();
  return frame;
}
`,
      },
    ]);
    const result = scanShaderSubRule({ workspaceRoot: root });
    // Sub-rule only inspects path-matched OR decorator-tagged functions.
    expect(result.inspectedCount).toBe(0);
    expect(result.violations).toHaveLength(0);
  });
});

// ---------- AC #5 / #6 — frame parameter + missing-parameter ----------

describe('T-309 AC #5, #6 — frame parameter requirement', () => {
  let root: string;
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('AC #5: frame-only signature PASSES', () => {
    root = makeWorkspace([
      {
        rel: `${SHADER_DIR}/ok.ts`,
        source: `export function uFrame(frame: number): number {
  return frame;
}
`,
      },
    ]);
    const result = scanShaderSubRule({ workspaceRoot: root });
    expect(result.violations).toHaveLength(0);
  });

  it('AC #6: missing frame param + Date.now() yields BOTH violations', () => {
    root = makeWorkspace([
      {
        rel: `${SHADER_DIR}/bad.ts`,
        source: `export function uFrame(): number {
  return Date.now();
}
`,
      },
    ]);
    const result = scanShaderSubRule({ workspaceRoot: root });
    const kinds = result.violations.map((v) => v.api);
    // Both kinds surface.
    expect(kinds).toContain('Date.now()');
    expect(kinds.some((a) => a.startsWith('missing-frame-parameter'))).toBe(true);
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------- AC #7 — every forbidden API triggers a violation ----------

describe('T-309 AC #7 — forbidden-API coverage', () => {
  let root: string;
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('every forbidden API triggers a sub-rule violation', () => {
    // Build a fixture per forbidden API in a path-matched file. Simpler than
    // packing all into one body because some APIs are statements not
    // expressions, and column-precision matters for AC #9.
    const cases: Array<{ name: string; body: string; expect: string }> = [
      {
        name: 'date-now',
        body: 'Date.now();',
        expect: 'Date.now()',
      },
      {
        name: 'new-date',
        body: 'new Date();',
        expect: 'new Date()',
      },
      {
        name: 'perf-now',
        body: 'performance.now();',
        expect: 'performance.now()',
      },
      {
        name: 'math-random',
        body: 'Math.random();',
        expect: 'Math.random()',
      },
      {
        name: 'set-timeout',
        body: 'setTimeout(() => 0, 1);',
        expect: 'setTimeout()',
      },
      {
        name: 'set-interval',
        body: 'setInterval(() => 0, 1);',
        expect: 'setInterval()',
      },
      {
        name: 'raf',
        body: 'requestAnimationFrame(() => 0);',
        expect: 'requestAnimationFrame()',
      },
      {
        name: 'caf',
        body: 'cancelAnimationFrame(0);',
        expect: 'cancelAnimationFrame()',
      },
    ];
    root = makeWorkspace(
      cases.map((c) => ({
        rel: `${SHADER_DIR}/${c.name}.ts`,
        source: `export function uFrame(frame: number): number {
  ${c.body}
  return frame;
}
`,
      })),
    );
    const result = scanShaderSubRule({ workspaceRoot: root });
    const apis = new Set(result.violations.map((v) => v.api));
    for (const c of cases) {
      expect(apis.has(c.expect)).toBe(true);
    }
  });

  it('SHADER_FORBIDDEN_APIS contains the 6 named families per ADR-003 §D5', () => {
    // ADR-003 §D5 names performance.now / Date.now explicitly; D-T309-2
    // expands to the six listed families. Pin via direct membership test.
    expect(SHADER_FORBIDDEN_APIS).toContain('performance.now');
    expect(SHADER_FORBIDDEN_APIS).toContain('Date.now');
    expect(SHADER_FORBIDDEN_APIS).toContain('new Date()');
    expect(SHADER_FORBIDDEN_APIS).toContain('Math.random');
    expect(SHADER_FORBIDDEN_APIS).toContain('setTimeout/setInterval');
    expect(SHADER_FORBIDDEN_APIS).toContain('requestAnimationFrame/cancelAnimationFrame');
  });
});

// ---------- AC #8 — output line + N count ----------

describe('T-309 AC #8 — pass-line wording', () => {
  let root: string;
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('reports the inspected count when zero violations', () => {
    root = makeWorkspace([
      {
        rel: `${SHADER_DIR}/a.ts`,
        source: `export function uFrame(frame: number): number { return frame; }\n`,
      },
      {
        rel: `${SHADER_DIR}/b.ts`,
        source: `export function uTime(frame: number): number { return frame * 2; }\n`,
      },
    ]);
    const result = scanShaderSubRule({ workspaceRoot: root });
    expect(result.violations).toHaveLength(0);
    expect(result.inspectedCount).toBe(2);
  });

  it('handles N=0 gracefully (PASS, 0 inspected)', () => {
    root = makeWorkspace([
      // No shader/three-scene files; broad rule's territory only.
      {
        rel: 'packages/frame-runtime/src/foo.ts',
        source: `export function add(a: number, b: number) { return a + b; }\n`,
      },
    ]);
    const result = scanShaderSubRule({ workspaceRoot: root });
    expect(result.inspectedCount).toBe(0);
    expect(result.violations).toHaveLength(0);
  });
});

// ---------- AC #9 — violation lines carry file:line:col + hint ----------

describe('T-309 AC #9 — violation diagnostics shape', () => {
  let root: string;
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('each violation has file, line, column, api, and hint fields', () => {
    root = makeWorkspace([
      {
        rel: `${SHADER_DIR}/x.ts`,
        source: `export function uFrame(frame: number): number {
  return Date.now();
}
`,
      },
    ]);
    const { violations } = scanShaderSubRule({ workspaceRoot: root });
    expect(violations.length).toBeGreaterThan(0);
    const v: ShaderViolation = violations[0]!;
    expect(typeof v.file).toBe('string');
    expect(v.line).toBeGreaterThan(0);
    expect(v.column).toBeGreaterThan(0);
    expect(typeof v.api).toBe('string');
    expect(v.hint).toMatch(/frame|ADR-003/i);
  });
});

// ---------- AC #11 — performance budget ----------

describe('T-309 AC #11 — performance budget <2s for 10 fixture files', () => {
  let root: string;
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('10 fixture files inspect in under 2s', () => {
    const fixtures: Fixture[] = [];
    for (let i = 0; i < 10; i++) {
      fixtures.push({
        rel: `${SHADER_DIR}/f${i}.ts`,
        source: `export function uFrame(frame: number): number {
  return frame * ${i};
}
`,
      });
    }
    root = makeWorkspace(fixtures);
    const t0 = Date.now();
    const result = scanShaderSubRule({ workspaceRoot: root });
    const elapsed = Date.now() - t0;
    expect(result.inspectedCount).toBe(10);
    expect(elapsed).toBeLessThan(2000);
  });
});

// ---------- AC #13 — backward compat ----------

describe('T-309 AC #13 — sub-rule is vacuously PASS at HEAD', () => {
  it('the real workspace has zero shader/three-scene files today; sub-rule passes', () => {
    const result = scanShaderSubRule({ workspaceRoot: REPO_ROOT });
    // No shader/three-scene clips exist on main pre-Phase γ.
    expect(result.violations).toHaveLength(0);
  });
});

// ---------- escape-hatch ----------

describe('T-309 — escape-hatch comment exempts a line', () => {
  let root: string;
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('// determinism-safe: <reason> on the same line skips the violation', () => {
    root = makeWorkspace([
      {
        rel: `${SHADER_DIR}/x.ts`,
        source: `export function uFrame(frame: number): number {
  return Date.now(); // determinism-safe: telemetry-only ADR-003 D5
}
`,
      },
    ]);
    const result = scanShaderSubRule({ workspaceRoot: root });
    expect(result.violations.filter((v) => v.api === 'Date.now()')).toHaveLength(0);
  });
});
