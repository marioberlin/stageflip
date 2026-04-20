// packages/skills-core/src/parse.ts
// parseSkillFile — splits a raw SKILL.md into (frontmatter, body) and validates
// the frontmatter against the schema in ./types.ts. Throws on invalid input so
// callers can choose to surface the error or catch and convert to a
// ValidationIssue.

import matter from 'gray-matter';
import { type ParsedSkill, skillFrontmatterSchema } from './types.js';

/**
 * Parse a single SKILL.md file.
 *
 * @param raw The full file contents (frontmatter + body).
 * @param path The path used for error messages and for the returned object.
 * @throws ZodError if the frontmatter is invalid.
 * @throws Error if the file has no frontmatter block.
 */
export function parseSkillFile(raw: string, path: string): ParsedSkill {
  const parsed = matter(raw);
  // gray-matter returns an empty `data` object when no frontmatter is present.
  // Require an explicit frontmatter block (the first line must be `---`).
  if (!raw.startsWith('---')) {
    throw new Error(`${path}: missing frontmatter block (file must start with '---')`);
  }
  const frontmatter = skillFrontmatterSchema.parse(parsed.data);
  return { path, frontmatter, body: parsed.content };
}
