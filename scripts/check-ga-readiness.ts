// scripts/check-ga-readiness.ts
// Phase δ Lock-in audit (T-410 + T-447) — programmatic GA-readiness
// checklist pass.
//
// Walks the system, verifies a defined checklist of criteria spanning
// cluster ratification, CI gates, documentation, frontier runtime,
// enterprise admin, Phase 13 closeout, and (T-447) Phase 14 GA
// readiness, and emits a markdown report enumerating
// PASS / FAIL / WARN / N/A for every criterion.
//
// The output is a GAP LIST the orchestrator uses as the GA punch list.
// T-410 is NOT a CI gate — it is a manual audit invoked at phase
// boundaries. The committed `docs/ga-readiness-report.md` reflects the
// state at PR-creation time.
//
// Pure script: input = filesystem (preset markdown corpus, ADR files,
// CI workflow, package.json, the on-disk packages/runtimes/interactive
// layout), output = stdout summary + the rendered markdown report
// written to disk, plus an exit code (0 = no FAIL criteria; 1 = any
// FAIL). WARN does NOT affect exit code (a qualified pass is still a
// pass).
//
// Mirrors `check-cluster-eligibility.ts` and `check-export-parity.ts`
// posture: pure-function helpers under unit test, a thin CLI shell at
// the bottom that does I/O.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadAllPresets, resetLoaderCache } from '../packages/schema/src/presets/loader.js';

// ---------- script-level constants ----------

const PRESETS_ROOT_DEFAULT = 'skills/stageflip/presets';
const REPORT_OUT_DEFAULT = 'docs/ga-readiness-report.md';

/** All 8 cluster names, ordered A-H. */
const ALL_CLUSTER_NAMES = [
  'news',
  'sports',
  'weather',
  'titles',
  'data',
  'captions',
  'ctas',
  'ar',
] as const;
type ClusterName = (typeof ALL_CLUSTER_NAMES)[number];

/**
 * Cluster-compose bundles expected in `CANONICAL_BUNDLES`. Cluster D
 * (titles) is excluded by design (titles ship as-is per the original
 * plan; no compose tools).
 */
const EXPECTED_COMPOSE_BUNDLES = [
  'cluster-a-compose',
  'cluster-b-compose',
  'cluster-c-compose',
  'cluster-e-compose',
  'cluster-f-compose',
  'cluster-g-compose',
  'cluster-h-compose',
] as const;

/**
 * `pnpm check-*` script entries expected to exist in root package.json
 * AND have a backing `scripts/<name>.ts` file on disk AND be wired
 * into `.github/workflows/ci.yml`. Lifted from the actual current
 * shape of CI; this is the gate-PRESENCE audit, not an execution audit.
 */
const EXPECTED_CHECK_GATES = [
  { script: 'check-licenses', file: 'check-licenses.ts', ciStep: 'Gate - licenses' },
  {
    script: 'check-remotion-imports',
    file: 'check-remotion-imports.ts',
    ciStep: 'Gate - Remotion import ban',
  },
  { script: 'check-skill-drift', file: 'check-skill-drift.ts', ciStep: 'Gate - skill drift' },
  {
    script: 'check-determinism',
    file: 'check-determinism.ts',
    ciStep: 'Gate - determinism (scoped to clip/runtime code)',
  },
  {
    script: 'check-export-parity',
    file: 'check-export-parity.ts',
    ciStep: 'Gate - preset x export parity',
  },
] as const;

/**
 * Frontier clip directories expected under
 * `packages/runtimes/interactive/src/clips/`, per ADR-005 §D2 catalogue.
 */
const EXPECTED_FRONTIER_CLIPS = [
  'ai-chat',
  'ai-generative',
  'live-data',
  'shader',
  'three-scene',
  'voice',
  'web-embed',
] as const;

/**
 * Track A finale task ids (per `docs/handover-phase13-all-clusters-eligible.md`
 * §5.2). Each task gates one slice of live-mount support. Spec docs
 * may not exist yet — that's the point of the audit.
 */
const TRACK_A_FINALE_TASKS = [
  'T-397',
  'T-398',
  'T-399',
  'T-400',
  'T-401',
  'T-402',
  'T-403',
  'T-404',
  'T-405',
] as const;

/** Phase 13 closeout work-item task ids per implementation-plan.md. */
const PHASE_13_CLOSEOUT_TASKS = ['T-407', 'T-408', 'T-409', 'T-410', 'T-411', 'T-412'] as const;

/** ADR ids enumerated under `docs/decisions/`. */
const EXPECTED_ADRS = ['ADR-001', 'ADR-002', 'ADR-003', 'ADR-004', 'ADR-005', 'ADR-006'] as const;

// ---------- Category 8 — Phase 14 GA readiness constants (T-447) ----------

/**
 * The 9 reference adapter ids T-435 covers. Same constant as
 * `packages/adapter-regression/src/canonical-input.ts ADAPTER_IDS`.
 * The audit holds an independent copy to avoid importing a workspace
 * package at script-evaluation time.
 */
const PHASE_14_ADAPTER_IDS = [
  'kokoro',
  'fish-speech',
  'tripo',
  'meshy',
  'seedance',
  'runway',
  'ace-step',
  'yue',
  'stable-audio-open',
] as const;

/** Adapter id → `packages/<dir>/` directory name. */
const ADAPTER_PACKAGE_DIR: Readonly<Record<(typeof PHASE_14_ADAPTER_IDS)[number], string>> = {
  kokoro: 'tts-kokoro',
  'fish-speech': 'tts-fish-speech',
  tripo: '3d-tripo',
  meshy: '3d-meshy',
  seedance: 'video-seedance',
  runway: 'video-runway',
  'ace-step': 'music-acestep',
  yue: 'music-yue',
  'stable-audio-open': 'sfx-stable-audio',
};

/**
 * Phase 14 ADRs that must be `Accepted` to clear the GA gate.
 * 8.1 verifies both.
 */
const PHASE_14_ADRS = ['ADR-007', 'ADR-008'] as const;

/**
 * Phase 14 CI gates wired into `.github/workflows/ci.yml`. Each tuple is
 * `(script-name, file-name, ci-step-name)`. Mirrors `EXPECTED_CHECK_GATES`
 * shape but covers the P14-specific gates verified by 8.5 / 8.6 / 8.9.
 */
const PHASE_14_CHECK_GATES = [
  {
    script: 'check-asset-licenses',
    file: 'check-asset-licenses.ts',
    ciStep: 'Gate - check-asset-licenses',
  },
  {
    script: 'check-adapter-regression',
    file: 'check-adapter-regression.ts',
    ciStep: 'Gate - check-adapter-regression',
  },
  {
    script: 'check-data-flow-security',
    file: 'check-data-flow-security.ts',
    ciStep: 'Gate - check-data-flow-security',
  },
] as const;

