// scripts/check-marketplace-ga-readiness.test.ts
// T-550 — Tests for the marketplace GA-readiness audit. Each
// category gets at least one positive + one negative path; the
// legal-review parser is exercised against synthesized markdown so
// the tests need no on-disk fixture.
//
// All checks accept an injected `FsShim`; tests build a tiny in-
// memory filesystem so the real packages/* tree is irrelevant.

import { describe, expect, it } from 'vitest';

import {
  type CheckOpts,
  type FsShim,
  REQUIRED_LEGAL_CLAUSES,
  checkBrowsingUi,
  checkConversionFlow,
  checkLegalReview,
  checkNpmPath,
  checkParityValidator,
  checkRefundsAndDisputes,
  checkRegistry,
  checkStripe,
  checkTelemetryDashboard,
  checkTierSystem,
  formatReport,
  parseArgv,
  parseLegalReviewDoc,
  reportExitCode,
  runAudit,
} from './check-marketplace-ga-readiness.js';

// ---------- in-memory fs shim ----------

function makeFs(entries: Record<string, string>): FsShim {
  const files = new Map<string, string>(Object.entries(entries));
  const dirs = new Set<string>();
  for (const filePath of files.keys()) {
    const parts = filePath.split('/');
    for (let i = 1; i < parts.length; i += 1) {
      dirs.add(parts.slice(0, i).join('/'));
    }
  }

  return {
    existsSync(path: string): boolean {
      return files.has(path) || dirs.has(path);
    },
    readFileSync(path: string): string {
      const value = files.get(path);
      if (value === undefined) {
        throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
      }
      return value;
    },
    readdirSync(path: string): string[] {
      const prefix = `${path}/`;
      const out = new Set<string>();
      for (const key of [...files.keys(), ...dirs]) {
        if (!key.startsWith(prefix)) continue;
        const next = key.slice(prefix.length).split('/')[0];
        if (next !== undefined && next.length > 0) out.add(next);
      }
      return [...out].sort();
    },
    statSync(path: string): { isDirectory(): boolean; isFile(): boolean } {
      const isDir = dirs.has(path);
      const isFile = files.has(path);
      if (!isDir && !isFile) {
        throw Object.assign(new Error(`ENOENT: ${path}`), { code: 'ENOENT' });
      }
      return { isDirectory: () => isDir, isFile: () => isFile };
    },
  };
}

const REPO = '/repo';

function opts(fs: FsShim, requireLegalSignoff = false): CheckOpts {
  return { repoRoot: REPO, requireLegalSignoff, fs };
}

// ---------- factory helpers ----------

