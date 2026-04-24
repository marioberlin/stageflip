// apps/cli/src/commands/plugin-install.test.ts

import { promises as fs, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CliEnv } from '../types.js';
import { runPluginInstall } from './plugin-install.js';

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'stageflip-plugin-install-'));
});
afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

async function seedSkills(src: string): Promise<void> {
  await fs.mkdir(path.join(src, 'concepts', 'rir'), { recursive: true });
  await fs.writeFile(
    path.join(src, 'concepts', 'rir', 'SKILL.md'),
    '---\ntitle: RIR\nid: skills/stageflip/concepts/rir\ntier: concept\n---\n# RIR\n',
  );
}

function envFor(overrides: Record<string, string | undefined> = {}): {
  env: CliEnv;
  logs: string[];
  errors: string[];
} {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    logs,
    errors,
    env: {
      cwd: workDir,
      env: overrides,
      log: (l) => logs.push(l),
      error: (l) => errors.push(l),
      exit: () => {
        throw new Error('unexpected exit');
      },
    },
  };
}

describe('plugin install', () => {
  it('bundles the skills tree into the chosen destination', async () => {
    const skillsSrc = path.join(workDir, 'skills-src');
    await seedSkills(skillsSrc);
    const dest = path.join(workDir, 'plugin-out');
    const { env, logs } = envFor({
      STAGEFLIP_SKILLS_DIR: skillsSrc,
      STAGEFLIP_MCP_URL: 'https://mcp.stageflip.dev/mcp',
    });

    const code = await runPluginInstall({ env, args: [dest], flags: {} });
    expect(code).toBe(0);
    expect(logs.join('\n')).toContain(dest);
    expect(logs.join('\n')).toMatch(/content hash:\s+[0-9a-f]{64}/);

    await expect(
      fs.access(path.join(dest, '.claude-plugin', 'plugin.json')),
    ).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, '.mcp.json'))).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(dest, 'skills', 'concepts', 'rir', 'SKILL.md')),
    ).resolves.toBeUndefined();
  });

  it('falls back to <cwd>/stageflip-plugin when no destination is provided', async () => {
    const skillsSrc = path.join(workDir, 'skills-src');
    await seedSkills(skillsSrc);
    const { env, logs } = envFor({ STAGEFLIP_SKILLS_DIR: skillsSrc });
    const code = await runPluginInstall({ env, args: [], flags: {} });
    expect(code).toBe(0);
    expect(logs.some((l) => l.includes(path.join(workDir, 'stageflip-plugin')))).toBe(true);
  });
});
