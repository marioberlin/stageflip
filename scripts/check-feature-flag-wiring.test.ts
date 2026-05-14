// scripts/check-feature-flag-wiring.test.ts
// T-402 — Tests for the coherence gate. Each of the seven invariants is
// exercised with both PASS and FAIL synthetic fixtures, plus a happy-path
// integration test against the real repo state.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  ADMIN_UI_ACTION_FILE,
  ADMIN_UI_PAGE_FILE,
  AUTH_FILE,
  BROWSER_HOST_FILE,
  HTTP_ROUTE_FILE,
  RUNTIME_CACHE_FILE,
  SCHEMA_FILE,
  adminUiCheck,
  authorizationCheck,
  browserHostCheck,
  containsAllValuesAsLiterals,
  containsCanonicalTriple,
  crossLayerDriftCheck,
  formatReport,
  httpRouteCheck,
  runChecks,
  runtimeCacheCheck,
  schemaLayerCheck,
} from './check-feature-flag-wiring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

// ---------- fixture helpers ----------

interface Fixture {
  /** Relative path under the synthetic workspace root. */
  rel: string;
  source: string;
}

/**
 * Build a complete synthetic workspace with all 7 layer files seeded
 * with the canonical / correct content. Individual tests override one
 * file at a time to exercise the FAIL paths.
 */
function makeWorkspace(extra: Fixture[] = []): string {
  const root = mkdtempSync(join(tmpdir(), 'check-feature-flag-wiring-'));
  const defaults: Fixture[] = [
    {
      rel: SCHEMA_FILE,
      source: `import { z } from 'zod';
export const tenantSettingsSchema = z.object({
  features: z.object({
    interactive: z.enum(['disabled', 'preview', 'ga']),
  }).strict(),
}).strict();
`,
    },
    {
      rel: HTTP_ROUTE_FILE,
      source: `import { z } from 'zod';
const interactiveValueSchema = z.enum(['disabled', 'preview', 'ga']);
export const route = interactiveValueSchema;
`,
    },
    {
      rel: AUTH_FILE,
      source: `export type InteractiveValue = 'disabled' | 'preview' | 'ga';
export function canSetInteractive(v: InteractiveValue) {
  if (v === 'ga') return true;
  if (v === 'preview') return true;
  if (v === 'disabled') return true;
  return false;
}
`,
    },
    {
      rel: RUNTIME_CACHE_FILE,
      source: `export type TenantFlagValue = 'disabled' | 'preview' | 'ga';
export const TENANT_FLAG_GATING_MATRIX = {
  disabled: { html: 'static-fallback-only' },
  preview: { html: 'live-mount' },
  ga: { html: 'live-mount' },
};
`,
    },
    {
      rel: BROWSER_HOST_FILE,
      source: `import { TENANT_FLAG_GATING_MATRIX } from './tenant-flag-cache';
export interface BrowserLivePreviewTenantPolicy {
  featuresInteractive: 'disabled' | 'preview' | 'ga';
}
export function decide(p: BrowserLivePreviewTenantPolicy) {
  return TENANT_FLAG_GATING_MATRIX[p.featuresInteractive];
}
`,
    },
    {
      rel: ADMIN_UI_PAGE_FILE,
      source: `const ALL_VALUES = ['disabled', 'preview', 'ga'] as const;
export default function Page() { return ALL_VALUES; }
`,
    },
    {
      rel: ADMIN_UI_ACTION_FILE,
      source: `import { z } from 'zod';
const interactiveValueSchema = z.enum(['disabled', 'preview', 'ga']);
export const schema = interactiveValueSchema;
`,
    },
  ];
  for (const f of [...defaults, ...extra]) {
    const abs = join(root, f.rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, f.source, 'utf8');
  }
  return root;
}

function overwrite(root: string, rel: string, source: string): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, source, 'utf8');
}

function removeFile(root: string, rel: string): void {
  rmSync(join(root, rel), { force: true });
}

// ---------- helper-fn unit tests ----------