function fullyHealthyFs(): FsShim {
  return makeFs({
    // Registry
    [`${REPO}/packages/marketplace-registry/src/index.ts`]:
      'export { composeHandler, createInMemoryRegistry } from "./handler.js";\nexport { createPublishHandler } from "./routes/publish.js";\nexport { createListHandler } from "./routes/list.js";\nexport { createDownloadHandler } from "./routes/download.js";\n',
    [`${REPO}/packages/marketplace-registry/src/handler.test.ts`]: '// test',
    // Stripe
    [`${REPO}/packages/marketplace-stripe/src/index.ts`]:
      'export { FIRST_PARTY_SKU_MAP } from "./pricing/sku-map.js";\nexport { composeWebhookHandler } from "./handler.js";\nexport { verifyStripeSignature } from "./webhooks/signature.js";\n',
    [`${REPO}/packages/marketplace-stripe/src/pricing/sku-map.ts`]:
      "export const FIRST_PARTY_SKU_MAP = [\n  { sku: 'a-1y' },\n  { sku: 'b-1y' },\n  { sku: 'c-1y' },\n  { sku: 'd-1y' },\n  { sku: 'e-1y' },\n  { sku: 'f-1y' },\n];\n",
    [`${REPO}/packages/marketplace-stripe/src/handler.test.ts`]: '// test',
    // npm
    [`${REPO}/packages/marketplace-npm/src/index.ts`]:
      'export { verifyLicenseClaim } from "./verifier/license-verifier.js";\nexport { createSidecarClient } from "./sidecar/sidecar-client.js";\nexport { InMemoryNpmTokenStore } from "./tokens/token-store.js";\n',
    [`${REPO}/packages/pack-format/src/loss-flags.ts`]:
      "export const PACK_FORMAT_LF_CODES = ['LF-NPM-TOKEN-MISSING'] as const;\n",
    // Browsing UI
    [`${REPO}/apps/docs/scripts/build-marketplace-pages.ts`]: '// build',
    [`${REPO}/apps/docs/package.json`]: JSON.stringify({
      name: '@stageflip/app-docs',
      scripts: {
        prebuild: 'tsx scripts/build-skill-pages.ts && tsx scripts/build-marketplace-pages.ts',
      },
    }),
    // Telemetry dashboard
    [`${REPO}/packages/marketplace-telemetry-dashboard/src/index.ts`]:
      'export { createTelemetryReceiver } from "./events/receiver.js";\nexport { FIRST_PARTY_PACK_IDS } from "./first-party/scope.js";\nexport { buildDashboardData } from "./dashboard/shape.js";\n',
    [`${REPO}/packages/marketplace-telemetry-dashboard/src/first-party/scope.ts`]:
      "export const FIRST_PARTY_PACK_IDS = [\n  { publisherId: 'sf', packId: 'a' },\n  { publisherId: 'sf', packId: 'b' },\n  { publisherId: 'sf', packId: 'c' },\n  { publisherId: 'sf', packId: 'd' },\n  { publisherId: 'sf', packId: 'e' },\n  { publisherId: 'sf', packId: 'f' },\n];\n",
    // Tier system
    [`${REPO}/packages/marketplace-tier/src/index.ts`]:
      'export { resolveTenantTier } from "./resolver/tier-resolver.js";\nexport { tierGate } from "./gate/tier-gate.js";\nexport { DEFAULT_TIER_LIMITS } from "./limits/tier-limits.js";\n',
    [`${REPO}/packages/marketplace-tier/src/limits/tier-limits.ts`]:
      'export const DEFAULT_TIER_LIMITS = {\n  none: {},\n  free: {},\n  paid: {},\n  enterprise: {},\n};\n',
    // Conversion flow
    [`${REPO}/packages/marketplace-conversion/src/index.ts`]:
      'export { planConversion } from "./planner/conversion-planner.js";\nexport { DEFAULT_CHURN_STRATEGY } from "./churn/strategy.js";\nexport { ConversionMetricsTracker } from "./metrics/tracker.js";\n',
    [`${REPO}/packages/marketplace-conversion/src/churn/strategy.ts`]:
      'export const DEFAULT_CHURN_STRATEGY = {\n  maxRetries: 3,\n  baseBackoffMs: 1000,\n  maxBackoffMs: 86400000,\n  nextBackoff: (n: number) => n,\n};\n',
    // Refunds
    [`${REPO}/packages/marketplace-refunds/src/index.ts`]:
      'export { processRefund } from "./refunds/request.js";\nexport { handleDispute } from "./disputes/handler.js";\nexport { buildDisputeEvidence } from "./disputes/response-builder.js";\nexport { DEFAULT_REFUND_POLICY } from "./policy/refund-policy.js";\n',
    [`${REPO}/packages/marketplace-refunds/src/policy/refund-policy.ts`]:
      'export const DEFAULT_FULL_REFUND_WINDOW_DAYS = 7;\nexport const DEFAULT_PRO_RATA_REFUND_WINDOW_DAYS = 30;\nexport const DEFAULT_NO_REFUND_AFTER_DAYS = 60;\nexport const DEFAULT_REFUND_POLICY = {};\n',
    // Parity validator
    [`${REPO}/packages/pack-parity-validator/src/index.ts`]:
      'export { validatePackFixtures } from "./validator/validate-pack.js";\nexport { DEFAULT_CLUSTER_THRESHOLDS } from "./thresholds/cluster-thresholds.js";\nexport { formatPackParityReport } from "./report/parity-report.js";\n',
    [`${REPO}/packages/pack-parity-validator/src/thresholds/cluster-thresholds.ts`]:
      "export const DEFAULT_CLUSTER_THRESHOLDS = [\n  { clusterId: 'cluster-a' },\n  { clusterId: 'cluster-b' },\n  { clusterId: 'cluster-c' },\n  { clusterId: 'cluster-d' },\n  { clusterId: 'cluster-e' },\n  { clusterId: 'cluster-f' },\n  { clusterId: 'cluster-g' },\n  { clusterId: 'cluster-h' },\n  { clusterId: 'cluster-i' },\n  { clusterId: 'default' },\n];\n",
  });
}