// ---------- types ----------

/** Per-criterion outcome. */
export type CriterionStatus = 'PASS' | 'FAIL' | 'WARN' | 'NA';

/** A single audit criterion's result. */
export interface CriterionResult {
  /** Stable id like `1.1`, `2.4`, `4.3`. */
  id: string;
  /** One-line human-readable description. */
  description: string;
  status: CriterionStatus;
  /** Free-form note — failure cause, qualifying caveat, or PASS evidence. */
  note: string;
}

/** A category groups a set of criteria. */
export interface CategoryResult {
  /** Category number (1-8). */
  number: number;
  /** Title, e.g. "Cluster ratification". */
  title: string;
  criteria: CriterionResult[];
}

/** Whole-report aggregate. */
export interface AuditReport {
  generatedAt: string;
  categories: CategoryResult[];
}

// ---------- pure aggregation helpers ----------

/**
 * Count occurrences of each {@link CriterionStatus} across one
 * category's criteria.
 */
export function countByStatus(criteria: CriterionResult[]): Record<CriterionStatus, number> {
  const counts: Record<CriterionStatus, number> = { PASS: 0, FAIL: 0, WARN: 0, NA: 0 };
  for (const c of criteria) {
    counts[c.status] += 1;
  }
  return counts;
}

/** Whole-report status totals across every category. */
export function totalsByStatus(report: AuditReport): Record<CriterionStatus, number> {
  const totals: Record<CriterionStatus, number> = { PASS: 0, FAIL: 0, WARN: 0, NA: 0 };
  for (const cat of report.categories) {
    const c = countByStatus(cat.criteria);
    totals.PASS += c.PASS;
    totals.FAIL += c.FAIL;
    totals.WARN += c.WARN;
    totals.NA += c.NA;
  }
  return totals;
}

/** Total criteria across the report. */
export function totalCriteria(report: AuditReport): number {
  let n = 0;
  for (const cat of report.categories) n += cat.criteria.length;
  return n;
}

/** Extract every FAIL criterion (for the punch-list section). */
export function failCriteria(report: AuditReport): CriterionResult[] {
  const out: CriterionResult[] = [];
  for (const cat of report.categories) {
    for (const c of cat.criteria) {
      if (c.status === 'FAIL') out.push(c);
    }
  }
  return out;
}

// ---------- per-category check implementations ----------

export interface CheckOpts {
  repoRoot: string;
  presetsRoot: string;
}

/** Category 1 — Cluster ratification. */
export function runCategory1(opts: CheckOpts): CategoryResult {
  const criteria: CriterionResult[] = [];

  // 1.1 — All 8 clusters have ≥1 ratified preset on main.
  // 1.2 — Every preset has signed parityFixture.
  let loaderError: string | undefined;
  const pendingByCluster = new Map<ClusterName, string[]>();
  const totalsByCluster = new Map<ClusterName, number>();
  try {
    resetLoaderCache();
    const registry = loadAllPresets(opts.presetsRoot);
    for (const cluster of ALL_CLUSTER_NAMES) {
      const presets = registry.list(cluster);
      totalsByCluster.set(cluster, presets.length);
      const pending: string[] = [];
      for (const p of presets) {
        const v = p.frontmatter.signOff.parityFixture;
        if (v !== 'na' && !/^signed:\d{4}-\d{2}-\d{2}$/.test(v)) {
          pending.push(p.frontmatter.id);
        }
      }
      pendingByCluster.set(cluster, pending);
    }
  } catch (err) {
    loaderError = err instanceof Error ? err.message : String(err);
  }

  if (loaderError !== undefined) {
    criteria.push({
      id: '1.1',
      description: 'All 8 clusters have ≥1 preset on main',
      status: 'FAIL',
      note: `loader error: ${loaderError}`,
    });
    criteria.push({
      id: '1.2',
      description: 'All cluster presets have signed:YYYY-MM-DD parityFixture',
      status: 'FAIL',
      note: `loader error blocked verification: ${loaderError}`,
    });
  } else {
    const empty: ClusterName[] = [];
    for (const c of ALL_CLUSTER_NAMES) {
      if ((totalsByCluster.get(c) ?? 0) === 0) empty.push(c);
    }
    criteria.push({
      id: '1.1',
      description: 'All 8 clusters have ≥1 preset on main',
      status: empty.length === 0 ? 'PASS' : 'FAIL',
      note:
        empty.length === 0
          ? `8/8 clusters non-empty (totals: ${ALL_CLUSTER_NAMES.map((c) => `${c}=${totalsByCluster.get(c) ?? 0}`).join(', ')})`
          : `empty clusters: ${empty.join(', ')}`,
    });

    const pendingClusters: string[] = [];
    let pendingCount = 0;
    for (const c of ALL_CLUSTER_NAMES) {
      const pending = pendingByCluster.get(c) ?? [];
      pendingCount += pending.length;
      if (pending.length > 0) {
        pendingClusters.push(`${c} (${pending.length}: ${pending.join(', ')})`);
      }
    }
    criteria.push({
      id: '1.2',
      description: 'All cluster presets have signed:YYYY-MM-DD parityFixture (no pending)',
      status: pendingCount === 0 ? 'PASS' : 'FAIL',
      note:
        pendingCount === 0
          ? 'all 50 presets signed'
          : `${pendingCount} preset(s) pending: ${pendingClusters.join('; ')}`,
    });
  }

  // 1.3 — All 7 expected cluster-compose bundles registered in CANONICAL_BUNDLES.
  const catalogPath = join(opts.repoRoot, 'packages/engine/src/bundles/catalog.ts');
  const catalogMissing: string[] = [];
  if (existsSync(catalogPath)) {
    const src = readFileSync(catalogPath, 'utf8');
    for (const name of EXPECTED_COMPOSE_BUNDLES) {
      if (!src.includes(`name: '${name}'`) && !src.includes(`name: "${name}"`)) {
        catalogMissing.push(name);
      }
    }
    criteria.push({
      id: '1.3',
      description: 'All 7 cluster-compose bundles registered in CANONICAL_BUNDLES',
      status: catalogMissing.length === 0 ? 'PASS' : 'FAIL',
      note:
        catalogMissing.length === 0
          ? 'all 7 present (cluster-{a,b,c,e,f,g,h}-compose; D excluded by design)'
          : `missing: ${catalogMissing.join(', ')}`,
    });
  } else {
    criteria.push({
      id: '1.3',
      description: 'All 7 cluster-compose bundles registered in CANONICAL_BUNDLES',
      status: 'FAIL',
      note: `catalog file missing: ${catalogPath}`,
    });
  }

  // 1.4 — Each cluster's compose bundle wired into orchestrator.ts.
  const orchestratorPath = join(opts.repoRoot, 'packages/app-agent/src/orchestrator.ts');
  if (existsSync(orchestratorPath)) {
    const src = readFileSync(orchestratorPath, 'utf8');
    const missingWiring: string[] = [];
    for (const letter of ['A', 'B', 'C', 'E', 'F', 'G', 'H']) {
      const fn = `registerCluster${letter}ComposeBundle`;
      if (!src.includes(fn)) missingWiring.push(fn);
    }
    criteria.push({
      id: '1.4',
      description: "Each cluster's compose bundle wired into app-agent orchestrator",
      status: missingWiring.length === 0 ? 'PASS' : 'FAIL',
      note:
        missingWiring.length === 0
          ? 'all 7 register* calls present'
          : `missing: ${missingWiring.join(', ')}`,
    });
  } else {
    criteria.push({
      id: '1.4',
      description: "Each cluster's compose bundle wired into app-agent orchestrator",
      status: 'FAIL',
      note: `orchestrator file missing: ${orchestratorPath}`,
    });
  }

  // 1.5 — All 8 cluster SKILL.md files present + non-empty.
  const missingSkill: string[] = [];
  const emptySkill: string[] = [];
  for (const c of ALL_CLUSTER_NAMES) {
    const p = join(opts.repoRoot, opts.presetsRoot, c, 'SKILL.md');
    if (!existsSync(p)) {
      missingSkill.push(c);
      continue;
    }
    const body = readFileSync(p, 'utf8');
    if (body.trim().length < 100) {
      emptySkill.push(c);
    }
  }
  if (missingSkill.length === 0 && emptySkill.length === 0) {
    criteria.push({
      id: '1.5',
      description: 'All 8 cluster SKILL.md files present + non-trivially populated',
      status: 'PASS',
      note: '8/8 clusters have a SKILL.md ≥100 chars',
    });
  } else {
    const parts: string[] = [];
    if (missingSkill.length > 0) parts.push(`missing: ${missingSkill.join(', ')}`);
    if (emptySkill.length > 0) parts.push(`empty/short: ${emptySkill.join(', ')}`);
    criteria.push({
      id: '1.5',
      description: 'All 8 cluster SKILL.md files present + non-trivially populated',
      status: 'FAIL',
      note: parts.join('; '),
    });
  }

  return { number: 1, title: 'Cluster ratification', criteria };
}

