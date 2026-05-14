// scripts/check-marketplace-ga-readiness.ts
// T-550 — P16 δ marketplace GA-readiness audit.
//
// Walks every P16 δ marketplace surface (T-536..T-549) and emits
// pass / warn / fail per category, plus a humans-only legal-review
// sign-off check against `docs/legal-review-marketplace.md`.
//
// Forward-compatible mode (mirrors `check-pack-integrity.ts` / T-499):
// - Missing surfaces surface as `fail`.
// - Unsigned legal-review clauses surface as `warn` by default; the
//   build only fails on those when invoked with
//   `--require-legal-signoff`.
//
// Pure script: input = filesystem, output = stdout summary + an exit
// code (0 = no failures; 1 = any failure). Test execution is
// delegated to `pnpm test` — this gate audits file-existence + the
// presence of expected exported symbols only. Live test execution is
// out of scope.
//
// Determinism perimeter: scripts/** lives OUTSIDE the determinism
// perimeter per CLAUDE.md §3 — Node fs + process.exit are fine here.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- types ----------

/** Per-category outcome bucket. Mirrors `pass | warn | fail`. */
export type CategoryStatus = 'pass' | 'warn' | 'fail';

/** Result of a single category audit. */
export interface CategoryResult {
  /** Numeric id (1..10). */
  readonly id: number;
  /** One-line title (e.g. `Registry library`). */
  readonly title: string;
  readonly status: CategoryStatus;
  /**
   * Human-readable details. Either confirms the audited evidence
   * (`pass`) or enumerates the missing surfaces / unsigned clauses.
   */
  readonly notes: readonly string[];
}

/** Whole-report aggregate. */
export interface AuditReport {
  readonly categories: readonly CategoryResult[];
  /** Whether `--require-legal-signoff` was supplied on the CLI. */
  readonly requireLegalSignoff: boolean;
}

/** Minimal filesystem surface — tests inject a Map-backed shim. */
export interface FsShim {
  existsSync(path: string): boolean;
  readFileSync(path: string): string;
  readdirSync(path: string): string[];
  statSync(path: string): { isDirectory(): boolean; isFile(): boolean };
}

export interface CheckOpts {
  readonly repoRoot: string;
  readonly requireLegalSignoff: boolean;
  /** Injected for tests; defaults to the real fs. */
  readonly fs?: FsShim;
}

// ---------- legal-review constants ----------

/**
 * Required legal-review clauses. Each must appear as a `### Clause:
 * <name>` heading in `docs/legal-review-marketplace.md`. Order is
 * documentation order — the audit does NOT enforce ordering.
 */
export const REQUIRED_LEGAL_CLAUSES = [
  'Terms of Service',
  'Privacy Policy',
  'Stripe Billing Terms',
  'DMCA Takedown Procedure',
  'Publisher Agreement',
  'Tenant Master Subscription Agreement',
  'Per-Pack EULA',
  'GDPR Data Processing Agreement',
  'Refund and Dispute Policy',
  'Tax Collection Policy',
] as const;

/** Where the legal-review document lives, relative to `repoRoot`. */
export const LEGAL_REVIEW_DOC_PATH = 'docs/legal-review-marketplace.md';

// ---------- helpers ----------

function realFs(): FsShim {
  return {
    existsSync,
    readFileSync: (path: string): string => readFileSync(path, 'utf8'),
    readdirSync: (path: string): string[] => readdirSync(path),
    statSync: (path: string): { isDirectory(): boolean; isFile(): boolean } => {
      const s = statSync(path);
      return { isDirectory: () => s.isDirectory(), isFile: () => s.isFile() };
    },
  };
}

/** Read a UTF-8 file, returning `undefined` if it does not exist. */
function readIfExists(fs: FsShim, path: string): string | undefined {
  if (!fs.existsSync(path)) return undefined;
  try {
    return fs.readFileSync(path);
  } catch {
    return undefined;
  }
}