function fullySignedLegalDoc(): string {
  const blocks = REQUIRED_LEGAL_CLAUSES.map(
    (name) =>
      `### Clause: ${name}\n- Status: \`signed:2026-05-14 Mario Tiedemann\`\n- Owner: counsel\n- Notes: ok\n`,
  ).join('\n');
  return `# Marketplace Legal Review\n\n${blocks}`;
}

function pendingLegalDoc(): string {
  const blocks = REQUIRED_LEGAL_CLAUSES.map(
    (name) =>
      `### Clause: ${name}\n- Status: \`pending-counsel-review\`\n- Owner: counsel\n- Notes: tbd\n`,
  ).join('\n');
  return `# Marketplace Legal Review\n\n${blocks}`;
}

// ============================================================
// Category checks — happy path
// ============================================================

describe('checkRegistry', () => {
  it('passes when index + handler-test exist with expected exports', () => {
    const r = checkRegistry(opts(fullyHealthyFs()));
    expect(r.status).toBe('pass');
    expect(r.title).toBe('Registry library');
  });

  it('fails when the package directory is missing', () => {
    const r = checkRegistry(opts(makeFs({ '/repo/README.md': 'x' })));
    expect(r.status).toBe('fail');
    expect(r.notes.join(' ')).toContain('package directory missing');
  });

  it('fails when index is missing the composed-handler export', () => {
    const stripped = makeFs({
      [`${REPO}/packages/marketplace-registry/src/index.ts`]:
        'export {} from "./handler.js";',
      [`${REPO}/packages/marketplace-registry/src/handler.test.ts`]: '// test',
    });
    const r = checkRegistry(opts(stripped));
    expect(r.status).toBe('fail');
    expect(r.notes.join(' ')).toContain('exported symbols missing');
  });
});

describe('checkStripe', () => {
  it('passes with 6 SKUs + composed handler + signature verifier', () => {
    expect(checkStripe(opts(fullyHealthyFs())).status).toBe('pass');
  });

  it('fails when SKU map has the wrong count', () => {
    const fs = makeFs({
      [`${REPO}/packages/marketplace-stripe/src/index.ts`]:
        'export { FIRST_PARTY_SKU_MAP, composeWebhookHandler, verifyStripeSignature } from "./x.js";',
      [`${REPO}/packages/marketplace-stripe/src/pricing/sku-map.ts`]:
        "export const FIRST_PARTY_SKU_MAP = [{ sku: 'a-1y' }, { sku: 'b-1y' }];\n",
      [`${REPO}/packages/marketplace-stripe/src/handler.test.ts`]: '// test',
    });
    const r = checkStripe(opts(fs));
    expect(r.status).toBe('fail');
    expect(r.notes.join(' ')).toContain('expected 6 first-party SKU mappings, found 2');
  });
});

describe('checkNpmPath', () => {
  it('passes with verifier + sidecar + LF-NPM-TOKEN-MISSING in the catalogue', () => {
    expect(checkNpmPath(opts(fullyHealthyFs())).status).toBe('pass');
  });

  it('fails when LF-NPM-TOKEN-MISSING is missing from the loss-flags catalogue', () => {
    const broken = makeFs({
      [`${REPO}/packages/marketplace-npm/src/index.ts`]:
        'export { verifyLicenseClaim, createSidecarClient, InMemoryNpmTokenStore } from "./x.js";',
      [`${REPO}/packages/pack-format/src/loss-flags.ts`]: 'export const X = 1;\n',
    });
    const r = checkNpmPath(opts(broken));
    expect(r.status).toBe('fail');
    expect(r.notes.join(' ')).toContain('LF-NPM-TOKEN-MISSING not present');
  });
});