/** Category 2 — CI gates (presence + wiring; not execution). */
export function runCategory2(opts: CheckOpts): CategoryResult {
  const criteria: CriterionResult[] = [];

  // Read package.json once.
  const pkgJsonPath = join(opts.repoRoot, 'package.json');
  let pkgScripts: Record<string, string> = {};
  if (existsSync(pkgJsonPath)) {
    try {
      const parsed = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as {
        scripts?: Record<string, string>;
      };
      pkgScripts = parsed.scripts ?? {};
    } catch (err) {
      pkgScripts = {};
    }
  }

  // 2.1 — package.json has script entries for every gate.
  const missingScript: string[] = [];
  for (const g of EXPECTED_CHECK_GATES) {
    if (!(g.script in pkgScripts)) missingScript.push(g.script);
  }
  criteria.push({
    id: '2.1',
    description: 'All check-* gates have entries in root package.json scripts',
    status: missingScript.length === 0 ? 'PASS' : 'FAIL',
    note:
      missingScript.length === 0
        ? `${EXPECTED_CHECK_GATES.length}/${EXPECTED_CHECK_GATES.length} script entries present`
        : `missing: ${missingScript.join(', ')}`,
  });

  // 2.2 — scripts/check-*.ts files exist on disk.
  const missingFile: string[] = [];
  for (const g of EXPECTED_CHECK_GATES) {
    if (!existsSync(join(opts.repoRoot, 'scripts', g.file))) missingFile.push(g.file);
  }
  criteria.push({
    id: '2.2',
    description: 'All check-* scripts exist on disk under scripts/',
    status: missingFile.length === 0 ? 'PASS' : 'FAIL',
    note:
      missingFile.length === 0
        ? `${EXPECTED_CHECK_GATES.length}/${EXPECTED_CHECK_GATES.length} script files present`
        : `missing: ${missingFile.join(', ')}`,
  });

  // 2.3 — Each gate is wired into .github/workflows/ci.yml.
  const ciPath = join(opts.repoRoot, '.github/workflows/ci.yml');
  if (existsSync(ciPath)) {
    const src = readFileSync(ciPath, 'utf8');
    const missingCi: string[] = [];
    for (const g of EXPECTED_CHECK_GATES) {
      if (!src.includes(g.ciStep)) missingCi.push(g.ciStep);
    }
    criteria.push({
      id: '2.3',
      description: 'Every check-* gate is wired into .github/workflows/ci.yml',
      status: missingCi.length === 0 ? 'PASS' : 'FAIL',
      note:
        missingCi.length === 0
          ? `${EXPECTED_CHECK_GATES.length}/${EXPECTED_CHECK_GATES.length} steps wired`
          : `missing CI steps: ${missingCi.join('; ')}`,
    });
  } else {
    criteria.push({
      id: '2.3',
      description: 'Every check-* gate is wired into .github/workflows/ci.yml',
      status: 'FAIL',
      note: `ci.yml missing: ${ciPath}`,
    });
  }

  // 2.4 — Coverage thresholds presence (vitest config).
  // We WARN-don't-FAIL because the policy "≥85% coverage on changed code"
  // is enforced per-PR by the Implementer's checklist (CLAUDE.md §11),
  // not by a global threshold in vitest config. A future T may codify a
  // global threshold; for now this is informational.
  criteria.push({
    id: '2.4',
    description: 'Coverage thresholds enforced (CLAUDE.md §11 per-PR; no global vitest threshold)',
    status: 'WARN',
    note: 'Coverage policy is per-PR (≥85% on changed files per CLAUDE.md §11), enforced by Implementer checklist + Reviewer. No global vitest threshold encoded today.',
  });

  return { number: 2, title: 'CI gates', criteria };
}

