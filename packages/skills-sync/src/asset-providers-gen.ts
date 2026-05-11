// packages/skills-sync/src/asset-providers-gen.ts
// Generator for skills/stageflip/reference/asset-providers/SKILL.md — the
// vendor-neutral catalog of registered asset-generation adapters (T-424).
// Walks an `AdapterRegistry` snapshot (or an equivalent `AssetProvidersPkg`)
// and emits a markdown table per ADR-007 §D1 + ADR-008 §D6 / §D13.
//
// On `main` today the registry is empty — the inaugural SKILL says
// "0 adapters currently registered". Reference adapters T-426..T-434
// register themselves at sync-skills time and the catalog populates
// automatically once any of those tasks land.

import type { AdapterDescriptor, AdapterModalityKind } from '@stageflip/adapters-core';

/** Snapshot consumed by the generator. Built from `AdapterRegistry.list()`. */
export interface AssetProvidersPkg {
  readonly adapters: readonly AdapterDescriptor[];
}

/** Single rendered row — exposed for testing the column-derivation seam. */
export interface AssetProvidersAdapterRow {
  readonly id: string;
  readonly modality: AdapterModalityKind;
  readonly capabilitySummary: string;
  readonly license: string;
  readonly costTier: string;
  readonly latencyTier: string;
  readonly requiresResearchProvider: 'yes' | 'no';
}

const LAST_UPDATED = '2026-05-11';

/**
 * Render the asset-providers SKILL.md.
 *
 * Pure: same `AssetProvidersPkg` → byte-identical output. Sort is stable
 * by `(modality.kind ASC, id ASC)`; the input order is not preserved.
 */
export function generateAssetProvidersSkill(pkg: AssetProvidersPkg): string {
  const rows = pkg.adapters.map(toRow).sort((a, b) => {
    if (a.modality !== b.modality) return a.modality < b.modality ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  });

  const frontmatter = [
    '---',
    'title: Reference — Asset Providers',
    'id: skills/stageflip/reference/asset-providers',
    'tier: reference',
    'status: auto-generated',
    `last_updated: ${LAST_UPDATED}`,
    'owner_task: T-424',
    'related:',
    '  - skills/stageflip/concepts/provider-seam',
    '  - skills/stageflip/tools/asset-generation',
    '---',
    '',
  ].join('\n');

  const intro = [
    '# Reference — Asset Providers',
    '',
    "**Auto-generated from `@stageflip/adapters-core`'s `AdapterRegistry`.**",
    'Do NOT edit by hand — run `pnpm skills-sync` after registering or',
    'removing an adapter; `pnpm skills-sync:check` fails in CI if the',
    'committed file drifts.',
    '',
    rows.length === 0
      ? '0 adapters currently registered; the catalog will populate as reference adapters T-426..T-434 land.'
      : `${rows.length} adapters registered (vendor-neutral; per-tenant license-posture filtering happens in the routing engine, T-425).`,
    '',
    'The catalog is the **vendor-neutral** view: every adapter that ships',
    'an `AdapterDescriptor` (ADR-007 §D1) appears here. Per-tenant',
    'license-posture filtering (ADR-007 §D3 / ADR-008 §D13) happens in',
    'the capability-routing engine (T-425), not here.',
    '',
  ].join('\n');

  const table = renderTable(rows);

  return [frontmatter, intro, table].join('\n');
}

function renderTable(rows: readonly AssetProvidersAdapterRow[]): string {
  const out: string[] = [];
  out.push('## Catalog');
  out.push('');
  out.push(
    '| Adapter ID | Modality | Capability summary | License | Cost tier | Latency tier | `requiresResearchProvider` |',
  );
  out.push('|---|---|---|---|---|---|---|');
  if (rows.length === 0) {
    out.push('| _empty_ | _empty_ | _empty_ | _empty_ | _empty_ | _empty_ | _empty_ |');
  } else {
    for (const r of rows) {
      out.push(
        `| \`${r.id}\` | ${r.modality} | ${r.capabilitySummary} | ${r.license} | ${r.costTier} | ${r.latencyTier} | ${r.requiresResearchProvider} |`,
      );
    }
  }
  out.push('');
  return out.join('\n');
}

function toRow(d: AdapterDescriptor): AssetProvidersAdapterRow {
  const requiresResearch =
    (typeof d.requiresResearchProvider === 'string' && d.requiresResearchProvider.length > 0) ||
    d.sourceGrounded === true;
  return {
    id: d.id,
    modality: d.modality.kind,
    capabilitySummary: capabilitySummary(d.modality.kind, d.capability),
    license: d.license.kind,
    costTier: costTier(d.costPerCall),
    latencyTier: latencyTier(d.latencyMs),
    requiresResearchProvider: requiresResearch ? 'yes' : 'no',
  };
}

/**
 * Cost-tier bucketing. `unspecified` when `costPerCall` is absent. Otherwise
 * bucketed by `usd`:
 *
 *   - `usd === 0` → `free`
 *   - `usd ≤ 0.10` → `paid`
 *   - `usd > 0.10` → `enterprise`
 *
 * When `usd` is absent but token-counts are zero, treat as `free`.
 */
function costTier(cost: AdapterDescriptor['costPerCall']): string {
  if (cost === undefined) return 'unspecified';
  if (cost.usd !== undefined) {
    if (cost.usd === 0) return 'free';
    if (cost.usd <= 0.1) return 'paid';
    return 'enterprise';
  }
  if ((cost.tokensIn ?? 0) === 0 && (cost.tokensOut ?? 0) === 0) return 'free';
  return 'unspecified';
}