describe('checkBrowsingUi', () => {
  it('passes when build script + package.json wiring are present', () => {
    expect(checkBrowsingUi(opts(fullyHealthyFs())).status).toBe('pass');
  });

  it('fails when build script is missing', () => {
    const fs = makeFs({
      [`${REPO}/apps/docs/package.json`]: JSON.stringify({
        scripts: { prebuild: 'tsx scripts/build-marketplace-pages.ts' },
      }),
    });
    expect(checkBrowsingUi(opts(fs)).status).toBe('fail');
  });

  it('fails when package.json does not reference build-marketplace-pages', () => {
    const fs = makeFs({
      [`${REPO}/apps/docs/scripts/build-marketplace-pages.ts`]: '// build',
      [`${REPO}/apps/docs/package.json`]: JSON.stringify({ scripts: { build: 'astro build' } }),
    });
    expect(checkBrowsingUi(opts(fs)).status).toBe('fail');
  });
});

describe('checkTelemetryDashboard', () => {
  it('passes with receiver + 6 first-party pack ids', () => {
    expect(checkTelemetryDashboard(opts(fullyHealthyFs())).status).toBe('pass');
  });

  it('fails when FIRST_PARTY_PACK_IDS does not have 6 entries', () => {
    const fs = makeFs({
      [`${REPO}/packages/marketplace-telemetry-dashboard/src/index.ts`]:
        'export { createTelemetryReceiver, FIRST_PARTY_PACK_IDS, buildDashboardData } from "./x.js";',
      [`${REPO}/packages/marketplace-telemetry-dashboard/src/first-party/scope.ts`]:
        "export const FIRST_PARTY_PACK_IDS = [{ publisherId: 'sf', packId: 'only-one' }];",
    });
    const r = checkTelemetryDashboard(opts(fs));
    expect(r.status).toBe('fail');
    expect(r.notes.join(' ')).toContain('found 1');
  });
});

describe('checkTierSystem', () => {
  it('passes with 4 tier keys', () => {
    expect(checkTierSystem(opts(fullyHealthyFs())).status).toBe('pass');
  });

  it('fails when the enterprise tier is missing', () => {
    const fs = makeFs({
      [`${REPO}/packages/marketplace-tier/src/index.ts`]:
        'export { resolveTenantTier, tierGate, DEFAULT_TIER_LIMITS } from "./x.js";',
      [`${REPO}/packages/marketplace-tier/src/limits/tier-limits.ts`]:
        'export const DEFAULT_TIER_LIMITS = { none: {}, free: {}, paid: {} };',
    });
    const r = checkTierSystem(opts(fs));
    expect(r.status).toBe('fail');
    expect(r.notes.join(' ')).toContain('enterprise');
  });
});

describe('checkConversionFlow', () => {
  it('passes when default churn strategy carries retry + backoff bounds', () => {
    expect(checkConversionFlow(opts(fullyHealthyFs())).status).toBe('pass');
  });

  it('fails when churn strategy is missing nextBackoff', () => {
    const fs = makeFs({
      [`${REPO}/packages/marketplace-conversion/src/index.ts`]:
        'export { planConversion, DEFAULT_CHURN_STRATEGY, ConversionMetricsTracker } from "./x.js";',
      [`${REPO}/packages/marketplace-conversion/src/churn/strategy.ts`]:
        'export const DEFAULT_CHURN_STRATEGY = { maxRetries: 3, baseBackoffMs: 1, maxBackoffMs: 2 };',
    });
    const r = checkConversionFlow(opts(fs));
    expect(r.status).toBe('fail');
    expect(r.notes.join(' ')).toContain('nextBackoff');
  });
});