/** Category 3 — Documentation. */
export function runCategory3(opts: CheckOpts): CategoryResult {
  const criteria: CriterionResult[] = [];

  // 3.1 — CLAUDE.md exists + contains §1..§13 markers.
  const claudePath = join(opts.repoRoot, 'CLAUDE.md');
  if (existsSync(claudePath)) {
    const body = readFileSync(claudePath, 'utf8');
    const missingSec: string[] = [];
    for (let i = 1; i <= 13; i++) {
      if (!new RegExp(`## ${i}\\. `).test(body)) missingSec.push(`§${i}`);
    }
    criteria.push({
      id: '3.1',
      description: 'CLAUDE.md exists and contains §1–§13 sections',
      status: missingSec.length === 0 ? 'PASS' : 'FAIL',
      note:
        missingSec.length === 0
          ? 'CLAUDE.md present with all 13 sections'
          : `missing sections: ${missingSec.join(', ')}`,
    });
  } else {
    criteria.push({
      id: '3.1',
      description: 'CLAUDE.md exists and contains §1–§13 sections',
      status: 'FAIL',
      note: `CLAUDE.md missing at ${claudePath}`,
    });
  }

  // 3.2 — docs/architecture.md exists.
  criteria.push({
    id: '3.2',
    description: 'docs/architecture.md exists',
    status: existsSync(join(opts.repoRoot, 'docs/architecture.md')) ? 'PASS' : 'FAIL',
    note: existsSync(join(opts.repoRoot, 'docs/architecture.md'))
      ? 'present'
      : 'missing — architecture doc is mandatory per CLAUDE.md §1',
  });

  // 3.3 — docs/implementation-plan.md exists.
  criteria.push({
    id: '3.3',
    description: 'docs/implementation-plan.md exists',
    status: existsSync(join(opts.repoRoot, 'docs/implementation-plan.md')) ? 'PASS' : 'FAIL',
    note: existsSync(join(opts.repoRoot, 'docs/implementation-plan.md'))
      ? 'present'
      : 'missing — implementation plan is mandatory per CLAUDE.md §1',
  });

  // 3.4 — All ADRs present + Status: Accepted.
  const decisionsDir = join(opts.repoRoot, 'docs/decisions');
  const missingAdr: string[] = [];
  const unratifiedAdr: string[] = [];
  for (const adr of EXPECTED_ADRS) {
    const matches = existsSync(decisionsDir)
      ? readdirSync(decisionsDir).filter((f) => f.startsWith(`${adr}-`) && f.endsWith('.md'))
      : [];
    if (matches.length === 0) {
      missingAdr.push(adr);
      continue;
    }
    const adrPath = join(decisionsDir, matches[0] as string);
    const body = readFileSync(adrPath, 'utf8');
    if (!/\*\*Status\*\*:\s*\*\*Accepted\*\*/i.test(body) && !/Status:\s*Accepted/i.test(body)) {
      unratifiedAdr.push(adr);
    }
  }
  if (missingAdr.length === 0 && unratifiedAdr.length === 0) {
    criteria.push({
      id: '3.4',
      description: 'All 6 ADRs present + Status: Accepted',
      status: 'PASS',
      note: 'ADR-001..006 all ratified',
    });
  } else {
    const parts: string[] = [];
    if (missingAdr.length > 0) parts.push(`missing: ${missingAdr.join(', ')}`);
    if (unratifiedAdr.length > 0) parts.push(`unratified: ${unratifiedAdr.join(', ')}`);
    criteria.push({
      id: '3.4',
      description: 'All 6 ADRs present + Status: Accepted',
      status: 'FAIL',
      note: parts.join('; '),
    });
  }

  // 3.5 — User-manual content (T-412).
  const userManualPath = join(opts.repoRoot, 'docs/user-manual.md');
  if (existsSync(userManualPath)) {
    const body = readFileSync(userManualPath, 'utf8');
    if (body.trim().length >= 500) {
      criteria.push({
        id: '3.5',
        description: 'User-manual content (T-412 deliverable)',
        status: 'PASS',
        note: `docs/user-manual.md present (${body.trim().length} chars)`,
      });
    } else {
      criteria.push({
        id: '3.5',
        description: 'User-manual content (T-412 deliverable)',
        status: 'FAIL',
        note: `docs/user-manual.md exists but too short (${body.trim().length} chars); see T-412`,
      });
    }
  } else {
    criteria.push({
      id: '3.5',
      description: 'User-manual content (T-412 deliverable)',
      status: 'FAIL',
      note: 'docs/user-manual.md missing — see T-412 in docs/implementation-plan.md',
    });
  }

  // 3.6 — Skill index up-to-date (skills-sync:check script presence).
  const pkgJsonPath = join(opts.repoRoot, 'package.json');
  let hasSkillsSyncCheck = false;
  if (existsSync(pkgJsonPath)) {
    try {
      const parsed = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as {
        scripts?: Record<string, string>;
      };
      hasSkillsSyncCheck = 'skills-sync:check' in (parsed.scripts ?? {});
    } catch (err) {
      hasSkillsSyncCheck = false;
    }
  }
  criteria.push({
    id: '3.6',
    description:
      'Skill-index freshness gate (skills-sync:check) present (execution deferred; CI runs it every push)',
    status: hasSkillsSyncCheck ? 'WARN' : 'FAIL',
    note: hasSkillsSyncCheck
      ? 'skills-sync:check script exists; CI enforces freshness on every push (this audit stays in-process and does not shell out)'
      : 'skills-sync:check missing from package.json scripts',
  });

  return { number: 3, title: 'Documentation', criteria };
}

/** Category 4 — Frontier runtime + Track A. */
export function runCategory4(opts: CheckOpts): CategoryResult {
  const criteria: CriterionResult[] = [];

  // 4.1 — ADR-005 ratified.
  const decisionsDir = join(opts.repoRoot, 'docs/decisions');
  let adr005Status: CriterionStatus = 'FAIL';
  let adr005Note = 'ADR-005 file missing';
  if (existsSync(decisionsDir)) {
    const matches = readdirSync(decisionsDir).filter(
      (f) => f.startsWith('ADR-005-') && f.endsWith('.md'),
    );
    if (matches.length > 0) {
      const body = readFileSync(join(decisionsDir, matches[0] as string), 'utf8');
      if (/\*\*Status\*\*:\s*\*\*Accepted\*\*/i.test(body) || /Status:\s*Accepted/i.test(body)) {
        adr005Status = 'PASS';
        adr005Note = `${matches[0]} ratified`;
      } else {
        adr005Note = `${matches[0]} present but Status not Accepted`;
      }
    }
  }
  criteria.push({
    id: '4.1',
    description: 'ADR-005 frontier clip catalogue ratified',
    status: adr005Status,
    note: adr005Note,
  });

  // 4.2 — Frontier clip primitives present.
  const clipsDir = join(opts.repoRoot, 'packages/runtimes/interactive/src/clips');
  const missingClips: string[] = [];
  for (const clip of EXPECTED_FRONTIER_CLIPS) {
    if (!existsSync(join(clipsDir, clip))) missingClips.push(clip);
  }
  criteria.push({
    id: '4.2',
    description: 'All 7 frontier clip primitives present (per ADR-005 §D2)',
    status: missingClips.length === 0 ? 'PASS' : 'FAIL',
    note:
      missingClips.length === 0
        ? `all 7 present: ${EXPECTED_FRONTIER_CLIPS.join(', ')}`
        : `missing: ${missingClips.join(', ')}`,
  });

  // 4.3 — Track A finale (T-397..T-405) merge status. We auto-WARN
  // because static-fallback closure does not block GA per the
  // Cluster H pattern documented in handover §5.2.
  const tasksDir = join(opts.repoRoot, 'docs/tasks');
  const missingSpecs: string[] = [];
  for (const t of TRACK_A_FINALE_TASKS) {
    if (!existsSync(join(tasksDir, `${t}.md`))) missingSpecs.push(t);
  }
  criteria.push({
    id: '4.3',
    description:
      'Track A finale (T-397..T-405) — security-gated; static-fallback closure does not block GA',
    status: 'WARN',
    note:
      missingSpecs.length === TRACK_A_FINALE_TASKS.length
        ? 'no Track A finale spec docs present yet — gates live-mount only; Cluster H ships static-fallback per ADR-005'
        : missingSpecs.length === 0
          ? 'all Track A finale spec docs present (merge status not verified by this audit)'
          : `${TRACK_A_FINALE_TASKS.length - missingSpecs.length}/${TRACK_A_FINALE_TASKS.length} spec docs present (missing: ${missingSpecs.join(', ')})`,
  });

  return { number: 4, title: 'Frontier runtime + Track A', criteria };
}

