// packages/plugin/src/bundle.ts
// T-224 — bundle a skills tree + manifests into a Claude-plugin
// directory. The produced layout matches the public Claude-plugin
// convention:
//
//   <dest>/
//     .claude-plugin/plugin.json    — top-level manifest
//     .mcp.json                      — MCP server wiring
//     skills/<tier>/<name>/SKILL.md  — mirror of the source tree
//
// `writePluginBundle` returns a deterministic SHA-256 content hash
// derived from sorted-path + file-bytes (plus the two manifests).
// Same inputs → byte-identical hash across runs + machines. The
// hash is what the plugin registry uses to detect "did anything
// actually change since the last version".

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  type McpConfigInput,
  type PluginManifestInput,
  buildMcpConfig,
  buildPluginManifest,
} from './manifest.js';

export interface BundleSkillsTreeArgs {
  readonly source: string;
  readonly destination: string;
}

export interface BundleSkillsTreeResult {
  readonly filesCopied: number;
  readonly contentHash: string;
}

export async function bundleSkillsTree(
  args: BundleSkillsTreeArgs,
): Promise<BundleSkillsTreeResult> {
  const files = await collectSkillFiles(args.source);
  await fs.mkdir(args.destination, { recursive: true });

  const hash = createHash('sha256');
  for (const rel of files) {
    const srcAbs = path.join(args.source, rel);
    const destAbs = path.join(args.destination, rel);
    const bytes = await fs.readFile(srcAbs);
    await fs.mkdir(path.dirname(destAbs), { recursive: true });
    await fs.writeFile(destAbs, bytes);
    // Hash layout: `<rel>\0<length>\0<bytes>\0` — length guards against
    // ambiguity between adjacent entries.
    hash.update(rel);
    hash.update('\0');
    hash.update(String(bytes.length));
    hash.update('\0');
    hash.update(bytes);
    hash.update('\0');
  }

  return {
    filesCopied: files.length,
    contentHash: hash.digest('hex'),
  };
}

export interface WritePluginBundleArgs {
  readonly destination: string;
  readonly skillsSource: string;
  readonly manifest: PluginManifestInput;
  readonly mcp: McpConfigInput;
}

export interface WritePluginBundleResult extends BundleSkillsTreeResult {}

export async function writePluginBundle(
  args: WritePluginBundleArgs,
): Promise<WritePluginBundleResult> {
  await fs.mkdir(args.destination, { recursive: true });

  const manifest = buildPluginManifest(args.manifest);
  const mcp = buildMcpConfig(args.mcp);

  const pluginDir = path.join(args.destination, '.claude-plugin');
  await fs.mkdir(pluginDir, { recursive: true });

  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  const mcpJson = `${JSON.stringify(mcp, null, 2)}\n`;
  await fs.writeFile(path.join(pluginDir, 'plugin.json'), manifestJson);
  await fs.writeFile(path.join(args.destination, '.mcp.json'), mcpJson);

  const skills = await bundleSkillsTree({
    source: args.skillsSource,
    destination: path.join(args.destination, 'skills'),
  });

  // Fold the two manifest files into the bundle hash so a version/URL
  // change is visible at the bundle level, not just the skills tree.
  const fullHash = createHash('sha256');
  fullHash.update(skills.contentHash);
  fullHash.update('\0plugin.json\0');
  fullHash.update(manifestJson);
  fullHash.update('\0.mcp.json\0');
  fullHash.update(mcpJson);

  return {
    filesCopied: skills.filesCopied,
    contentHash: fullHash.digest('hex'),
  };
}

/**
 * Re-hash an existing plugin bundle directory. Used by consumers that
 * need to verify "does the on-disk bundle match what we expected to
 * write" without re-running `writePluginBundle`.
 */
export async function hashPluginBundle(dir: string): Promise<string> {
  const skillsDir = path.join(dir, 'skills');
  const files = await collectSkillFiles(skillsDir);
  const skillsHash = createHash('sha256');
  for (const rel of files) {
    const abs = path.join(skillsDir, rel);
    const bytes = await fs.readFile(abs);
    skillsHash.update(rel);
    skillsHash.update('\0');
    skillsHash.update(String(bytes.length));
    skillsHash.update('\0');
    skillsHash.update(bytes);
    skillsHash.update('\0');
  }

  const manifestJson = await fs.readFile(path.join(dir, '.claude-plugin', 'plugin.json'), 'utf8');
  const mcpJson = await fs.readFile(path.join(dir, '.mcp.json'), 'utf8');

  const full = createHash('sha256');
  full.update(skillsHash.digest('hex'));
  full.update('\0plugin.json\0');
  full.update(manifestJson);
  full.update('\0.mcp.json\0');
  full.update(mcpJson);
  return full.digest('hex');
}

/** Recursively collect every `SKILL.md` file, return paths relative to `root`. */
async function collectSkillFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(current: string, prefix: string): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }
    // Sort entries so traversal order is stable regardless of filesystem.
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const abs = path.join(current, e.name);
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(abs, rel);
      else if (e.isFile() && e.name === 'SKILL.md') out.push(rel);
    }
  }
  await walk(root, '');
  return out;
}