/**
 * Tiny verifier — confirms every supplied symbol substring appears in
 * the file at `path`. Returns the missing symbols (empty array =
 * `pass`).
 */
function missingSymbols(
  fs: FsShim,
  path: string,
  expected: readonly string[],
): { fileMissing: boolean; missing: string[] } {
  const src = readIfExists(fs, path);
  if (src === undefined) return { fileMissing: true, missing: [] };
  const missing: string[] = [];
  for (const sym of expected) {
    if (!src.includes(sym)) missing.push(sym);
  }
  return { fileMissing: false, missing };
}

// ---------- per-category checks ----------

/**
 * Category 1 — `@stageflip/marketplace-registry` exists with the
 * composed handler factory + at least one handler test on disk.
 */
export function checkRegistry(opts: CheckOpts): CategoryResult {
  const fs = opts.fs ?? realFs();
  const pkg = join(opts.repoRoot, 'packages/marketplace-registry');
  const indexPath = join(pkg, 'src/index.ts');
  const handlerTestPath = join(pkg, 'src/handler.test.ts');
  const notes: string[] = [];

  if (!fs.existsSync(pkg)) {
    return {
      id: 1,
      title: 'Registry library',
      status: 'fail',
      notes: [`package directory missing: ${pkg}`],
    };
  }
  const { fileMissing, missing } = missingSymbols(fs, indexPath, [
    'composeHandler',
    'createInMemoryRegistry',
    'createPublishHandler',
    'createListHandler',
    'createDownloadHandler',
  ]);
  if (fileMissing) {
    notes.push(`index missing: ${indexPath}`);
  } else if (missing.length > 0) {
    notes.push(`exported symbols missing: ${missing.join(', ')}`);
  } else {
    notes.push('index exports composeHandler + per-route factories');
  }
  if (!fs.existsSync(handlerTestPath)) {
    notes.push(`handler test missing: ${handlerTestPath}`);
  } else {
    notes.push('handler.test.ts present');
  }
  const status: CategoryStatus =
    fileMissing || missing.length > 0 || !fs.existsSync(handlerTestPath) ? 'fail' : 'pass';
  return { id: 1, title: 'Registry library', status, notes };
}

/**
 * Category 2 — `@stageflip/marketplace-stripe` exposes the SKU map
 * with exactly six first-party packs, plus the composed webhook
 * handler.
 */
