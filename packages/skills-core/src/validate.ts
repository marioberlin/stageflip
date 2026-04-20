// packages/skills-core/src/validate.ts
// validateSkill / validateTree — link-integrity and path-identity checks beyond
// what the Zod frontmatter schema covers.

import type { ParsedSkill, SkillTree, ValidationIssue } from './types.js';

/**
 * Given a parsed skill, check:
 *   1. `frontmatter.id` equals `path` with the `/SKILL.md` suffix stripped.
 *   2. Every entry in `frontmatter.related` resolves to a known skill id
 *      (only when a set of known ids is provided via opts).
 *   3. The file is not empty below the frontmatter.
 */
export function validateSkill(
  skill: ParsedSkill,
  opts: { treeIds?: ReadonlySet<string> } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { path, frontmatter, body } = skill;

  // 1. id matches path
  const pathDerived = path.replace(/\/SKILL\.md$/, '').replace(/\\/g, '/');
  if (frontmatter.id !== pathDerived) {
    issues.push({
      skillPath: path,
      severity: 'error',
      message: `id "${frontmatter.id}" does not match path-derived id "${pathDerived}"`,
    });
  }

  // 2. related links resolve
  if (opts.treeIds) {
    for (const rel of frontmatter.related) {
      const relId = rel.replace(/\/SKILL\.md$/, '');
      if (!opts.treeIds.has(relId)) {
        issues.push({
          skillPath: path,
          severity: 'error',
          message: `related link "${rel}" does not resolve to any skill in the tree`,
        });
      }
    }
  }

  // 3. non-empty body (placeholder bodies are short but never empty)
  if (body.trim().length === 0) {
    issues.push({
      skillPath: path,
      severity: 'warn',
      message: 'body is empty — at minimum include a one-line status sentence',
    });
  }

  return issues;
}

/** Validate every skill in a tree. Cross-file checks use the tree's id index. */
export function validateTree(tree: SkillTree): ValidationIssue[] {
  const ids = new Set(tree.byId.keys());
  const issues: ValidationIssue[] = [];
  for (const skill of tree.skills) issues.push(...validateSkill(skill, { treeIds: ids }));
  return issues;
}