describe('checkRefundsAndDisputes', () => {
  it('passes with 7 / 30 / 60-day refund windows', () => {
    expect(checkRefundsAndDisputes(opts(fullyHealthyFs())).status).toBe('pass');
  });

  it('fails when one of the refund windows is missing', () => {
    const fs = makeFs({
      [`${REPO}/packages/marketplace-refunds/src/index.ts`]:
        'export { processRefund, handleDispute, buildDisputeEvidence, DEFAULT_REFUND_POLICY } from "./x.js";',
      [`${REPO}/packages/marketplace-refunds/src/policy/refund-policy.ts`]:
        'export const DEFAULT_FULL_REFUND_WINDOW_DAYS = 7;\nexport const DEFAULT_PRO_RATA_REFUND_WINDOW_DAYS = 30;\nexport const DEFAULT_REFUND_POLICY = {};',
    });
    const r = checkRefundsAndDisputes(opts(fs));
    expect(r.status).toBe('fail');
    expect(r.notes.join(' ')).toContain('60 day cutoff');
  });
});

describe('checkParityValidator', () => {
  it('passes with 10 cluster threshold rows', () => {
    expect(checkParityValidator(opts(fullyHealthyFs())).status).toBe('pass');
  });

  it('fails when threshold count is wrong', () => {
    const fs = makeFs({
      [`${REPO}/packages/pack-parity-validator/src/index.ts`]:
        'export { validatePackFixtures, DEFAULT_CLUSTER_THRESHOLDS, formatPackParityReport } from "./x.js";',
      [`${REPO}/packages/pack-parity-validator/src/thresholds/cluster-thresholds.ts`]:
        "export const DEFAULT_CLUSTER_THRESHOLDS = [{ clusterId: 'cluster-a' }, { clusterId: 'default' }];",
    });
    const r = checkParityValidator(opts(fs));
    expect(r.status).toBe('fail');
    expect(r.notes.join(' ')).toContain('found 2');
  });
});

// ============================================================
// Legal-review parser + check
// ============================================================

describe('parseLegalReviewDoc', () => {
  it('parses signed clauses', () => {
    const doc = '### Clause: Terms of Service\n- Status: `signed:2026-05-14 Counsel`\n- Owner: c\n';
    const entries = parseLegalReviewDoc(doc);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.status).toBe('signed');
    expect(entries[0]?.name).toBe('Terms of Service');
  });

  it('parses pending clauses', () => {
    const doc = '### Clause: Privacy Policy\n- Status: `pending-counsel-review`\n';
    const entries = parseLegalReviewDoc(doc);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.status).toBe('pending');
  });

  it('treats unrecognised statuses as unknown', () => {
    const doc = '### Clause: Foo\n- Status: maybe\n';
    const entries = parseLegalReviewDoc(doc);
    expect(entries[0]?.status).toBe('unknown');
  });

  it('returns empty when no clause headings exist', () => {
    expect(parseLegalReviewDoc('# Heading\n- not a clause\n')).toEqual([]);
  });
});

describe('checkLegalReview', () => {
  it('fails when the document is missing entirely', () => {
    const r = checkLegalReview(opts(makeFs({ [`${REPO}/README.md`]: 'x' })));
    expect(r.status).toBe('fail');
    expect(r.notes.join(' ')).toContain('legal-review document missing');
  });

  it('passes when every required clause is signed', () => {
    const fs = makeFs({
      [`${REPO}/docs/legal-review-marketplace.md`]: fullySignedLegalDoc(),
    });
    const r = checkLegalReview(opts(fs));
    expect(r.status).toBe('pass');
    expect(r.notes.join(' ')).toContain(`all ${REQUIRED_LEGAL_CLAUSES.length} required clauses signed`);
  });

  it('warns when clauses are pending and --require-legal-signoff is OFF (forward-compat mode)', () => {
    const fs = makeFs({
      [`${REPO}/docs/legal-review-marketplace.md`]: pendingLegalDoc(),
    });
    const r = checkLegalReview(opts(fs, false));
    expect(r.status).toBe('warn');
    expect(r.notes.join(' ')).toContain('unsigned clauses');
  });

  it('fails when clauses are pending and --require-legal-signoff is ON', () => {
    const fs = makeFs({
      [`${REPO}/docs/legal-review-marketplace.md`]: pendingLegalDoc(),
    });
    const r = checkLegalReview(opts(fs, true));
    expect(r.status).toBe('fail');
  });

  it('fails when a required clause is missing entirely', () => {
    const fs = makeFs({
      [`${REPO}/docs/legal-review-marketplace.md`]:
        '### Clause: Terms of Service\n- Status: `signed:2026-05-14 Counsel`\n',
    });
    const r = checkLegalReview(opts(fs));
    expect(r.status).toBe('fail');
    expect(r.notes.join(' ')).toContain('missing required clauses');
  });
});