/**
 * Latency-tier bucketing using `p95` when present, else `p50`.
 *
 *   - undefined → `unspecified`
 *   - `< 1000ms`   → `interactive < 1s`
 *   - `< 10_000ms` → `fast < 10s`
 *   - `< 300_000ms` → `batch < 5min`
 *   - `≥ 300_000ms` → `async`
 */
function latencyTier(latency: AdapterDescriptor['latencyMs']): string {
  if (latency === undefined) return 'unspecified';
  const ms = latency.p95 ?? latency.p50;
  if (ms === undefined) return 'unspecified';
  if (ms < 1_000) return 'interactive < 1s';
  if (ms < 10_000) return 'fast < 10s';
  if (ms < 300_000) return 'batch < 5min';
  return 'async';
}

/**
 * One-line summary per modality, derived from the opaque `capability`
 * envelope. ADR-008 §D6 enumerates the per-modality capability shapes;
 * this dispatch reads the documented fields with full duck-typing safety.
 * Unknown / malformed shapes return `—`.
 */
function capabilitySummary(
  kind: AdapterModalityKind,
  capability: AdapterDescriptor['capability'],
): string {
  switch (kind) {
    case 'tts': {
      const voiceCount = readNumber(capability, 'voiceCount');
      const sampleRateHz = readNumber(capability, 'sampleRateHz');
      const parts: string[] = [];
      if (voiceCount !== undefined) parts.push(`${voiceCount} voices`);
      if (sampleRateHz !== undefined) parts.push(`${sampleRateHz}Hz`);
      return parts.length > 0 ? parts.join(', ') : '—';
    }
    case 'video-gen': {
      const aspectRatios = readStringArray(capability, 'aspectRatios');
      const maxDurationSec = readNumber(capability, 'maxDurationSec');
      const parts: string[] = [];
      if (aspectRatios !== undefined && aspectRatios.length > 0) parts.push(aspectRatios.join('/'));
      if (maxDurationSec !== undefined) parts.push(`max ${maxDurationSec}s`);
      return parts.length > 0 ? parts.join(', ') : '—';
    }
    case 'music-gen': {
      const maxDurationSec = readNumber(capability, 'maxDurationSec');
      const sampleRateHz = readNumber(capability, 'sampleRateHz');
      const parts: string[] = [];
      if (maxDurationSec !== undefined) parts.push(`max ${maxDurationSec}s`);
      if (sampleRateHz !== undefined) parts.push(`${sampleRateHz}Hz`);
      return parts.length > 0 ? parts.join(', ') : '—';
    }
    case 'sfx': {
      const maxDurationSec = readNumber(capability, 'maxDurationSec');
      const sampleRateHz = readNumber(capability, 'sampleRateHz');
      const parts: string[] = [];
      if (maxDurationSec !== undefined) parts.push(`max ${maxDurationSec}s`);
      if (sampleRateHz !== undefined) parts.push(`${sampleRateHz}Hz`);
      return parts.length > 0 ? parts.join(', ') : '—';
    }
    case 'three-d': {
      const formats = readStringArray(capability, 'formats');
      const maxPolyCount = readNumber(capability, 'maxPolyCount');
      const parts: string[] = [];
      if (formats !== undefined && formats.length > 0) parts.push(formats.join('/'));
      if (maxPolyCount !== undefined) parts.push(`${maxPolyCount} poly`);
      return parts.length > 0 ? parts.join(', ') : '—';
    }
    case 'slide-deck-gen': {
      const maxSlides = readNumber(capability, 'maxSlides');
      return maxSlides !== undefined ? `max ${maxSlides} slides` : '—';
    }
    case 'mind-map-gen': {
      const maxNodes = readNumber(capability, 'maxNodes');
      return maxNodes !== undefined ? `max ${maxNodes} nodes` : '—';
    }
    case 'table-gen': {
      const maxRows = readNumber(capability, 'maxRows');
      const maxCols = readNumber(capability, 'maxCols');
      const parts: string[] = [];
      if (maxRows !== undefined) parts.push(`max ${maxRows} rows`);
      if (maxCols !== undefined) parts.push(`max ${maxCols} cols`);
      return parts.length > 0 ? parts.join(', ') : '—';
    }
    case 'quiz-gen': {
      const maxQuestions = readNumber(capability, 'maxQuestions');
      return maxQuestions !== undefined ? `max ${maxQuestions} questions` : '—';
    }
    case 'flashcard-gen': {
      const maxCards = readNumber(capability, 'maxCards');
      return maxCards !== undefined ? `max ${maxCards} cards` : '—';
    }
    case 'report-gen': {
      const maxSections = readNumber(capability, 'maxSections');
      return maxSections !== undefined ? `max ${maxSections} sections` : '—';
    }
    case 'infographic-gen': {
      const formats = readStringArray(capability, 'formats');
      return formats !== undefined && formats.length > 0 ? formats.join('/') : '—';
    }
    case 'research-session': {
      const providerName = readString(capability, 'providerName');
      return providerName !== undefined ? providerName : '—';
    }
    case 'audience-backend': {
      const transport = readString(capability, 'transport');
      return transport !== undefined ? transport : '—';
    }
    case 'bundle': {
      const bundleName = readString(capability, 'bundleName');
      return bundleName !== undefined ? bundleName : '—';
    }
  }
}

function readNumber(record: Readonly<Record<string, unknown>>, key: string): number | undefined {
  const v = record[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function readString(record: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const v = record[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function readStringArray(
  record: Readonly<Record<string, unknown>>,
  key: string,
): readonly string[] | undefined {
  const v = record[key];
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === 'string') out.push(item);
  }
  return out.length > 0 ? out : undefined;
}
