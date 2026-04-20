// packages/skills-core/src/index.test.ts
// Unit tests for parseSkillFile, validateSkill, validateTree, loadSkillTree.
// Uses tmpdir fixtures for loadSkillTree so tests are hermetic.

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadSkillTree, parseSkillFile, validateSkill, validateTree } from './index.js';
import type { ParsedSkill } from './index.js';

const VALID_FRONTMATTER = `---
title: Canonical Schema
id: skills/stageflip/concepts/schema
tier: concept
status: substantive
last_updated: 2026-04-20
owner_task: T-020
related: []
---

Body content here.
`;

describe('parseSkillFile', () => {
  it('parses a well-formed SKILL.md', () => {
    const parsed = parseSkillFile(VALID_FRONTMATTER, 'skills/stageflip/concepts/schema/SKILL.md');
    expect(parsed.frontmatter.title).toBe('Canonical Schema');
    expect(parsed.frontmatter.tier).toBe('concept');
    expect(parsed.frontmatter.status).toBe('substantive');
    expect(parsed.frontmatter.related).toEqual([]);
    expect(parsed.body.trim()).toBe('Body content here.');
  });

  it('rejects files with no frontmatter', () => {
    expect(() => parseSkillFile('no frontmatter here\n', 'some/path/SKILL.md')).toThrow(
      /missing frontmatter/,
    );
  });

  it('rejects frontmatter missing a required field', () => {
    const bad = VALID_FRONTMATTER.replace('title: Canonical Schema\n', '');
    expect(() => parseSkillFile(bad, 'x/SKILL.md')).toThrow();
  });

  it('rejects an invalid tier value', () => {
    const bad = VALID_FRONTMATTER.replace('tier: concept', 'tier: invented-tier');
    expect(() => parseSkillFile(bad, 'x/SKILL.md')).toThrow();
  });

  it('rejects an invalid status value', () => {
    const bad = VALID_FRONTMATTER.replace('status: substantive', 'status: halfway');
    expect(() => parseSkillFile(bad, 'x/SKILL.md')).toThrow();
  });

  it('rejects malformed last_updated', () => {
    const bad = VALID_FRONTMATTER.replace('last_updated: 2026-04-20', 'last_updated: 04/20/2026');
    expect(() => parseSkillFile(bad, 'x/SKILL.md')).toThrow();
  });

  it('rejects malformed owner_task', () => {
    const bad = VALID_FRONTMATTER.replace('owner_task: T-020', 'owner_task: task-020');
    expect(() => parseSkillFile(bad, 'x/SKILL.md')).toThrow();
  });

  it('rejects unknown frontmatter fields (strict)', () => {
    const bad = VALID_FRONTMATTER.replace('related: []', 'related: []\nreleated: []');
    expect(() => parseSkillFile(bad, 'x/SKILL.md')).toThrow();
  });
});

describe('validateSkill', () => {
  const makeSkill = (overrides: Partial<ParsedSkill> = {}): ParsedSkill => ({
    path: 'skills/stageflip/concepts/schema/SKILL.md',
    frontmatter: {
      title: 'Canonical Schema',
      id: 'skills/stageflip/concepts/schema',
      tier: 'concept',
      status: 'substantive',
      last_updated: '2026-04-20',
      owner_task: 'T-020',
      related: [],
    },
    body: 'Non-empty body.\n',
    ...overrides,
  });

  it('passes on a valid skill', () => {
    expect(validateSkill(makeSkill())).toEqual([]);
  });

  it('flags an id that does not match the path', () => {
    const skill = makeSkill({
      frontmatter: {
        ...makeSkill().frontmatter,
        id: 'skills/stageflip/concepts/rir',
      },
    });
    const issues = validateSkill(skill);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toMatch(/does not match path-derived/);
  });

  it('flags an unresolved related link when treeIds is provided', () => {
    const skill = makeSkill({
      frontmatter: {
        ...makeSkill().frontmatter,
        related: ['skills/stageflip/concepts/nonexistent/SKILL.md'],
      },
    });
    const issues = validateSkill(skill, { treeIds: new Set(['skills/stageflip/concepts/schema']) });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toMatch(/does not resolve/);
  });

  it('warns on an empty body', () => {
    const skill = makeSkill({ body: '   \n  \n' });
    const issues = validateSkill(skill);
    expect(issues.some((i) => i.severity === 'warn' && i.message.includes('body is empty'))).toBe(
      true,
    );
  });
});

describe('loadSkillTree + validateTree (integration)', () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'stageflip-skills-'));
  });

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  const writeSkill = async (
    relPath: string,
    frontmatter: Record<string, unknown>,
    body = 'body',
  ) => {
    const full = join(tmpRoot, relPath);
    await mkdir(join(full, '..'), { recursive: true });
    const fm = Object.entries(frontmatter)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('\n');
    await writeFile(full, `---\n${fm}\n---\n\n${body}\n`);
  };

  it('loads multiple skills and indexes by id and tier', async () => {
    await writeSkill('skills/stageflip/concepts/a/SKILL.md', {
      title: 'A',
      id: 'skills/stageflip/concepts/a',
      tier: 'concept',
      status: 'substantive',
      last_updated: '2026-04-20',
      owner_task: 'T-001',
      related: [],
    });
    await writeSkill('skills/stageflip/runtimes/b/SKILL.md', {
      title: 'B',
      id: 'skills/stageflip/runtimes/b',
      tier: 'runtime',
      status: 'placeholder',
      last_updated: '2026-04-20',
      owner_task: 'T-002',
      related: ['skills/stageflip/concepts/a/SKILL.md'],
    });

    const tree = await loadSkillTree(join(tmpRoot, 'skills/stageflip'), { basePath: tmpRoot });
    expect(tree.skills).toHaveLength(2);
    expect(tree.byId.get('skills/stageflip/concepts/a')?.frontmatter.title).toBe('A');
    expect(tree.byTier.get('concept')).toHaveLength(1);
    expect(tree.byTier.get('runtime')).toHaveLength(1);

    const issues = validateTree(tree);
    expect(issues).toEqual([]);
  });

  it('reports issues when related link is unresolved', async () => {
    await writeSkill('skills/stageflip/concepts/a/SKILL.md', {
      title: 'A',
      id: 'skills/stageflip/concepts/a',
      tier: 'concept',
      status: 'substantive',
      last_updated: '2026-04-20',
      owner_task: 'T-001',
      related: ['skills/stageflip/concepts/missing/SKILL.md'],
    });
    const tree = await loadSkillTree(join(tmpRoot, 'skills/stageflip'), { basePath: tmpRoot });
    const issues = validateTree(tree);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => i.message.includes('does not resolve'))).toBe(true);
  });
});