// ============================================================
// Aggregate runner
// ============================================================

describe('runAudit + reportExitCode', () => {
  it('returns 10 categories', () => {
    const fs = makeFs({});
    const report = runAudit(opts(fs));
    expect(report.categories).toHaveLength(10);
    expect(report.categories.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('exit code 1 on any failure', () => {
    const fs = makeFs({});
    const report = runAudit(opts(fs));
    expect(reportExitCode(report)).toBe(1);
  });

  it('exit code 0 when only warnings (forward-compat legal mode)', () => {
    const entries: Record<string, string> = {};
    // Build a fully-healthy tree but with a pending legal doc.
    const healthy = fullyHealthyFs();
    const probePaths = [
      `${REPO}/packages/marketplace-registry/src/index.ts`,
      `${REPO}/packages/marketplace-registry/src/handler.test.ts`,
      `${REPO}/packages/marketplace-stripe/src/index.ts`,
      `${REPO}/packages/marketplace-stripe/src/pricing/sku-map.ts`,
      `${REPO}/packages/marketplace-stripe/src/handler.test.ts`,
      `${REPO}/packages/marketplace-npm/src/index.ts`,
      `${REPO}/packages/pack-format/src/loss-flags.ts`,
      `${REPO}/apps/docs/scripts/build-marketplace-pages.ts`,
      `${REPO}/apps/docs/package.json`,
      `${REPO}/packages/marketplace-telemetry-dashboard/src/index.ts`,
      `${REPO}/packages/marketplace-telemetry-dashboard/src/first-party/scope.ts`,
      `${REPO}/packages/marketplace-tier/src/index.ts`,
      `${REPO}/packages/marketplace-tier/src/limits/tier-limits.ts`,
      `${REPO}/packages/marketplace-conversion/src/index.ts`,
      `${REPO}/packages/marketplace-conversion/src/churn/strategy.ts`,
      `${REPO}/packages/marketplace-refunds/src/index.ts`,
      `${REPO}/packages/marketplace-refunds/src/policy/refund-policy.ts`,
      `${REPO}/packages/pack-parity-validator/src/index.ts`,
      `${REPO}/packages/pack-parity-validator/src/thresholds/cluster-thresholds.ts`,
    ];
    for (const p of probePaths) entries[p] = healthy.readFileSync(p);
    entries[`${REPO}/docs/legal-review-marketplace.md`] = pendingLegalDoc();
    const fs = makeFs(entries);

    const report = runAudit(opts(fs, false));
    expect(reportExitCode(report)).toBe(0);
    const legal = report.categories.find((c) => c.id === 10);
    expect(legal?.status).toBe('warn');
  });

  it('formats a multi-line summary', () => {
    const fs = makeFs({});
    const report = runAudit(opts(fs));
    const out = formatReport(report);
    expect(out).toContain('check-marketplace-ga-readiness:');
    expect(out).toContain('summary:');
    expect(out).toContain('legal-signoff required: no');
  });
});

// ============================================================
// CLI arg parsing
// ============================================================

describe('parseArgv', () => {
  it('defaults to no legal-signoff requirement', () => {
    expect(parseArgv([]).requireLegalSignoff).toBe(false);
  });

  it('flips on --require-legal-signoff', () => {
    expect(parseArgv(['--require-legal-signoff']).requireLegalSignoff).toBe(true);
  });

  it('honours --repo-root', () => {
    expect(parseArgv(['--repo-root', '/tmp/x']).repoRoot).toBe('/tmp/x');
  });

  it('throws when --repo-root is missing its value', () => {
    expect(() => parseArgv(['--repo-root'])).toThrow(/--repo-root requires/);
  });
});
