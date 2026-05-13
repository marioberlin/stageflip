// apps/docs/src/lib/marketplace.ts
// T-538 — pure helpers for the marketplace catalogue UI. The
// prebuild script (`scripts/build-marketplace-pages.ts`) walks
// `packs/stageflip/<publisher>/<id>/<version>/manifest.json` and
// feeds parsed manifests into the helpers here to render markdown
// + emit the marketplace sidebar manifest. No I/O lives in this
// file so the unit tests can be deterministic and the docs app
// stays static-only.

import type { PackManifest } from '@stageflip/pack-format';

/** Sidebar item shape consumed by `astro.config.mjs`. */
export interface MarketplaceSidebarItem {
  readonly label: string;
  readonly slug: string;
}

/** Sidebar group shape consumed by `astro.config.mjs`. */
export interface MarketplaceSidebarGroup {
  readonly label: string;
  readonly items: MarketplaceSidebarItem[];
}

/**
 * Ordered tier → group label map. Order matches the catalogue
 * tier headings (paid first because every launch pack ships
 * paid-per-tenant; open + enterprise groups appear only when a
 * matching pack exists).
 */
const TIER_LABELS: ReadonlyArray<{ kind: PackManifest['license']['kind']; label: string }> = [
  { kind: 'paid-per-tenant', label: 'Paid (per-tenant)' },
  { kind: 'enterprise', label: 'Enterprise' },
  { kind: 'open', label: 'Open' },
];

/** Compare two semver strings (no pre-release / build suffix support). */
export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((s) => Number.parseInt(s, 10));
  const pb = b.split('.').map((s) => Number.parseInt(s, 10));
  for (let i = 0; i < 3; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va !== vb) return va < vb ? -1 : 1;
  }
  return 0;
}

/**
 * Reduce a list of `(manifest, version)` candidates to the highest-version
 * manifest per `(publisher.id, id)` pair. The input order does not affect
 * the result; ties on version (impossible by filesystem layout but cheap
 * to handle) keep the first occurrence.
 */