describe('containsCanonicalTriple', () => {
  it('matches enum-array form', () => {
    expect(containsCanonicalTriple(`z.enum(['disabled', 'preview', 'ga'])`)).toBe(true);
  });
  it('matches type-union form', () => {
    expect(containsCanonicalTriple(`type T = 'disabled' | 'preview' | 'ga';`)).toBe(true);
  });
  it('rejects a missing value', () => {
    expect(containsCanonicalTriple(`z.enum(['disabled', 'preview'])`)).toBe(false);
  });
  it('rejects all-caps (case-sensitive)', () => {
    expect(containsCanonicalTriple(`z.enum(['DISABLED', 'PREVIEW', 'GA'])`)).toBe(false);
  });
  it('rejects out-of-order tuple', () => {
    // Out-of-order rejected because the regex insists on the canonical
    // ordering (matches what the source files actually contain).
    expect(containsCanonicalTriple(`z.enum(['preview', 'disabled', 'ga'])`)).toBe(false);
  });
});

describe('containsAllValuesAsLiterals', () => {
  it('returns ok when every literal appears', () => {
    const r = containsAllValuesAsLiterals(`if (v === 'ga') ... 'preview' 'disabled'`);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });
  it('reports each missing literal', () => {
    const r = containsAllValuesAsLiterals(`if (v === 'preview') ...`);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['disabled', 'ga']);
  });
});

// ---------- per-invariant FAIL fixtures ----------

describe('schemaLayerCheck', () => {
  let root: string;
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('PASS on canonical fixture', () => {
    root = makeWorkspace();
    const r = schemaLayerCheck(root);
    expect(r.issues).toEqual([]);
  });

  it('FAIL when enum drifts to alternate value set', () => {
    root = makeWorkspace();
    overwrite(
      root,
      SCHEMA_FILE,
      `import { z } from 'zod';
const schema = z.enum(['off', 'preview', 'ga']);
`,
    );
    const r = schemaLayerCheck(root);
    expect(r.issues.length).toBeGreaterThan(0);
    expect(r.issues[0]?.message).toMatch(/canonical enum/);
  });

  it('FAIL when schema file is missing', () => {
    root = makeWorkspace();
    removeFile(root, SCHEMA_FILE);
    const r = schemaLayerCheck(root);
    expect(r.issues.length).toBeGreaterThan(0);
    expect(r.issues[0]?.message).toMatch(/expected file not found/);
  });

  it('FAIL when z.enum() declaration is missing', () => {
    root = makeWorkspace();
    overwrite(
      root,
      SCHEMA_FILE,
      `// fake; uses the triple but not as z.enum
type V = 'disabled' | 'preview' | 'ga';
`,
    );
    const r = schemaLayerCheck(root);
    expect(r.issues.length).toBeGreaterThan(0);
    expect(r.issues.some((i) => /z\.enum/.test(i.message))).toBe(true);
  });
});

describe('httpRouteCheck', () => {
  let root: string;
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('PASS on canonical fixture', () => {
    root = makeWorkspace();
    expect(httpRouteCheck(root).issues).toEqual([]);
  });

  it('FAIL when route enum drifts', () => {
    root = makeWorkspace();
    overwrite(
      root,
      HTTP_ROUTE_FILE,
      `import { z } from 'zod';
const schema = z.enum(['off', 'preview', 'ga']);
`,
    );
    const r = httpRouteCheck(root);
    expect(r.issues.length).toBeGreaterThan(0);
  });
});

describe('authorizationCheck', () => {
  let root: string;
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('PASS on canonical fixture', () => {
    root = makeWorkspace();
    expect(authorizationCheck(root).issues).toEqual([]);
  });

  it('FAIL when canonical type union is missing entirely', () => {
    root = makeWorkspace();
    // Replace the canonical triple with a non-canonical synonym set —
    // the canonical-triple regex fails AND the literal-coverage check
    // fails for the dropped values.
    overwrite(
      root,
      AUTH_FILE,
      `export type InteractiveValue = 'off' | 'beta' | 'production';
export function canSetInteractive(v: InteractiveValue) {
  return v === 'production';
}
`,
    );
    const r = authorizationCheck(root);
    expect(r.issues.length).toBeGreaterThan(0);
    expect(r.issues.some((i) => /canonical type/.test(i.message))).toBe(true);
  });
});