export function checkStripe(opts: CheckOpts): CategoryResult {
  const fs = opts.fs ?? realFs();
  const pkg = join(opts.repoRoot, 'packages/marketplace-stripe');
  const indexPath = join(pkg, 'src/index.ts');
  const skuMapPath = join(pkg, 'src/pricing/sku-map.ts');
  const handlerTestPath = join(pkg, 'src/handler.test.ts');
  const notes: string[] = [];

  if (!fs.existsSync(pkg)) {
    return {
      id: 2,
      title: 'Stripe library',
      status: 'fail',
      notes: [`package directory missing: ${pkg}`],
    };
  }
  const indexCheck = missingSymbols(fs, indexPath, [
    'FIRST_PARTY_SKU_MAP',
    'composeWebhookHandler',
    'verifyStripeSignature',
  ]);
  if (indexCheck.fileMissing) notes.push(`index missing: ${indexPath}`);
  else if (indexCheck.missing.length > 0)
    notes.push(`exported symbols missing: ${indexCheck.missing.join(', ')}`);
  else notes.push('index exports SKU map + webhook handler + signature verifier');

  let skuStatus: CategoryStatus = 'pass';
  const skuSrc = readIfExists(fs, skuMapPath);
  if (skuSrc === undefined) {
    skuStatus = 'fail';
    notes.push(`sku-map missing: ${skuMapPath}`);
  } else {
    // Each first-party SKU mapping is one `{ sku: ... }` object literal
    // inside FIRST_PARTY_SKU_MAP. Counting `sku:` keys is the cheapest
    // robust shape-check without parsing TS.
    const matches = skuSrc.match(/sku:\s*'/g) ?? [];
    if (matches.length !== 6) {
      skuStatus = 'fail';
      notes.push(`expected 6 first-party SKU mappings, found ${matches.length}`);
    } else {
      notes.push('FIRST_PARTY_SKU_MAP has 6 entries');
    }
  }
  if (!fs.existsSync(handlerTestPath)) {
    notes.push(`handler test missing: ${handlerTestPath}`);
  } else {
    notes.push('handler.test.ts present');
  }
  const baseFail =
    indexCheck.fileMissing ||
    indexCheck.missing.length > 0 ||
    skuStatus === 'fail' ||
    !fs.existsSync(handlerTestPath);
  return {
    id: 2,
    title: 'Stripe library',
    status: baseFail ? 'fail' : 'pass',
    notes,
  };
}

/**
 * Category 3 — `@stageflip/marketplace-npm` ships the token store +
 * verifier, AND `LF-NPM-TOKEN-MISSING` is wired into the LF catalogue
 * in `packages/pack-format/src/loss-flags.ts`.
 */
export function checkNpmPath(opts: CheckOpts): CategoryResult {
  const fs = opts.fs ?? realFs();
  const pkg = join(opts.repoRoot, 'packages/marketplace-npm');
  const indexPath = join(pkg, 'src/index.ts');
  const lfPath = join(opts.repoRoot, 'packages/pack-format/src/loss-flags.ts');
  const notes: string[] = [];

  if (!fs.existsSync(pkg)) {
    return {
      id: 3,
      title: 'npm-path library',
      status: 'fail',
      notes: [`package directory missing: ${pkg}`],
    };
  }
  const indexCheck = missingSymbols(fs, indexPath, [
    'verifyLicenseClaim',
    'createSidecarClient',
    'InMemoryNpmTokenStore',
  ]);
  if (indexCheck.fileMissing) notes.push(`index missing: ${indexPath}`);
  else if (indexCheck.missing.length > 0)
    notes.push(`exported symbols missing: ${indexCheck.missing.join(', ')}`);
  else notes.push('index exports verifier + sidecar + token-store');

  const lfSrc = readIfExists(fs, lfPath);
  let lfFail = false;
  if (lfSrc === undefined) {
    lfFail = true;
    notes.push(`loss-flags catalogue missing: ${lfPath}`);
  } else if (!lfSrc.includes('LF-NPM-TOKEN-MISSING')) {
    lfFail = true;
    notes.push('LF-NPM-TOKEN-MISSING not present in loss-flags catalogue');
  } else {
    notes.push('LF-NPM-TOKEN-MISSING wired into loss-flags catalogue');
  }
  const status: CategoryStatus =
    indexCheck.fileMissing || indexCheck.missing.length > 0 || lfFail ? 'fail' : 'pass';
  return { id: 3, title: 'npm-path library', status, notes };
}

/**
 * Category 4 — Browsing UI: docs marketplace-pages build script +
 * package.json wiring under `apps/docs`.
 */
export function checkBrowsingUi(opts: CheckOpts): CategoryResult {
  const fs = opts.fs ?? realFs();
  const buildScriptPath = join(opts.repoRoot, 'apps/docs/scripts/build-marketplace-pages.ts');
  const docsPkgPath = join(opts.repoRoot, 'apps/docs/package.json');
  const notes: string[] = [];

  if (!fs.existsSync(buildScriptPath)) {
    notes.push(`build script missing: ${buildScriptPath}`);
  } else {
    notes.push('apps/docs/scripts/build-marketplace-pages.ts present');
  }
  let wired = false;
  const pkgSrc = readIfExists(fs, docsPkgPath);
  if (pkgSrc === undefined) {
    notes.push(`apps/docs/package.json missing: ${docsPkgPath}`);
  } else {
    try {
      const parsed = JSON.parse(pkgSrc) as { scripts?: Record<string, string> };
      const scripts = parsed.scripts ?? {};
      // The script may be wired into prebuild or its own task — accept
      // either as evidence of wiring.
      for (const [, value] of Object.entries(scripts)) {
        if (value.includes('build-marketplace-pages')) {
          wired = true;
          break;
        }
      }
      if (wired) {
        notes.push('build-marketplace-pages wired into apps/docs scripts');
      } else {
        notes.push('build-marketplace-pages not referenced in apps/docs/package.json scripts');
      }
    } catch {
      notes.push(`apps/docs/package.json failed to parse: ${docsPkgPath}`);
    }
  }
  const status: CategoryStatus =
    !fs.existsSync(buildScriptPath) || !wired ? 'fail' : 'pass';
  return { id: 4, title: 'Browsing UI', status, notes };
}

/**
 * Category 5 — `@stageflip/marketplace-telemetry-dashboard` exposes
 * the receiver + 6 first-party pack ids.
 */
export function checkTelemetryDashboard(opts: CheckOpts): CategoryResult {
  const fs = opts.fs ?? realFs();
  const pkg = join(opts.repoRoot, 'packages/marketplace-telemetry-dashboard');
  const indexPath = join(pkg, 'src/index.ts');
  const scopePath = join(pkg, 'src/first-party/scope.ts');
  const notes: string[] = [];

  if (!fs.existsSync(pkg)) {
    return {
      id: 5,
      title: 'Telemetry dashboard',
      status: 'fail',
      notes: [`package directory missing: ${pkg}`],
    };
  }
  const indexCheck = missingSymbols(fs, indexPath, [
    'createTelemetryReceiver',
    'FIRST_PARTY_PACK_IDS',
    'buildDashboardData',
  ]);
  if (indexCheck.fileMissing) notes.push(`index missing: ${indexPath}`);
  else if (indexCheck.missing.length > 0)
    notes.push(`exported symbols missing: ${indexCheck.missing.join(', ')}`);
  else notes.push('index exports receiver + scope + dashboard shaper');

  const scopeSrc = readIfExists(fs, scopePath);
  let scopeFail = false;
  if (scopeSrc === undefined) {
    scopeFail = true;
    notes.push(`scope module missing: ${scopePath}`);
  } else {
    // Count packId entries in FIRST_PARTY_PACK_IDS — each first-party
    // launch pack is one `packId: '...'` literal.
    const matches = scopeSrc.match(/packId:\s*'/g) ?? [];
    if (matches.length !== 6) {
      scopeFail = true;
      notes.push(`expected 6 entries in FIRST_PARTY_PACK_IDS, found ${matches.length}`);
    } else {
      notes.push('FIRST_PARTY_PACK_IDS has 6 entries');
    }
  }
  const status: CategoryStatus =
    indexCheck.fileMissing || indexCheck.missing.length > 0 || scopeFail ? 'fail' : 'pass';
  return { id: 5, title: 'Telemetry dashboard', status, notes };
}

/**
 * Category 6 — `@stageflip/marketplace-tier` exposes the resolver +
 * gate, and `DEFAULT_TIER_LIMITS` carries the four tiers
 * (`none`, `free`, `paid`, `enterprise`).
 */
export function checkTierSystem(opts: CheckOpts): CategoryResult {
  const fs = opts.fs ?? realFs();
  const pkg = join(opts.repoRoot, 'packages/marketplace-tier');
  const indexPath = join(pkg, 'src/index.ts');
  const limitsPath = join(pkg, 'src/limits/tier-limits.ts');
  const notes: string[] = [];

  if (!fs.existsSync(pkg)) {
    return {
      id: 6,
      title: 'Tier system',
      status: 'fail',
      notes: [`package directory missing: ${pkg}`],
    };
  }
  const indexCheck = missingSymbols(fs, indexPath, [
    'resolveTenantTier',
    'tierGate',
    'DEFAULT_TIER_LIMITS',
  ]);
  if (indexCheck.fileMissing) notes.push(`index missing: ${indexPath}`);
  else if (indexCheck.missing.length > 0)
    notes.push(`exported symbols missing: ${indexCheck.missing.join(', ')}`);
  else notes.push('index exports resolveTenantTier + tierGate + DEFAULT_TIER_LIMITS');

  const limitsSrc = readIfExists(fs, limitsPath);
  let limitsFail = false;
  if (limitsSrc === undefined) {
    limitsFail = true;
    notes.push(`limits module missing: ${limitsPath}`);
  } else {
    const tiers = ['none:', 'free:', 'paid:', 'enterprise:'];
    const missing = tiers.filter((k) => !limitsSrc.includes(k));
    if (missing.length > 0) {
      limitsFail = true;
      notes.push(`DEFAULT_TIER_LIMITS missing tier keys: ${missing.join(', ')}`);
    } else {
      notes.push('DEFAULT_TIER_LIMITS has 4 tiers (none/free/paid/enterprise)');
    }
  }
  const status: CategoryStatus =
    indexCheck.fileMissing || indexCheck.missing.length > 0 || limitsFail ? 'fail' : 'pass';
  return { id: 6, title: 'Tier system', status, notes };
}

/**
 * Category 7 — `@stageflip/marketplace-conversion` exposes the
 * planner + the default churn strategy with sensible bounds.
 */
export function checkConversionFlow(opts: CheckOpts): CategoryResult {
  const fs = opts.fs ?? realFs();
  const pkg = join(opts.repoRoot, 'packages/marketplace-conversion');
  const indexPath = join(pkg, 'src/index.ts');
  const strategyPath = join(pkg, 'src/churn/strategy.ts');
  const notes: string[] = [];

  if (!fs.existsSync(pkg)) {
    return {
      id: 7,
      title: 'Conversion flow',
      status: 'fail',
      notes: [`package directory missing: ${pkg}`],
    };
  }
  const indexCheck = missingSymbols(fs, indexPath, [
    'planConversion',
    'DEFAULT_CHURN_STRATEGY',
    'ConversionMetricsTracker',
  ]);
  if (indexCheck.fileMissing) notes.push(`index missing: ${indexPath}`);
  else if (indexCheck.missing.length > 0)
    notes.push(`exported symbols missing: ${indexCheck.missing.join(', ')}`);
  else notes.push('index exports planConversion + DEFAULT_CHURN_STRATEGY + metrics tracker');

  const strategySrc = readIfExists(fs, strategyPath);
  let strategyFail = false;
  if (strategySrc === undefined) {
    strategyFail = true;
    notes.push(`strategy module missing: ${strategyPath}`);
  } else {
    const requiredKeys = ['maxRetries:', 'baseBackoffMs:', 'maxBackoffMs:', 'nextBackoff:'];
    const missing = requiredKeys.filter((k) => !strategySrc.includes(k));
    if (missing.length > 0) {
      strategyFail = true;
      notes.push(`DEFAULT_CHURN_STRATEGY missing keys: ${missing.join(', ')}`);
    } else {
      notes.push('DEFAULT_CHURN_STRATEGY carries retry + backoff bounds');
    }
  }
  const status: CategoryStatus =
    indexCheck.fileMissing || indexCheck.missing.length > 0 || strategyFail ? 'fail' : 'pass';
  return { id: 7, title: 'Conversion flow', status, notes };
}

/**
 * Category 8 — `@stageflip/marketplace-refunds` exposes the refund
 * processor + dispute handler + the default refund policy with the
 * 7 / 30 / 60-day windows per ADR-013 §D11.
 */
export function checkRefundsAndDisputes(opts: CheckOpts): CategoryResult {
  const fs = opts.fs ?? realFs();
  const pkg = join(opts.repoRoot, 'packages/marketplace-refunds');
  const indexPath = join(pkg, 'src/index.ts');
  const policyPath = join(pkg, 'src/policy/refund-policy.ts');
  const notes: string[] = [];

  if (!fs.existsSync(pkg)) {
    return {
      id: 8,
      title: 'Refund / dispute orchestration',
      status: 'fail',
      notes: [`package directory missing: ${pkg}`],
    };
  }
  const indexCheck = missingSymbols(fs, indexPath, [
    'processRefund',
    'handleDispute',
    'buildDisputeEvidence',
    'DEFAULT_REFUND_POLICY',
  ]);
  if (indexCheck.fileMissing) notes.push(`index missing: ${indexPath}`);
  else if (indexCheck.missing.length > 0)
    notes.push(`exported symbols missing: ${indexCheck.missing.join(', ')}`);
  else notes.push('index exports processor + dispute + evidence + DEFAULT_REFUND_POLICY');

  const policySrc = readIfExists(fs, policyPath);
  let policyFail = false;
  if (policySrc === undefined) {
    policyFail = true;
    notes.push(`policy module missing: ${policyPath}`);
  } else {
    const expected = [
      ['DEFAULT_FULL_REFUND_WINDOW_DAYS = 7', 'fullRefundWindowDays = 7 day window'],
      ['DEFAULT_PRO_RATA_REFUND_WINDOW_DAYS = 30', 'proRataRefundWindowDays = 30 day window'],
      ['DEFAULT_NO_REFUND_AFTER_DAYS = 60', 'noRefundAfterDays = 60 day cutoff'],
    ];
    const missing: string[] = [];
    for (const [needle, label] of expected) {
      if (!policySrc.includes(needle)) missing.push(label);
    }
    if (missing.length > 0) {
      policyFail = true;
      notes.push(`refund-policy missing windows: ${missing.join(', ')}`);
    } else {
      notes.push('DEFAULT_REFUND_POLICY carries 7 / 30 / 60-day windows');
    }
  }
  const status: CategoryStatus =
    indexCheck.fileMissing || indexCheck.missing.length > 0 || policyFail ? 'fail' : 'pass';
  return { id: 8, title: 'Refund / dispute orchestration', status, notes };
}

/**
 * Category 9 — `@stageflip/pack-parity-validator` exposes
 * `validatePackFixtures` + `DEFAULT_CLUSTER_THRESHOLDS` with 10
 * entries (clusters A–I + the `default` fallback row).
 */
export function checkParityValidator(opts: CheckOpts): CategoryResult {
  const fs = opts.fs ?? realFs();
  const pkg = join(opts.repoRoot, 'packages/pack-parity-validator');
  const indexPath = join(pkg, 'src/index.ts');
  const thresholdsPath = join(pkg, 'src/thresholds/cluster-thresholds.ts');
  const notes: string[] = [];

  if (!fs.existsSync(pkg)) {
    return {
      id: 9,
      title: 'Per-bundle parity validator',
      status: 'fail',
      notes: [`package directory missing: ${pkg}`],
    };
  }
  const indexCheck = missingSymbols(fs, indexPath, [
    'validatePackFixtures',
    'DEFAULT_CLUSTER_THRESHOLDS',
    'formatPackParityReport',
  ]);
  if (indexCheck.fileMissing) notes.push(`index missing: ${indexPath}`);
  else if (indexCheck.missing.length > 0)
    notes.push(`exported symbols missing: ${indexCheck.missing.join(', ')}`);
  else notes.push('index exports validator + thresholds + formatter');

  const thresholdsSrc = readIfExists(fs, thresholdsPath);
  let thresholdsFail = false;
  if (thresholdsSrc === undefined) {
    thresholdsFail = true;
    notes.push(`thresholds module missing: ${thresholdsPath}`);
  } else {
    const matches = thresholdsSrc.match(/clusterId:\s*'/g) ?? [];
    if (matches.length !== 10) {
      thresholdsFail = true;
      notes.push(`expected 10 entries in DEFAULT_CLUSTER_THRESHOLDS, found ${matches.length}`);
    } else {
      notes.push('DEFAULT_CLUSTER_THRESHOLDS has 10 entries (clusters a-i + default)');
    }
  }
  const status: CategoryStatus =
    indexCheck.fileMissing || indexCheck.missing.length > 0 || thresholdsFail ? 'fail' : 'pass';
  return { id: 9, title: 'Per-bundle parity validator', status, notes };
}

// ---------- Category 10 — legal-review sign-off ----------

/** A single clause heading parsed out of the legal-review document. */
export interface LegalClauseEntry {
  readonly name: string;
  /**
   * Either `pending-counsel-review` (forward-compat default) or
   * `signed:YYYY-MM-DD <signer>`. Anything else parses as `unknown`.
   */
  readonly status: 'pending' | 'signed' | 'unknown';
  readonly raw: string;
}

/**
 * Parse the legal-review document into one entry per `### Clause:`
 * heading. Each clause exposes its sign-off status by reading the
 * subsequent `- Status: ...` line. Clauses without a recognised
 * status string surface as `unknown` (treated like `pending`).
 *
 * Pure function — no I/O. Tests pass synthesized markdown directly.
 */
export function parseLegalReviewDoc(src: string): LegalClauseEntry[] {
  const out: LegalClauseEntry[] = [];
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined) continue;
    const headingMatch = line.match(/^###\s+Clause:\s+(.+?)\s*$/);
    if (!headingMatch) continue;
    const name = headingMatch[1] ?? '';
    // Find the first `- Status:` line in the next few lines (cap at 10
    // lines so a malformed block doesn't accidentally match the next
    // clause's status).
    let raw = '';
    let status: LegalClauseEntry['status'] = 'unknown';
    for (let j = i + 1; j < Math.min(i + 11, lines.length); j += 1) {
      const next = lines[j];
      if (next === undefined) continue;
      if (/^###\s+Clause:/.test(next)) break;
      const statusMatch = next.match(/^\s*-\s+Status:\s+(.+?)\s*$/);
      if (statusMatch) {
        raw = (statusMatch[1] ?? '').trim();
        // Strip surrounding backticks if present.
        const stripped = raw.replace(/^`|`$/g, '').trim();
        if (/^signed:\d{4}-\d{2}-\d{2}(\s.+)?$/.test(stripped)) {
          status = 'signed';
        } else if (stripped === 'pending-counsel-review') {
          status = 'pending';
        } else {
          status = 'unknown';
        }
        break;
      }
    }
    out.push({ name, status, raw });
  }
  return out;
}

/**
 * Category 10 — Legal-review sign-off check.
 *
 * Forward-compatible: unsigned clauses surface as `warn` by default;
 * the build only fails on those when `requireLegalSignoff` is true.
 * Missing clauses (i.e. required clauses not present in the doc at
 * all) always fail.
 */
export function checkLegalReview(opts: CheckOpts): CategoryResult {
  const fs = opts.fs ?? realFs();
  const docPath = join(opts.repoRoot, LEGAL_REVIEW_DOC_PATH);
  const notes: string[] = [];

  const src = readIfExists(fs, docPath);
  if (src === undefined) {
    return {
      id: 10,
      title: 'Legal-review sign-off',
      status: 'fail',
      notes: [`legal-review document missing: ${docPath}`],
    };
  }
  const entries = parseLegalReviewDoc(src);
  const byName = new Map<string, LegalClauseEntry>();
  for (const e of entries) byName.set(e.name, e);

  const missingClauses: string[] = [];
  const unsignedClauses: string[] = [];
  for (const required of REQUIRED_LEGAL_CLAUSES) {
    const entry = byName.get(required);
    if (entry === undefined) {
      missingClauses.push(required);
      continue;
    }
    if (entry.status !== 'signed') unsignedClauses.push(required);
  }

  if (missingClauses.length > 0) {
    notes.push(`missing required clauses: ${missingClauses.join(', ')}`);
  }
  if (unsignedClauses.length > 0) {
    notes.push(
      `unsigned clauses (${unsignedClauses.length}/${REQUIRED_LEGAL_CLAUSES.length}): ${unsignedClauses.join(', ')}`,
    );
  }
  if (missingClauses.length === 0 && unsignedClauses.length === 0) {
    notes.push(`all ${REQUIRED_LEGAL_CLAUSES.length} required clauses signed`);
  }

  let status: CategoryStatus;
  if (missingClauses.length > 0) {
    status = 'fail';
  } else if (unsignedClauses.length === 0) {
    status = 'pass';
  } else if (opts.requireLegalSignoff) {
    status = 'fail';
  } else {
    status = 'warn';
  }
  return { id: 10, title: 'Legal-review sign-off', status, notes };
}

// ---------- top-level runner ----------

/** Run every category audit and return the aggregated report. */
export function runAudit(opts: CheckOpts): AuditReport {
  const categories: CategoryResult[] = [
    checkRegistry(opts),
    checkStripe(opts),
    checkNpmPath(opts),
    checkBrowsingUi(opts),
    checkTelemetryDashboard(opts),
    checkTierSystem(opts),
    checkConversionFlow(opts),
    checkRefundsAndDisputes(opts),
    checkParityValidator(opts),
    checkLegalReview(opts),
  ];
  return { categories, requireLegalSignoff: opts.requireLegalSignoff };
}

/**
 * Whole-report exit code. `1` if any category failed; `0` if all
 * passed or only warned. Warnings never gate the build.
 */
export function reportExitCode(report: AuditReport): 0 | 1 {
  for (const c of report.categories) {
    if (c.status === 'fail') return 1;
  }
  return 0;
}

/** Render the report as a multi-line stdout summary. */
export function formatReport(report: AuditReport): string {
  const lines: string[] = [];
  lines.push('check-marketplace-ga-readiness:');
  let pass = 0;
  let warn = 0;
  let fail = 0;
  for (const c of report.categories) {
    const tag = c.status.toUpperCase();
    lines.push(`  [${tag}] ${c.id}. ${c.title}`);
    for (const note of c.notes) {
      lines.push(`        ${note}`);
    }
    if (c.status === 'pass') pass += 1;
    else if (c.status === 'warn') warn += 1;
    else fail += 1;
  }
  lines.push(
    `  summary: ${pass} pass / ${warn} warn / ${fail} fail (legal-signoff required: ${report.requireLegalSignoff ? 'yes' : 'no'})`,
  );
  return `${lines.join('\n')}\n`;
}

// ---------- CLI ----------

/* v8 ignore start */
// `main()` + the CLI guard are exercised by hand + via the wrapped
// pnpm script — coverage is collected through the unit tests on the
// pure helpers above.

export function parseArgv(argv: readonly string[]): {
  repoRoot: string;
  requireLegalSignoff: boolean;
} {
  let repoRoot = process.cwd();
  let requireLegalSignoff = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--require-legal-signoff') {
      requireLegalSignoff = true;
    } else if (arg === '--repo-root') {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error('--repo-root requires a path argument');
      }
      repoRoot = next;
      i += 1;
    }
  }
  return { repoRoot, requireLegalSignoff };
}

function main(): void {
  const { repoRoot, requireLegalSignoff } = parseArgv(process.argv.slice(2));
  const report = runAudit({ repoRoot, requireLegalSignoff });
  process.stdout.write(formatReport(report));
  process.exit(reportExitCode(report));
}

const __thisFile = fileURLToPath(import.meta.url);
const argvEntry = process.argv[1] ? resolve(process.argv[1]) : '';
const moduleEntry = resolve(__thisFile);
if (
  argvEntry === moduleEntry ||
  argvEntry === resolve(dirname(moduleEntry), 'check-marketplace-ga-readiness.ts')
) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`check-marketplace-ga-readiness: crashed: ${String(err)}\n`);
    if (err instanceof Error && err.stack) process.stderr.write(`${err.stack}\n`);
    process.exit(2);
  }
}
/* v8 ignore stop */