/** Category 5 — Enterprise / tenant. */
export function runCategory5(opts: CheckOpts): CategoryResult {
  const criteria: CriterionResult[] = [];

  // 5.1 — T-411 enterprise admin flows.
  const t411Path = join(opts.repoRoot, 'docs/tasks/T-411.md');
  const t411Exists = existsSync(t411Path);
  criteria.push({
    id: '5.1',
    description: 'T-411 enterprise admin flows (tenant-level frontier enablement)',
    status: t411Exists ? 'WARN' : 'FAIL',
    note: t411Exists
      ? 'T-411 spec doc present; merge status not verified by this audit'
      : 'T-411 spec doc not yet drafted; gates Cluster H live-mount toggle',
  });

  // 5.2 — Tenant-level frontier enablement (admin toggle).
  // Tied to T-411; auto-FAIL while 5.1 is FAIL.
  criteria.push({
    id: '5.2',
    description: 'Tenant-level frontier enablement (admin toggle for features.interactive)',
    status: t411Exists ? 'WARN' : 'FAIL',
    note: t411Exists ? 'tied to T-411; downstream of 5.1 PASS' : 'blocked on 5.1 — see T-411',
  });

  return { number: 5, title: 'Enterprise / tenant', criteria };
}

/** Category 6 — Phase 13 closeout. */
export function runCategory6(opts: CheckOpts): CategoryResult {
  const criteria: CriterionResult[] = [];

  // 6.1 — T-407..T-412 spec doc presence.
  const tasksDir = join(opts.repoRoot, 'docs/tasks');
  const missingClosout: string[] = [];
  for (const t of PHASE_13_CLOSEOUT_TASKS) {
    if (!existsSync(join(tasksDir, `${t}.md`))) missingClosout.push(t);
  }
  if (missingClosout.length === 0) {
    criteria.push({
      id: '6.1',
      description: 'T-407 / T-408 / T-409 / T-410 / T-411 / T-412 spec docs present',
      status: 'PASS',
      note: 'all 6 spec docs present',
    });
  } else {
    criteria.push({
      id: '6.1',
      description: 'T-407 / T-408 / T-409 / T-410 / T-411 / T-412 spec docs present',
      status: 'FAIL',
      note: `missing: ${missingClosout.join(', ')}`,
    });
  }

  // 6.2 — T-413 phase closeout handover (auto-WARN per memory).
  criteria.push({
    id: '6.2',
    description: 'T-413 Phase 13 closeout handover (lands at P14 start per memory)',
    status: 'WARN',
    note: 'auto-WARN per feedback_phase_closeout_timing.md — phase-N closeout writes at phase-N+1 start, not at phase-N end',
  });

  // 6.3 — T-414 ratification checkpoint (auto-WARN, same posture).
  criteria.push({
    id: '6.3',
    description: 'T-414 Phase 13 ratification checkpoint',
    status: 'WARN',
    note: 'auto-WARN — ratification checkpoints land at the phase boundary, paired with T-413',
  });

  return { number: 6, title: 'Phase 13 closeout', criteria };
}

/** Category 7 — Memory + workflow conventions (informational). */
export function runCategory7(): CategoryResult {
  const criteria: CriterionResult[] = [
    {
      id: '7.1',
      description:
        'Workflow conventions from docs/handover-phase13-cluster-c-in-flight.md §5 still hold',
      status: 'PASS',
      note: 'auto-PASS — informational; drift detection reserved for a future T (e.g. lint over handover docs)',
    },
  ];
  return { number: 7, title: 'Memory + workflow conventions', criteria };
}

/**
 * Category 8 — Phase 14 GA readiness (T-447).
 *
 * 11 criteria covering ADR ratification, the 9 reference adapters
 * + their security manifests, the AdapterRegistry wire-up, the three
 * Phase 14 CI gates, the sandbox + telemetry packages, and the P14
 * documentation / closeout deliverables. Surfaces the Phase 14 GA
 * punch list the Orchestrator uses at the phase boundary.
 */