describe('runtimeCacheCheck', () => {
  let root: string;
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('PASS on canonical fixture', () => {
    root = makeWorkspace();
    expect(runtimeCacheCheck(root).issues).toEqual([]);
  });

  it('FAIL when the matrix is missing a value-key', () => {
    root = makeWorkspace();
    overwrite(
      root,
      RUNTIME_CACHE_FILE,
      `export type TenantFlagValue = 'disabled' | 'preview' | 'ga';
export const TENANT_FLAG_GATING_MATRIX = {
  preview: { html: 'live-mount' },
  ga: { html: 'live-mount' },
};
`,
    );
    const r = runtimeCacheCheck(root);
    expect(r.issues.some((i) => /matrix entry for 'disabled'/.test(i.message))).toBe(true);
  });
});

describe('browserHostCheck', () => {
  let root: string;
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('PASS on canonical fixture', () => {
    root = makeWorkspace();
    expect(browserHostCheck(root).issues).toEqual([]);
  });

  it('FAIL when the matrix import is missing', () => {
    root = makeWorkspace();
    overwrite(
      root,
      BROWSER_HOST_FILE,
      `// Forgot to import the matrix; hard-coded a single decision.
export function decide(featuresInteractive: 'disabled' | 'preview' | 'ga') {
  return 'static-fallback-only';
}
`,
    );
    const r = browserHostCheck(root);
    expect(r.issues.some((i) => /TENANT_FLAG_GATING_MATRIX/.test(i.message))).toBe(true);
  });
});

describe('adminUiCheck', () => {
  let root: string;
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('PASS on canonical fixture', () => {
    root = makeWorkspace();
    expect(adminUiCheck(root).issues).toEqual([]);
  });

  it('FAIL when admin UI omits one of the 3 choices', () => {
    root = makeWorkspace();
    // Drop 'ga' from the page's ALL_VALUES tuple.
    overwrite(
      root,
      ADMIN_UI_PAGE_FILE,
      `const ALL_VALUES = ['disabled', 'preview'] as const;
export default function Page() { return ALL_VALUES; }
`,
    );
    const r = adminUiCheck(root);
    expect(r.issues.length).toBeGreaterThan(0);
  });
});

describe('crossLayerDriftCheck', () => {
  let root: string;
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('PASS when no extra triple occurrences exist outside layer files', () => {
    root = makeWorkspace();
    const r = crossLayerDriftCheck(root);
    expect(r.issues).toEqual([]);
  });

  it('FAIL when a synthetic drift literal appears in an unrelated source file', () => {
    root = makeWorkspace([
      {
        rel: 'packages/engine/src/random-handler.ts',
        source: `// stray drift
type V = 'disabled' | 'preview' | 'ga';
`,
      },
    ]);
    const r = crossLayerDriftCheck(root);
    expect(r.issues.length).toBeGreaterThan(0);
    expect(r.issues[0]?.file).toBe('packages/engine/src/random-handler.ts');
  });

  it('PASS for known-safe allowlisted location (cli/commands/tenant.ts)', () => {
    root = makeWorkspace([
      {
        rel: 'apps/cli/src/commands/tenant.ts',
        source: `const VALID_VALUES = ['disabled', 'preview', 'ga'] as const;
`,
      },
    ]);
    const r = crossLayerDriftCheck(root);
    // Allowlisted, not error-flagged.
    expect(r.issues).toEqual([]);
    expect(r.annotation).toMatch(/known-safe/);
  });

  it('does NOT match ALL-CAPS literals (case-sensitive)', () => {
    root = makeWorkspace([
      {
        rel: 'packages/engine/src/some-fixture.ts',
        source: `const X = ['DISABLED', 'PREVIEW', 'GA']; // not the canonical triple
`,
      },
    ]);
    const r = crossLayerDriftCheck(root);
    expect(r.issues).toEqual([]);
  });

  it('ignores files in node_modules / dist / coverage', () => {
    root = makeWorkspace([
      {
        rel: 'packages/runtimes/interactive/dist/some-built.js',
        source: `const x = ['disabled', 'preview', 'ga'];`,
      },
      {
        rel: 'packages/runtimes/interactive/node_modules/foo/index.ts',
        source: `const x: 'disabled' | 'preview' | 'ga' = 'ga';`,
      },
    ]);
    const r = crossLayerDriftCheck(root);
    expect(r.issues).toEqual([]);
  });
});

