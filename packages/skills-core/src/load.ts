// packages/skills-core/src/load.ts
// loadSkillTree — recursively discovers every SKILL.md under a root directory,
// parses each, and builds id/tier indexes.

import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseSkillFile } from './parse.js';
import type { ParsedSkill, SkillTier, SkillTree } from './types.js';

/**
 * Walk `root` recursively and collect every `SKILL.md` path found.
 * Symlinks are followed; common build-output directories are skipped.
 */
async function collectSkillFiles(root: string): Promise<string[]> {
  const SKIP = new Set(['node_modules', 'dist', '.turbo', '.next', '.git']);
  const out: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (SKIP.has(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile() && e.name === 'SKILL.md') {
        out.push(full);
      }
    }
  };
  await walk(root);
  return out.sort();
}

/**
 * Build a skill tree from a root directory. Paths in the returned tree are
 * relative to `basePath` (or to cwd if not supplied) so they match the `id`
 * field's shape.
 *
 * @param root Directory to walk (e.g. `skills/stageflip`).
 * @param opts.basePath Base for path-relativization. Defaults to `process.cwd()`.
 */
export async function loadSkillTree(
  root: string,
  opts: { basePath?: string } = {},
): Promise<SkillTree> {
  const base = opts.basePath ?? process.cwd();
  const files = await collectSkillFiles(root);

  const skills: ParsedSkill[] = [];
  for (const absPath of files) {
    const raw = await readFile(absPath, 'utf8');
    const rel = relative(base, absPath);
    skills.push(parseSkillFile(raw, rel));
  }

  const byId = new Map<string, ParsedSkill>();
  const byTier = new Map<SkillTier, ParsedSkill[]>();
  for (const s of skills) {
    byId.set(s.frontmatter.id, s);
    const bucket = byTier.get(s.frontmatter.tier) ?? [];
    bucket.push(s);
    byTier.set(s.frontmatter.tier, bucket);
  }

  return { skills, byId, byTier };
}