export function pickHighestVersionPerPack(manifests: readonly PackManifest[]): PackManifest[] {
  const byKey = new Map<string, PackManifest>();
  for (const m of manifests) {
    const key = `${m.publisher.id}/${m.id}`;
    const prev = byKey.get(key);
    if (!prev || compareSemver(m.version, prev.version) > 0) {
      byKey.set(key, m);
    }
  }
  return [...byKey.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Human-readable license tier label. */
export function licenseTierLabel(license: PackManifest['license']): string {
  switch (license.kind) {
    case 'open':
      return `Open (${license.spdx})`;
    case 'paid-per-tenant':
      return `Paid (per-tenant, ${license.entitlementType})`;
    case 'enterprise':
      return 'Enterprise';
  }
}

/** Group contribute presets by `cluster` (preserves cluster encounter order). */
export function groupPresetsByCluster(
  manifest: PackManifest,
): Array<{ cluster: string; presetIds: string[] }> {
  const groups = new Map<string, string[]>();
  for (const preset of manifest.contributes.presets ?? []) {
    const existing = groups.get(preset.cluster);
    if (existing) existing.push(preset.id);
    else groups.set(preset.cluster, [preset.id]);
  }
  return [...groups.entries()].map(([cluster, presetIds]) => ({ cluster, presetIds }));
}

/** Summary counts per `contributes` category, omitting zero buckets. */
export function summarizeContributes(
  manifest: PackManifest,
): Array<{ label: string; count: number }> {
  const c = manifest.contributes;
  const buckets: Array<{ label: string; count: number }> = [
    { label: 'Presets', count: c.presets?.length ?? 0 },
    { label: 'Clip kinds', count: c.clipKinds?.length ?? 0 },
    { label: 'Fonts', count: c.fonts?.length ?? 0 },
    { label: 'Fixtures', count: c.fixtures?.length ?? 0 },
    { label: 'Assets', count: c.assets?.length ?? 0 },
    { label: 'Tools', count: c.tools?.length ?? 0 },
    { label: 'Adapters', count: c.adapters?.length ?? 0 },
    { label: 'Theme packs', count: c.themePacks?.length ?? 0 },
  ];
  return buckets.filter((b) => b.count > 0);
}

/**
 * Build the catalogue-index markdown body. Lists every pack
 * alphabetically by id, grouped by license-tier heading.
 */
export function renderCatalogueIndex(manifests: readonly PackManifest[]): string {
  const sorted = [...manifests].sort((a, b) => a.id.localeCompare(b.id));
  const lines: string[] = [];
  lines.push('---');
  lines.push('title: Marketplace');
  lines.push('description: Browse first-party StageFlip packs.');
  lines.push('---');
  lines.push('');
  lines.push(
    'The StageFlip marketplace lists every first-party pack available for install. ' +
      'Each card links to the pack detail page with its manifest contents and install snippet. ' +
      'See ADR-014 for the marketplace architecture.',
  );
  lines.push('');

  for (const { kind, label } of TIER_LABELS) {
    const inTier = sorted.filter((m) => m.license.kind === kind);
    if (inTier.length === 0) continue;
    lines.push(`## ${label}`);
    lines.push('');
    for (const m of inTier) {
      const desc = m.description ?? `${m.name} — StageFlip pack.`;
      lines.push(`### [${m.name}](/marketplace/${m.id}/)`);
      lines.push('');
      lines.push(`**\`${m.id}@${m.version}\`** — publisher \`${m.publisher.id}\``);
      lines.push('');
      lines.push(desc);
      if (m.keywords && m.keywords.length > 0) {
        lines.push('');
        lines.push(`Keywords: ${m.keywords.map((k) => `\`${k}\``).join(', ')}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

/**
 * Build a per-pack detail page (markdown body, Starlight-safe frontmatter).
 * Renders manifest contents in a stable order so the output is byte-deterministic.
 */
export function renderPackDetail(manifest: PackManifest): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push(`title: ${escapeYaml(manifest.name)}`);
  const desc = manifest.description ?? `${manifest.name} — StageFlip pack.`;
  lines.push(`description: ${escapeYaml(desc.slice(0, 160))}`);
  lines.push('---');
  lines.push('');
  lines.push(`**Pack id:** \`${manifest.id}\``);
  lines.push('');
  lines.push(`**Version:** \`${manifest.version}\``);
  lines.push('');
  lines.push(`**Publisher:** ${manifest.publisher.displayName} (\`${manifest.publisher.id}\`)`);
  lines.push('');
  lines.push(`**License:** ${licenseTierLabel(manifest.license)}`);
  if (manifest.license.kind !== 'open') {
    lines.push('');
    lines.push(`**SKU:** \`${manifest.license.sku}\``);
  }
  lines.push('');
  lines.push(`**Platform compatibility:** \`${manifest.platformCompatibility}\``);
  lines.push('');

  if (manifest.description) {
    lines.push('## Description');
    lines.push('');
    lines.push(manifest.description);
    lines.push('');
  }

  if (manifest.keywords && manifest.keywords.length > 0) {
    lines.push('## Keywords');
    lines.push('');
    lines.push(manifest.keywords.map((k) => `\`${k}\``).join(', '));
    lines.push('');
  }

  if (manifest.homepage) {
    lines.push(`**Homepage:** <${manifest.homepage}>`);
    lines.push('');
  }
  if (manifest.repository) {
    lines.push(`**Repository:** <${manifest.repository}>`);
    lines.push('');
  }

  const contributeSummary = summarizeContributes(manifest);
  if (contributeSummary.length > 0) {
    lines.push('## Contributes');
    lines.push('');
    for (const { label, count } of contributeSummary) {
      lines.push(`- ${label}: ${count}`);
    }
    lines.push('');
  }

  const presetGroups = groupPresetsByCluster(manifest);
  if (presetGroups.length > 0) {
    lines.push('## Presets');
    lines.push('');
    for (const { cluster, presetIds } of presetGroups) {
      lines.push(`### ${cluster}`);
      lines.push('');
      for (const id of presetIds) {
        lines.push(`- \`${id}\``);
      }
      lines.push('');
    }
  }

  lines.push('## Install');
  lines.push('');
  lines.push('```sh');
  lines.push(`stageflip-pack install ${manifest.id}@${manifest.version}`);
  lines.push('```');
  lines.push('');
  lines.push(
    '> The `stageflip pack` CLI ships in T-497. Until then, packs are wired in at ' +
      'workspace level via the pack-format loader.',
  );
  lines.push('');

  return lines.join('\n');
}

/**
 * Build the marketplace sidebar manifest consumed by `astro.config.mjs`.
 * Returns a single-group structure: `Marketplace` containing the index
 * route followed by every per-pack detail page (alphabetical by id).
 */
export function buildMarketplaceSidebar(
  manifests: readonly PackManifest[],
): MarketplaceSidebarGroup[] {
  const sorted = [...manifests].sort((a, b) => a.id.localeCompare(b.id));
  const items: MarketplaceSidebarItem[] = [{ label: 'Catalogue', slug: 'marketplace' }];
  for (const m of sorted) {
    items.push({ label: m.name, slug: `marketplace/${m.id}` });
  }
  return [{ label: 'Marketplace', items }];
}

function escapeYaml(value: string): string {
  if (/[:#&*!|>'"%@`\n]/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}