// ---------- aggregator / formatter ----------

describe('runChecks', () => {
  let root: string;
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('aggregates all 7 invariants', () => {
    root = makeWorkspace();
    const report = runChecks({ rootDir: root });
    expect(report.results.map((r) => r.name)).toEqual([
      'schema-layer',
      'http-route',
      'authorization',
      'runtime-cache',
      'browser-host',
      'admin-ui',
      'cross-layer-drift',
    ]);
    expect(report.exitCode).toBe(0);
  });

  it('exitCode is 1 when ANY invariant fails', () => {
    root = makeWorkspace();
    overwrite(root, SCHEMA_FILE, `// broken — no enum`);
    const report = runChecks({ rootDir: root });
    expect(report.exitCode).toBe(1);
  });

  it('PASS report against the real repo state', () => {
    const report = runChecks({ rootDir: REPO_ROOT });
    expect(report.exitCode).toBe(0);
  });
});

describe('formatReport', () => {
  it('emits a PASS line per invariant on a clean report', () => {
    const report = runChecks({ rootDir: makeAndKeepClean() });
    const { stdout, stderr } = formatReport(report);
    expect(stdout).toContain('check-feature-flag-wiring [schema-layer]: PASS');
    expect(stdout).toContain('check-feature-flag-wiring [cross-layer-drift]: PASS');
    expect(stdout).toContain('check-feature-flag-wiring: PASS');
    expect(stderr).toBe('');
  });

  it('emits FAIL details on stderr when an invariant errors', () => {
    const root = makeWorkspace();
    overwrite(root, SCHEMA_FILE, `// broken`);
    const report = runChecks({ rootDir: root });
    const { stdout, stderr } = formatReport(report);
    expect(stdout).toContain('[schema-layer]: FAIL');
    expect(stderr).toContain('ERROR:');
    expect(stderr).toContain('check-feature-flag-wiring: FAIL');
    rmSync(root, { recursive: true, force: true });
  });

  it('annotates cross-layer-drift with the allowlist hit count', () => {
    const root = makeWorkspace([
      {
        rel: 'apps/cli/src/commands/tenant.ts',
        source: `const VALID = ['disabled', 'preview', 'ga'];`,
      },
    ]);
    const report = runChecks({ rootDir: root });
    const { stdout } = formatReport(report);
    expect(stdout).toMatch(/known-safe occurrence/);
    rmSync(root, { recursive: true, force: true });
  });
});

// ---------- CLI integration ----------

describe('CLI', () => {
  it('exits 0 against the real repo via `pnpm tsx scripts/check-feature-flag-wiring.ts`', () => {
    // execFile keeps argv parsing tight and avoids shell quoting traps.
    const out = execFileSync('pnpm', ['tsx', 'scripts/check-feature-flag-wiring.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    expect(out).toContain('check-feature-flag-wiring: PASS');
  });
});

// ---------- internal helper for tests ----------

/**
 * Build a workspace WITHOUT registering an `afterEach` cleanup — used by
 * formatReport tests that consume the report synchronously and clean up
 * inline. Returns the root path so the caller can rmSync it.
 */
function makeAndKeepClean(): string {
  return makeWorkspace();
}
