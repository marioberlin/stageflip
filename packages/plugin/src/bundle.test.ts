// packages/plugin/src/bundle.test.ts
// T-224 — bundle a skills tree + manifests into a plugin-shaped
// directory. Tests drive a tmp source + tmp dest so the real repo
// tree is never mutated.

import { promises as fs, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { bundleSkillsTree, hashPluginBundle, writePluginBundle } from './bundle.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'stageflip-plugin-'));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function seedSkills(src: string): Promise<void> {
  await fs.mkdir(path.join(src, 'concepts', 'rir'), { recursive: true });
  await fs.writeFile(
    path.join(src, 'concepts', 'rir', 'SKILL.md'),
    '---\ntitle: RIR\nid: skills/stageflip/concepts/rir\ntier: concept\n---\n\n# RIR\n',
  );
  await fs.mkdir(path.join(src, 'tools'), { recursive: true });
  await fs.writeFile(
    path.join(src, 'tools', 'SKILL.md'),
    '---\ntitle: Tools\nid: skills/stageflip/tools\ntier: tools\n---\n\n# Tools\n',
  );
}

describe('bundleSkillsTree', () => {
  it('copies every SKILL.md from the source tree to the destination', async () => {
    const src = path.join(root, 'src-skills');
    const dest = path.join(root, 'dest-plugin');
    await seedSkills(src);
    const result = await bundleSkillsTree({ source: src, destination: dest });
    expect(result.filesCopied).toBe(2);
    const destFiles = await collectSkillFiles(dest);
    expect(destFiles.sort()).toEqual(['concepts/rir/SKILL.md', 'tools/SKILL.md']);
  });

  it('produces a SHA-256 content hash that is stable across runs', async () => {
    const src = path.join(root, 'src-skills');
    const destA = path.join(root, 'a');
    const destB = path.join(root, 'b');
    await seedSkills(src);
    const a = await bundleSkillsTree({ source: src, destination: destA });
    const b = await bundleSkillsTree({ source: src, destination: destB });
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes the content hash when a file content changes', async () => {
    const src = path.join(root, 'src-skills');
    await seedSkills(src);
    const dest1 = path.join(root, 'd1');
    const dest2 = path.join(root, 'd2');
    const before = await bundleSkillsTree({ source: src, destination: dest1 });
    await fs.appendFile(path.join(src, 'concepts', 'rir', 'SKILL.md'), '\nmore content\n');
    const after = await bundleSkillsTree({ source: src, destination: dest2 });
    expect(before.contentHash).not.toBe(after.contentHash);
  });

  it('ignores non-markdown files by default (only SKILL.md copied)', async () => {
    const src = path.join(root, 'src-skills');
    await seedSkills(src);
    await fs.writeFile(path.join(src, 'README.md'), '# readme');
    await fs.writeFile(path.join(src, 'concepts', 'rir', 'scratch.txt'), 'junk');
    const dest = path.join(root, 'dest');
    const result = await bundleSkillsTree({ source: src, destination: dest });
    expect(result.filesCopied).toBe(2);
    await expect(fs.access(path.join(dest, 'README.md'))).rejects.toThrow();
  });
});

describe('writePluginBundle', () => {
  it('produces the full plugin directory layout + manifests + hash', async () => {
    const src = path.join(root, 'src-skills');
    const dest = path.join(root, 'dist-plugin');
    await seedSkills(src);

    const result = await writePluginBundle({
      destination: dest,
      skillsSource: src,
      manifest: {
        name: 'stageflip',
        version: '0.1.0',
        description: 'Motion platform.',
        author: { name: 'StageFlip' },
      },
      mcp: { serverUrl: 'https://mcp.stageflip.dev/mcp' },
    });

    const pluginJson = JSON.parse(
      await fs.readFile(path.join(dest, '.claude-plugin', 'plugin.json'), 'utf8'),
    );
    expect(pluginJson.name).toBe('stageflip');

    const mcpJson = JSON.parse(await fs.readFile(path.join(dest, '.mcp.json'), 'utf8'));
    expect(mcpJson.mcpServers.stageflip.url).toBe('https://mcp.stageflip.dev/mcp');

    const skillPath = path.join(dest, 'skills', 'concepts', 'rir', 'SKILL.md');
    await expect(fs.access(skillPath)).resolves.toBeUndefined();

    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.filesCopied).toBe(2);
  });

  it('is idempotent — same inputs produce the same hash twice', async () => {
    const src = path.join(root, 'src-skills');
    await seedSkills(src);
    const first = await writePluginBundle({
      destination: path.join(root, 'out1'),
      skillsSource: src,
      manifest: {
        name: 'stageflip',
        version: '0.1.0',
        description: 'Motion platform.',
        author: { name: 'StageFlip' },
      },
      mcp: { serverUrl: 'https://mcp.stageflip.dev/mcp' },
    });
    const second = await writePluginBundle({
      destination: path.join(root, 'out2'),
      skillsSource: src,
      manifest: {
        name: 'stageflip',
        version: '0.1.0',
        description: 'Motion platform.',
        author: { name: 'StageFlip' },
      },
      mcp: { serverUrl: 'https://mcp.stageflip.dev/mcp' },
    });
    expect(first.contentHash).toBe(second.contentHash);
  });
});

describe('hashPluginBundle', () => {
  it('hashes the directory structurally — re-bundling an existing dest yields the same hash', async () => {
    const src = path.join(root, 'src-skills');
    await seedSkills(src);
    const dest = path.join(root, 'dest');
    const bundled = await writePluginBundle({
      destination: dest,
      skillsSource: src,
      manifest: {
        name: 'stageflip',
        version: '0.1.0',
        description: 'Motion platform.',
        author: { name: 'StageFlip' },
      },
      mcp: { serverUrl: 'https://mcp.stageflip.dev/mcp' },
    });
    const rehash = await hashPluginBundle(dest);
    expect(rehash).toBe(bundled.contentHash);
  });
});

/** Recursively enumerate every `SKILL.md` file path under `dir`, relative. */
async function collectSkillFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(current: string, prefix: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(current, e.name);
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(abs, rel);
      else if (e.isFile() && e.name === 'SKILL.md') out.push(rel);
    }
  }
  await walk(dir, '');
  return out;
}
