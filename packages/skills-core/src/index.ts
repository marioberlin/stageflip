// packages/skills-core/src/index.ts
// @stageflip/skills-core — parse, validate, and load the StageFlip skills tree.
// Public API consumed by scripts/check-skill-drift.ts (T-014),
// @stageflip/skills-sync (T-220), the docs site, and the Claude plugin packager.

export { parseSkillFile } from './parse.js';
export { loadSkillTree } from './load.js';
export { validateSkill, validateTree } from './validate.js';
export {
  SKILL_TIERS,
  SKILL_STATUSES,
  skillFrontmatterSchema,
  type SkillFrontmatter,
  type SkillStatus,
  type SkillTier,
  type ParsedSkill,
  type ValidationIssue,
  type SkillTree,
} from './types.js';