export function runCategory8(opts: CheckOpts): CategoryResult {
  const criteria: CriterionResult[] = [];

  // ---------- 8.1 — ADR-007 + ADR-008 ratified ----------
  const decisionsDir = join(opts.repoRoot, 'docs/decisions');
  const adrStatuses: Array<{ adr: string; status: 'PASS' | 'FAIL' | 'MISSING'; note: string }> = [];
  for (const adr of PHASE_14_ADRS) {
    const matches = existsSync(decisionsDir)
      ? readdirSync(decisionsDir).filter((f) => f.startsWith(`${adr}-`) && f.endsWith('.md'))
      : [];
    if (matches.length === 0) {
      adrStatuses.push({ adr, status: 'MISSING', note: 'file missing' });
      continue;
    }
    const adrPath = join(decisionsDir, matches[0] as string);
    const body = readFileSync(adrPath, 'utf8');
    if (/\*\*Status\*\*:\s*\*\*Accepted\*\*/i.test(body) || /Status:\s*Accepted/i.test(body)) {
      adrStatuses.push({ adr, status: 'PASS', note: 'Accepted' });
    } else {
      // Extract the actual status if present.
      const m = body.match(/\*\*Status\*\*:\s*\*\*([^*]+)\*\*/i) ?? body.match(/Status:\s*(\S+)/i);
      const actual = m?.[1] ?? 'unknown';
      adrStatuses.push({ adr, status: 'FAIL', note: actual });
    }
  }
  const adrFails = adrStatuses.filter((a) => a.status !== 'PASS');
  criteria.push({
    id: '8.1',
    description: 'ADR-007 (provider seam) + ADR-008 (asset generation) ratified (Accepted)',
    status: adrFails.length === 0 ? 'PASS' : 'FAIL',
    note:
      adrFails.length === 0
        ? 'both Phase 14 α ADRs ratified'
        : adrFails.map((a) => `${a.adr}: ${a.note}`).join('; '),
  });

  // ---------- 8.2 — All 9 reference adapter packages present ----------
  const missingAdapter: string[] = [];
  for (const id of PHASE_14_ADAPTER_IDS) {
    const dir = ADAPTER_PACKAGE_DIR[id];
    const pkgJson = join(opts.repoRoot, 'packages', dir, 'package.json');
    if (!existsSync(pkgJson)) {
      missingAdapter.push(`${id} (${dir})`);
      continue;
    }
    try {
      const parsed = JSON.parse(readFileSync(pkgJson, 'utf8')) as { name?: string };
      if (parsed.name !== `@stageflip/${dir}`) {
        missingAdapter.push(`${id} (wrong name: ${parsed.name ?? 'unset'})`);
      }
    } catch {
      missingAdapter.push(`${id} (package.json unparseable)`);
    }
  }
  criteria.push({
    id: '8.2',
    description: 'All 9 reference adapter packages present (T-426..T-434)',
    status: missingAdapter.length === 0 ? 'PASS' : 'FAIL',
    note:
      missingAdapter.length === 0
        ? `9/9 adapters present: ${PHASE_14_ADAPTER_IDS.join(', ')}`
        : `missing or misconfigured: ${missingAdapter.join('; ')}`,
  });

  // ---------- 8.3 — All 9 adapters have security.json sidecar ----------
  const missingManifest: string[] = [];
  for (const id of PHASE_14_ADAPTER_IDS) {
    const dir = ADAPTER_PACKAGE_DIR[id];
    if (!existsSync(join(opts.repoRoot, 'packages', dir, 'security.json'))) {
      missingManifest.push(`${id} (${dir})`);
    }
  }
  criteria.push({
    id: '8.3',
    description: 'All 9 adapters have SecurityManifest sidecar (T-446)',
    status: missingManifest.length === 0 ? 'PASS' : 'FAIL',
    note:
      missingManifest.length === 0
        ? '9/9 security.json sidecars present'
        : `missing: ${missingManifest.join('; ')}`,
  });

  // ---------- 8.4 — AdapterRegistry wire-up covers all 9 adapters ----------
  const canonInputPath = join(opts.repoRoot, 'packages/adapter-regression/src/canonical-input.ts');
  if (existsSync(canonInputPath)) {
    const src = readFileSync(canonInputPath, 'utf8');
    const missingId: string[] = [];
    for (const id of PHASE_14_ADAPTER_IDS) {
      // ADAPTER_IDS literal includes 'id' as a single-quoted entry.
      if (!src.includes(`'${id}'`)) missingId.push(id);
    }
    criteria.push({
      id: '8.4',
      description:
        'AdapterRegistry (T-435 ADAPTER_IDS) covers all 9 reference adapters (T-426..T-434)',
      status: missingId.length === 0 ? 'PASS' : 'FAIL',
      note:
        missingId.length === 0
          ? '9/9 adapter ids in ADAPTER_IDS'
          : `missing: ${missingId.join(', ')}`,
    });
  } else {
    criteria.push({
      id: '8.4',
      description:
        'AdapterRegistry (T-435 ADAPTER_IDS) covers all 9 reference adapters (T-426..T-434)',
      status: 'FAIL',
      note: `canonical-input.ts missing: ${canonInputPath}`,
    });
  }

  // ---------- helper: Phase 14 gate check (8.5 / 8.6 / 8.9) ----------
  function checkGateWiring(
    id: string,
    description: string,
    gate: (typeof PHASE_14_CHECK_GATES)[number],
  ): CriterionResult {
    const missing: string[] = [];

    // package.json script entry
    const pkgJsonPath = join(opts.repoRoot, 'package.json');
    let hasScript = false;
    if (existsSync(pkgJsonPath)) {
      try {
        const parsed = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as {
          scripts?: Record<string, string>;
        };
        hasScript = gate.script in (parsed.scripts ?? {});
      } catch {
        hasScript = false;
      }
    }
    if (!hasScript) missing.push(`package.json script '${gate.script}'`);

    // scripts/<file>
    if (!existsSync(join(opts.repoRoot, 'scripts', gate.file))) {
      missing.push(`scripts/${gate.file}`);
    }

    // ci.yml step
    const ciPath = join(opts.repoRoot, '.github/workflows/ci.yml');
    let hasCi = false;
    if (existsSync(ciPath)) {
      hasCi = readFileSync(ciPath, 'utf8').includes(gate.ciStep);
    }
    if (!hasCi) missing.push(`ci.yml step '${gate.ciStep}'`);

    return {
      id,
      description,
      status: missing.length === 0 ? 'PASS' : 'FAIL',
      note:
        missing.length === 0
          ? `${gate.script}: script + file + ci.yml step all present`
          : `missing: ${missing.join('; ')}`,
    };
  }

  // ---------- 8.5 — check-asset-licenses (T-422) ----------
  criteria.push(
    checkGateWiring(
      '8.5',
      'T-422 check-asset-licenses gate present (script + file + ci.yml wiring)',
      PHASE_14_CHECK_GATES[0],
    ),
  );

  // ---------- 8.6 — check-adapter-regression (T-435) ----------
  criteria.push(
    checkGateWiring(
      '8.6',
      'T-435 check-adapter-regression gate present (script + file + ci.yml wiring)',
      PHASE_14_CHECK_GATES[1],
    ),
  );

  // ---------- 8.7 — @stageflip/adapter-sandbox present (T-444) ----------
  const sandboxPkg = join(opts.repoRoot, 'packages/adapter-sandbox/package.json');
  let sandboxStatus: CriterionStatus = 'FAIL';
  let sandboxNote = `packages/adapter-sandbox/package.json missing`;
  if (existsSync(sandboxPkg)) {
    try {
      const parsed = JSON.parse(readFileSync(sandboxPkg, 'utf8')) as { name?: string };
      if (parsed.name === '@stageflip/adapter-sandbox') {
        sandboxStatus = 'PASS';
        sandboxNote = '@stageflip/adapter-sandbox present';
      } else {
        sandboxNote = `wrong package name: ${parsed.name ?? 'unset'}`;
      }
    } catch (err) {
      sandboxNote = `package.json unparseable: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  criteria.push({
    id: '8.7',
    description: 'T-444 @stageflip/adapter-sandbox package on main',
    status: sandboxStatus,
    note: sandboxNote,
  });

  // ---------- 8.8 — @stageflip/usage-telemetry + query_usage_telemetry tool (T-445) ----------
  const telemetryPkg = join(opts.repoRoot, 'packages/usage-telemetry/package.json');
  const handlersPath = join(
    opts.repoRoot,
    'packages/engine/src/handlers/asset-generation/handlers.ts',
  );
  const missingTelemetry: string[] = [];
  let telemetryNameOk = false;
  if (existsSync(telemetryPkg)) {
    try {
      const parsed = JSON.parse(readFileSync(telemetryPkg, 'utf8')) as { name?: string };
      telemetryNameOk = parsed.name === '@stageflip/usage-telemetry';
    } catch {
      telemetryNameOk = false;
    }
  }
  if (!telemetryNameOk) {
    missingTelemetry.push('@stageflip/usage-telemetry package');
  }
  let hasQueryTool = false;
  if (existsSync(handlersPath)) {
    hasQueryTool = readFileSync(handlersPath, 'utf8').includes('query_usage_telemetry');
  }
  if (!hasQueryTool) {
    missingTelemetry.push('query_usage_telemetry tool in engine handlers');
  }
  criteria.push({
    id: '8.8',
    description:
      'T-445 @stageflip/usage-telemetry + query_usage_telemetry tool registered in engine',
    status: missingTelemetry.length === 0 ? 'PASS' : 'FAIL',
    note:
      missingTelemetry.length === 0
        ? 'package + tool both present'
        : `missing: ${missingTelemetry.join('; ')}`,
  });

  // ---------- 8.9 — check-data-flow-security (T-446) ----------
  criteria.push(
    checkGateWiring(
      '8.9',
      'T-446 check-data-flow-security gate present (script + file + ci.yml wiring)',
      PHASE_14_CHECK_GATES[2],
    ),
  );

  // ---------- 8.10 — T-448 documentation pass spec ----------
  const t448Path = join(opts.repoRoot, 'docs/tasks/T-448.md');
  criteria.push({
    id: '8.10',
    description: 'T-448 Phase 14 documentation pass spec present',
    status: existsSync(t448Path) ? 'PASS' : 'WARN',
    note: existsSync(t448Path)
      ? 'T-448 spec doc present; merge status not verified by this audit'
      : 'T-448 spec doc not yet drafted (downstream of T-447; auto-WARN — does not block GA gate)',
  });

  // ---------- 8.11 — T-449 Phase 14 closeout handover ----------
  const t449Path = join(opts.repoRoot, 'docs/tasks/T-449.md');
  const handoverPath = join(opts.repoRoot, 'docs/handover-phase14-complete.md');
  const t449Present = existsSync(t449Path);
  const handoverPresent = existsSync(handoverPath);
  if (t449Present && handoverPresent) {
    criteria.push({
      id: '8.11',
      description: 'T-449 Phase 14 closeout handover (lands at P15 start per memory)',
      status: 'PASS',
      note: 'T-449 spec + docs/handover-phase14-complete.md both present',
    });
  } else {
    criteria.push({
      id: '8.11',
      description: 'T-449 Phase 14 closeout handover (lands at P15 start per memory)',
      status: 'WARN',
      note: `auto-WARN per feedback_phase_closeout_timing.md — phase-N closeout writes at phase-N+1 start (T-449: ${t449Present ? 'present' : 'missing'}; handover: ${handoverPresent ? 'present' : 'missing'})`,
    });
  }

  return { number: 8, title: 'Phase 14 GA readiness', criteria };
}

// ---------- top-level orchestration ----------

export interface RunOpts extends CheckOpts {
  /** ISO8601 generated-at timestamp; injected by tests for determinism. */
  generatedAt: string;
}

/** Run every category and assemble the report. */
export function runAudit(opts: RunOpts): AuditReport {
  return {
    generatedAt: opts.generatedAt,
    categories: [
      runCategory1(opts),
      runCategory2(opts),
      runCategory3(opts),
      runCategory4(opts),
      runCategory5(opts),
      runCategory6(opts),
      runCategory7(),
      runCategory8(opts),
    ],
  };
}

// ---------- markdown formatter ----------

function statusBadge(s: CriterionStatus): string {
  switch (s) {
    case 'PASS':
      return 'PASS';
    case 'FAIL':
      return 'FAIL';
    case 'WARN':
      return 'WARN';
    case 'NA':
      return 'N/A';
  }
}

function escapePipe(s: string): string {
  // Replace literal pipe with the HTML entity so it doesn't break markdown
  // table parsing. Newlines are collapsed to spaces for the same reason.
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/** Render the report as markdown. Pure — exposed for tests. */
export function renderMarkdownReport(report: AuditReport): string {
  const lines: string[] = [];
  const totals = totalsByStatus(report);
  const total = totalCriteria(report);

  lines.push('# StageFlip — GA Readiness Report');
  lines.push('');
  lines.push(
    '_This report is generated by `pnpm check-ga-readiness` (T-410). It is NOT a CI gate — it is a manual audit invoked at phase boundaries to surface the GA punch list._',
  );
  lines.push('');
  lines.push(`**Generated at**: \`${report.generatedAt}\``);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| | Count |');
  lines.push('|---|---:|');
  lines.push(`| Total criteria | ${total} |`);
  lines.push(`| PASS | ${totals.PASS} |`);
  lines.push(`| FAIL | ${totals.FAIL} |`);
  lines.push(`| WARN | ${totals.WARN} |`);
  lines.push(`| N/A | ${totals.NA} |`);
  lines.push('');
  lines.push('### Per-category counts');
  lines.push('');
  lines.push('| Category | PASS | FAIL | WARN | N/A |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const cat of report.categories) {
    const c = countByStatus(cat.criteria);
    lines.push(`| ${cat.number}. ${cat.title} | ${c.PASS} | ${c.FAIL} | ${c.WARN} | ${c.NA} |`);
  }
  lines.push('');

  // Top punch-list (FAIL items) up front for orchestrator scan.
  const fails = failCriteria(report);
  lines.push('## Punch list (FAIL items)');
  lines.push('');
  if (fails.length === 0) {
    lines.push('_No FAIL criteria — GA readiness checklist clear._');
  } else {
    lines.push('| ID | Description | Note |');
    lines.push('|---|---|---|');
    for (const f of fails) {
      lines.push(`| ${f.id} | ${escapePipe(f.description)} | ${escapePipe(f.note)} |`);
    }
  }
  lines.push('');

  for (const cat of report.categories) {
    lines.push(`## Category ${cat.number} — ${cat.title}`);
    lines.push('');
    lines.push('| ID | Status | Description | Note |');
    lines.push('|---|---|---|---|');
    for (const c of cat.criteria) {
      lines.push(
        `| ${c.id} | ${statusBadge(c.status)} | ${escapePipe(c.description)} | ${escapePipe(c.note)} |`,
      );
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    '_End of report. Re-run with `pnpm check-ga-readiness`. See `docs/tasks/T-410.md` for the checklist definition._',
  );
  lines.push('');

  return lines.join('\n');
}

/** Render a short stdout summary (one line per category + totals). */
export function renderSummary(report: AuditReport): string {
  const lines: string[] = [];
  const total = totalCriteria(report);
  lines.push(`check-ga-readiness: ${report.categories.length} categories, ${total} criteria`);
  for (const cat of report.categories) {
    const c = countByStatus(cat.criteria);
    lines.push(
      `check-ga-readiness [Cat ${cat.number}: ${cat.title}]: ${c.PASS} PASS / ${c.FAIL} FAIL / ${c.WARN} WARN / ${c.NA} N/A`,
    );
  }
  const t = totalsByStatus(report);
  if (t.FAIL === 0) {
    lines.push(`check-ga-readiness: PASS (${t.PASS} pass / ${t.WARN} warn / ${t.NA} n/a)`);
  } else {
    lines.push(`check-ga-readiness: FAIL (${t.FAIL} criteria — see report for the punch list)`);
  }
  return lines.join('\n');
}

// ---------- CLI plumbing ----------

export interface CliArgs {
  repoRoot: string | undefined;
  presetsRoot: string;
  reportOut: string;
  noWrite: boolean;
  help: boolean;
}

const DEFAULT_CLI_ARGS: CliArgs = {
  repoRoot: undefined,
  presetsRoot: PRESETS_ROOT_DEFAULT,
  reportOut: REPORT_OUT_DEFAULT,
  noWrite: false,
  help: false,
};

export function parseArgs(argv: readonly string[]): { args: CliArgs; errors: string[] } {
  const args: CliArgs = { ...DEFAULT_CLI_ARGS };
  const errors: string[] = [];
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      args.help = true;
      continue;
    }
    if (raw === '--no-write') {
      args.noWrite = true;
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
      case 'repo-root':
        args.repoRoot = value;
        break;
      case 'presets-root':
        args.presetsRoot = value;
        break;
      case 'report-out':
        args.reportOut = value;
        break;
      default:
        errors.push(`unknown flag '--${key}'`);
    }
  }
  return { args, errors };
}

