// apps/docs/scripts/build-marketplace-pages.ts
// T-538 prebuild step. Walks every
// `packs/<publisher>/<id>/<version>/manifest.json`, picks the
// highest version per (publisher, id), and emits:
//   - `src/content/docs/marketplace/index.md` (catalogue index)
//   - `src/content/docs/marketplace/<id>/index.md` (per-pack detail)
//   - `src/generated/marketplace-sidebar.json` (consumed by astro.config.mjs)
//
// Static-site only — no live fetch, no SSR. The build artefacts here
// are the entire marketplace UI surface (Starlight renders them).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { type PackManifest, parsePackManifest } from '@stageflip/pack-format';

import {
  type MarketplaceSidebarGroup,
  buildMarketplaceSidebar,
  pickHighestVersionPerPack,
  renderCatalogueIndex,
  renderPackDetail,
} from '../src/lib/marketplace.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(DOCS_ROOT, '..', '..');
const PACKS_SRC = path.join(REPO_ROOT, 'packs');
const CONTENT_DEST = path.join(DOCS_ROOT, 'src', 'content', 'docs', 'marketplace');
const SIDEBAR_OUT = path.join(DOCS_ROOT, 'src', 'generated', 'marketplace-sidebar.json');

interface DiscoveredManifest {
  readonly manifest: PackManifest;
  readonly sourcePath: string;
}

/**
 * Walk `<root>/<publisher>/<id>/<version>/manifest.json` and return
 * every successfully-parsed manifest. Malformed manifests log a
 * warning and are skipped — they MUST NOT block the docs build.
 */
export async function discoverManifests(
  root: string,
  warn: (msg: string) => void = (m) => process.stderr.write(`${m}\n`),
): Promise<DiscoveredManifest[]> {
  const out: DiscoveredManifest[] = [];
  let publishers: string[];
  try {
    publishers = (await fs.readdir(root, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return out;
  }
  for (const publisher of publishers) {
    const publisherDir = path.join(root, publisher);
    const packIds = (await fs.readdir(publisherDir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    for (const packId of packIds) {
      const packDir = path.join(publisherDir, packId);
      const versions = (await fs.readdir(packDir, { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
      for (const version of versions) {
        const manifestPath = path.join(packDir, version, 'manifest.json');
        try {
          const raw = await fs.readFile(manifestPath, 'utf8');
          const parsed = JSON.parse(raw) as unknown;
          const manifest = parsePackManifest(parsed);
          out.push({ manifest, sourcePath: manifestPath });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          warn(`build-marketplace-pages: skipping ${manifestPath} — ${msg}`);
        }
      }
    }
  }
  return out;
}

/**
 * Pure renderer — given the resolved (highest-version) manifests,
 * write the catalogue index, every per-pack detail page, and the
 * sidebar manifest under `destContentRoot` + `sidebarOutPath`.
 */
export async function emitMarketplaceSite(
  manifests: readonly PackManifest[],
  destContentRoot: string,
  sidebarOutPath: string,
): Promise<{ pages: number; sidebar: MarketplaceSidebarGroup[] }> {
  await fs.rm(destContentRoot, { recursive: true, force: true });
  await fs.mkdir(destContentRoot, { recursive: true });

  // Catalogue index at `<destContentRoot>/index.md`.
  await fs.writeFile(path.join(destContentRoot, 'index.md'), renderCatalogueIndex(manifests));

  // Per-pack detail at `<destContentRoot>/<id>/index.md`.
  for (const m of manifests) {
    const packDir = path.join(destContentRoot, m.id);
    await fs.mkdir(packDir, { recursive: true });
    await fs.writeFile(path.join(packDir, 'index.md'), renderPackDetail(m));
  }

  const sidebar = buildMarketplaceSidebar(manifests);
  await fs.mkdir(path.dirname(sidebarOutPath), { recursive: true });
  await fs.writeFile(sidebarOutPath, `${JSON.stringify(sidebar, null, 2)}\n`);

  return { pages: 1 + manifests.length, sidebar };
}

async function main(): Promise<void> {
  const discovered = await discoverManifests(PACKS_SRC);
  const highest = pickHighestVersionPerPack(discovered.map((d) => d.manifest));
  const { pages, sidebar } = await emitMarketplaceSite(highest, CONTENT_DEST, SIDEBAR_OUT);
  process.stdout.write(
    `build-marketplace-pages: wrote ${pages} pages; ${sidebar[0]?.items.length ?? 0} sidebar entries.\n`,
  );
}

// Only run main() when invoked as a script (not when imported by tests).
const __thisFile = fileURLToPath(import.meta.url);
const argvEntry = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (argvEntry === path.resolve(__thisFile)) {
  main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
    process.exit(1);
  });
}
