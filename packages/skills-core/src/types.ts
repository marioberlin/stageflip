// packages/skills-core/src/types.ts
// Frontmatter schema + derived types for the skills tree. Single source of truth
// for what a SKILL.md is allowed to contain. Zod is used so the schema doubles as
// the validator; TS types are inferred.

import { z } from 'zod';

/**
 * Valid `tier` values. Matches the tiers documented in
 * `skills/stageflip/concepts/skills-tree/SKILL.md`.
 */
export const SKILL_TIERS = [
  'concept',
  'runtime',
  'mode',
  'profile',
  'tools',
  'workflow',
  'reference',
  'clip',
  'cluster',
  'agent',
] as const;
export type SkillTier = (typeof SKILL_TIERS)[number];

/** Valid `status` values. */
export const SKILL_STATUSES = ['substantive', 'placeholder', 'auto-generated'] as const;
export type SkillStatus = (typeof SKILL_STATUSES)[number];

/**
 * Zod schema for a SKILL.md frontmatter block. Strict: unknown fields are
 * rejected so typos don't silently pass (`releated` etc.).
 */
export const skillFrontmatterSchema = z
  .object({
    title: z.string().min(1),
    id: z.string().regex(/^skills\/stageflip\/[a-z0-9-]+(\/[a-z0-9-]+)*$/, {
      message: 'id must be a lowercase kebab path under skills/stageflip/',
    }),
    tier: z.enum(SKILL_TIERS),
    status: z.enum(SKILL_STATUSES),
    last_updated: z.preprocess(
      // gray-matter + js-yaml parse unquoted YYYY-MM-DD as a JS Date. Coerce back.
      (v) =>
        v instanceof Date
          ? `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(
              v.getUTCDate(),
            ).padStart(2, '0')}`
          : v,
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'last_updated must be YYYY-MM-DD' }),
    ),
    owner_task: z.string().regex(/^T-\d+[a-z]?$/, { message: 'owner_task must be T-NNN[a]' }),
    related: z.array(z.string()).default([]),
  })
  .strict();

export type SkillFrontmatter = z.infer<typeof skillFrontmatterSchema>;

/** A parsed SKILL.md file: its filesystem path, frontmatter, and body. */
export interface ParsedSkill {
  /** Absolute or workspace-relative path to the SKILL.md file. */
  path: string;
  /** Validated frontmatter. */
  frontmatter: SkillFrontmatter;
  /** Markdown body (everything after the frontmatter block). */
  body: string;
}

/** A single validation issue surfaced by `validateSkill` or `validateTree`. */
export interface ValidationIssue {
  skillPath: string;
  severity: 'error' | 'warn';
  message: string;
}

/** The loaded skill tree: flat array + id/tier indexes for common queries. */
export interface SkillTree {
  skills: ParsedSkill[];
  byId: Map<string, ParsedSkill>;
  byTier: Map<SkillTier, ParsedSkill[]>;
}
