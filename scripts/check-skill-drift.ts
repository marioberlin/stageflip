// scripts/check-skill-drift.ts
// CI gate for invariant I-8 (CLAUDE.md §5): the skills tree is the source of
// truth and cannot drift from the conventions every SKILL.md declares. This
// initial pass covers link integrity + tier coverage; generator-output diffing
// arrives with @stageflip/skills-sync (T-220), which will register itself here.
//
// Uses the source files of @stageflip/skills-core directly via a relative
// import so the gate does not require a prior build. tsx resolves .js imports
// against their .ts source. If @stageflip/skills-core ever gains build-time
// codegen (generated types, compiled Zod schemas, etc.), this direct import
// will miss them — at that point, switch to importing `@stageflip/skills-core`
// (the built package) and add a `pnpm --filter=@stageflip/skills-core build`
// step before invoking this script.

import { loadSkillTree, SKILL_TIERS, validateTree } from '../packages/skills-core/src/index.js';
import type { SkillTree } from '../packages/skills-core/src/index.js';

const ROOT = 'skills/stageflip';

interface CheckResult {
  name: string;
  errors: string[];
  warnings: string[];
}

function linkIntegrityCheck(tree: SkillTree): CheckResult {
  const issues = validateTree(tree);
  return {
    name: 'link-integrity',
    errors: issues.filter((i) => i.severity === 'error').map((i) => `${i.skillPath}: ${i.message}`),
    warnings: issues.filter((i) => i.severity === 'warn').map((i) => `${i.skillPath}: ${i.message}`),
  };
}

function tierCoverageCheck(tree: SkillTree): CheckResult {
  const errors: string[] = [];
  for (const tier of SKILL_TIERS) {
    if (!tree.byTier.has(tier) || (tree.byTier.get(tier) ?? []).length === 0) {
      errors.push(`${ROOT}: tier "${tier}" has no SKILL.md files`);
    }
  }
  return { name: 'tier-coverage', errors, warnings: [] };
}

function reportCheck(result: CheckResult): void {
  process.stdout.write(`check-skill-drift [${result.name}]: `);
  if (result.errors.length === 0 && result.warnings.length === 0) {
    process.stdout.write('PASS\n');
    return;
  }
  process.stdout.write(`${result.errors.length} error(s), ${result.warnings.length} warning(s)\n`);
  for (const e of result.errors) process.stderr.write(`  ERROR: ${e}\n`);
  for (const w of result.warnings) process.stderr.write(`  warn:  ${w}\n`);
}

async function main(): Promise<void> {
  let tree: SkillTree;
  try {
    tree = await loadSkillTree(ROOT);
  } catch (err) {
    // Parse-time failures (e.g. invalid Zod-validated frontmatter) are drifts
    // too — report them as gate errors rather than a script crash.
    process.stdout.write('check-skill-drift [load]: 1 error(s), 0 warning(s)\n');
    process.stderr.write(`  ERROR: failed to load skills tree: ${String(err)}\n`);
    process.stderr.write('\ncheck-skill-drift: FAIL (1 error)\n');
    process.exit(1);
  }

  const results: CheckResult[] = [linkIntegrityCheck(tree), tierCoverageCheck(tree)];
  let totalErrors = 0;
  let totalWarnings = 0;
  for (const r of results) {
    reportCheck(r);
    totalErrors += r.errors.length;
    totalWarnings += r.warnings.length;
  }

  if (totalErrors > 0) {
    process.stderr.write(`\ncheck-skill-drift: FAIL (${totalErrors} errors)\n`);
    process.exit(1);
  }
  if (totalWarnings > 0) {
    process.stdout.write(`\ncheck-skill-drift: PASS with ${totalWarnings} warnings\n`);
  } else {
    process.stdout.write('\ncheck-skill-drift: PASS\n');
  }
  process.exit(0);
}

main().catch((err: unknown) => {
  process.stderr.write(`check-skill-drift: crashed: ${String(err)}\n`);
  if (err instanceof Error && err.stack) process.stderr.write(`${err.stack}\n`);
  process.exit(2);
});