export function usage(): string {
  return [
    'Usage: pnpm check-ga-readiness [--repo-root=<path>] [--presets-root=<path>]',
    '                               [--report-out=<path>] [--no-write] [--help]',
    '',
    'Walks a defined GA-readiness checklist (8 categories) and emits a markdown',
    'report enumerating PASS / FAIL / WARN / N/A for every criterion.',
    'Exit 0 when no FAIL criteria; exit 1 when at least one criterion FAILs.',
    'WARN does NOT affect exit code.',
  ].join('\n');
}

export interface RunResult {
  exitCode: 0 | 1 | 2;
  stdout: string[];
  stderr: string[];
}

/**
 * Auto-discover the repo root by walking up from the script's location
 * until we find a `package.json` whose name is "stageflip". Falls back
 * to `process.cwd()` if discovery fails.
 */
export function discoverRepoRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg)) {
      try {
        const parsed = JSON.parse(readFileSync(pkg, 'utf8')) as { name?: string };
        if (parsed.name === 'stageflip') return dir;
      } catch {
        // ignore parse errors, keep walking
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

/**
 * Pure CLI entry — returns result instead of writing to process.stdout
 * directly. The thin `main()` wrapper at the bottom does the actual I/O.
 */
export function runCli(
  argv: readonly string[],
  io: {
    nowIso: () => string;
    write: (path: string, body: string) => void;
    cwd: string;
  },
): RunResult {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const { args, errors } = parseArgs(argv);

  if (args.help) {
    stdout.push(usage());
    return { exitCode: 0, stdout, stderr };
  }

  if (errors.length > 0) {
    for (const e of errors) stderr.push(e);
    stderr.push(usage());
    return { exitCode: 2, stdout, stderr };
  }

  const repoRoot = args.repoRoot ?? discoverRepoRoot(io.cwd);

  const report = runAudit({
    repoRoot,
    presetsRoot: args.presetsRoot,
    generatedAt: io.nowIso(),
  });

  const summary = renderSummary(report);
  stdout.push(summary);

  if (!args.noWrite) {
    const md = renderMarkdownReport(report);
    const outPath = resolve(repoRoot, args.reportOut);
    try {
      io.write(outPath, md);
      stdout.push(`check-ga-readiness: report written to ${args.reportOut}`);
    } catch (err) {
      stderr.push(
        `check-ga-readiness: failed to write report to ${outPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { exitCode: 1, stdout, stderr };
    }
  }

  const totals = totalsByStatus(report);
  if (totals.FAIL > 0) {
    const fails = failCriteria(report).slice(0, 5);
    stderr.push('');
    stderr.push(`check-ga-readiness: ${totals.FAIL} FAIL criterion(s) — top items:`);
    for (const f of fails) {
      stderr.push(`  - [${f.id}] ${f.description} :: ${f.note}`);
    }
    return { exitCode: 1, stdout, stderr };
  }
  return { exitCode: 0, stdout, stderr };
}

/* v8 ignore start */
function main(): void {
  const result = runCli(process.argv.slice(2), {
    nowIso: () => new Date().toISOString(),
    write: (p, body) => writeFileSync(p, body, 'utf8'),
    cwd: process.cwd(),
  });
  for (const line of result.stdout) process.stdout.write(`${line}\n`);
  for (const line of result.stderr) process.stderr.write(`${line}\n`);
  process.exit(result.exitCode);
}

const __thisFile = fileURLToPath(import.meta.url);
const argvEntry = process.argv[1] ? resolve(process.argv[1]) : '';
const moduleEntry = resolve(__thisFile);
if (
  argvEntry === moduleEntry ||
  argvEntry === resolve(dirname(moduleEntry), 'check-ga-readiness.ts')
) {
  try {
    main();
  } catch (err) {
    process.stderr.write(
      `check-ga-readiness: crashed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    if (err instanceof Error && err.stack) {
      process.stderr.write(`${err.stack}\n`);
    }
    process.exit(2);
  }
}
/* v8 ignore stop */
