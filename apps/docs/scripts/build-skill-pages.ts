// apps/docs/scripts/build-skill-pages.ts
// T-228 prebuild step. Copies every skills/stageflip/**/SKILL.md
// into apps/docs/src/content/docs/skills/**/index.md with
// Starlight-safe frontmatter (title + description only), and emits
// src/generated/sidebar.json for astro.config.mjs.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { type SkillEntry, buildSkillsSidebar } from '../src/lib/sidebar.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(DOCS_ROOT, '..', '..');
const SKILLS_SRC = path.join(REPO_ROOT, 'skills', 'stageflip');
const CONTENT_DEST = path.join(DOCS_ROOT, 'src', 'content', 'docs', 'skills', 'stageflip');
const SIDEBAR_OUT = path.join(DOCS_ROOT, 'src', 'generated', 'sidebar.json');

interface Frontmatter {
  title?: string;
  id?: string;
  tier?: string;
  status?: string;
  last_updated?: string;
  owner_task?: string;
  related?: string[];
}

async function collectSkills(
  root: string,
): Promise<Array<{ rel: string; body: string; fm: Frontmatter }>> {
  const out: Array<{ rel: string; body: string; fm: Frontmatter }> = [];
  async function walk(current: string, prefix: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const abs = path.join(current, e.name);
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(abs, rel);
      else if (e.isFile() && e.name === 'SKILL.md') {
        const raw = await fs.readFile(abs, 'utf8');
        const { frontmatter, body } = parseFrontmatter(raw);
        out.push({ rel, body, fm: frontmatter });
      }
    }
  }
  await walk(root, '');
  return out;
}

function parseFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  if (!raw.startsWith('---\n')) return { frontmatter: {}, body: raw };
  const end = raw.indexOf('\n---\n', 4);
  if (end < 0) return { frontmatter: {}, body: raw };
  const block = raw.slice(4, end);
  const body = raw.slice(end + 5);
  const fm: Frontmatter = {};
  let pendingKey: keyof Frontmatter | null = null;
  const lines = block.split('\n');
  const related: string[] = [];
  for (const line of lines) {
    if (line.startsWith('  - ')) {
      if (pendingKey === 'related') related.push(line.slice(4).trim());
      continue;
    }
    const match = /^([a-z_]+):\s*(.*)$/i.exec(line);
    if (!match) continue;
    const key = match[1] as string;
    const value = match[2] ?? '';
    pendingKey = null;
    if (key === 'related') {
      pendingKey = 'related';
      continue;
    }
    if (
      key === 'title' ||
      key === 'id' ||
      key === 'tier' ||
      key === 'status' ||
      key === 'last_updated' ||
      key === 'owner_task'
    ) {
      (fm as Record<string, string>)[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }
  if (related.length > 0) fm.related = related;
  return { frontmatter: fm, body };
}

function escapeYamlScalar(value: string): string {
  if (/[:#&*!|>'"%@`]/.test(value) || value.includes('\n')) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}

function starlightMarkdown(fm: Frontmatter, body: string): string {
  const title = fm.title ?? 'Untitled skill';
  const lines = ['---', `title: ${escapeYamlScalar(title)}`];
  if (fm.tier) lines.push(`description: ${escapeYamlScalar(`${fm.tier} — StageFlip skill`)}`);
  lines.push('---', '', body.trimStart());
  return lines.join('\n');
}

async function main(): Promise<void> {
  const skills = await collectSkills(SKILLS_SRC);

  await fs.rm(CONTENT_DEST, { recursive: true, force: true });
  await fs.mkdir(CONTENT_DEST, { recursive: true });

  const entries: SkillEntry[] = [];
  for (const { rel, body, fm } of skills) {
    if (!fm.id || !fm.tier || !fm.title) {
      process.stderr.write(`skip: ${rel} is missing title/id/tier\n`);
      continue;
    }
    // `rel` is e.g. `concepts/rir/SKILL.md` — re-home as
    // `concepts/rir.md` for Astro 5 + Starlight standard routing
    // (each file becomes one route).
    const withoutSkill = rel.replace(/\/SKILL\.md$/, '.md');
    const destPath = path.join(CONTENT_DEST, withoutSkill);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, starlightMarkdown(fm, body));
    entries.push({ id: fm.id, title: fm.title, tier: fm.tier });
  }

  const sidebar = buildSkillsSidebar(entries);
  await fs.mkdir(path.dirname(SIDEBAR_OUT), { recursive: true });
  await fs.writeFile(SIDEBAR_OUT, `${JSON.stringify(sidebar, null, 2)}\n`);

  process.stdout.write(
    `build-skill-pages: wrote ${entries.length} pages; ${sidebar.length} sidebar groups.\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
  process.exit(1);
});
