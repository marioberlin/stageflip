// packages/pack-discovery/src/recommender.ts
// T-504 — Rule-based pack recommender. Given the host's current
// cluster usage + already-installed packs, scores every catalogue
// entry against transparent + testable rules and returns the top N.
//
// Scoring rules (sum across rules; cap at 1.0):
//   +0.4 per cluster in `clustersInUse` that the pack contributes to
//   +0.2 per keyword overlap with any clusterInUse name (case-insensitive)
//   -0.5 if already installed
//   +0.1 if licenseKind === 'open'  (favor accessibility absent other signal)
//    0   if licenseKind === 'paid-per-tenant'
//   -0.1 if licenseKind === 'enterprise'
//
// The reasoning string explains the top-scoring contributor.

import type { PackCatalogue, PackCatalogueEntry } from './catalogue.js';

/** Input to `recommendPacks`. */
export interface RecommenderInput {
  /** Cluster IDs currently in heavy use in the host (e.g. ['cluster-a','cluster-d']). */
  readonly clustersInUse: readonly string[];
  /** Already-installed `publisherId/packId` pairs to deprioritize. */
  readonly installed: ReadonlySet<string>;
  /** Max recommendations returned. Default 5. */
  readonly limit?: number;
}

/** A single recommendation row. */
export interface PackRecommendation {
  readonly entry: PackCatalogueEntry;
  /** Higher = better match. Range 0..1. */
  readonly score: number;
  readonly reason: string;
}

const DEFAULT_RECOMMENDATION_LIMIT = 5;
const CLUSTER_MATCH_WEIGHT = 0.4;
const KEYWORD_MATCH_WEIGHT = 0.2;
const INSTALLED_PENALTY = -0.5;
const LICENSE_WEIGHTS: Readonly<Record<PackCatalogueEntry['licenseKind'], number>> = {
  open: 0.1,
  'paid-per-tenant': 0,
  enterprise: -0.1,
};

/**
 * Score every entry in the catalogue against the supplied input,
 * sort descending, and return the top `limit` (default 5).
 *
 * The reasoning string names the single largest positive contributor
 * to the score (cluster match > keyword match > license bonus); if no
 * positive contribution applies, the reason names the baseline
 * license weighting.
 */
export async function recommendPacks(
  catalogue: PackCatalogue,
  input: RecommenderInput,
): Promise<readonly PackRecommendation[]> {
  const entries = await catalogue.list({ limit: 200 });
  const limit = input.limit ?? DEFAULT_RECOMMENDATION_LIMIT;
  const scored = entries.map((entry) => scoreEntry(entry, input));
  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    // Stable tiebreak: alphabetical by publisherId then packId.
    if (a.entry.publisherId !== b.entry.publisherId) {
      return a.entry.publisherId < b.entry.publisherId ? -1 : 1;
    }
    return a.entry.packId < b.entry.packId ? -1 : 1;
  });
  return scored.slice(0, Math.max(0, limit));
}

interface ScoreContribution {
  readonly delta: number;
  readonly label: string;
}

function scoreEntry(entry: PackCatalogueEntry, input: RecommenderInput): PackRecommendation {
  const contributions: ScoreContribution[] = [];
  const clustersInUse = input.clustersInUse;

  // Rule 1: cluster matches.
  let clusterMatches = 0;
  const matchedClusters: string[] = [];
  for (const cluster of clustersInUse) {
    if (entry.clusters.includes(cluster)) {
      clusterMatches += 1;
      matchedClusters.push(cluster);
    }
  }
  if (clusterMatches > 0) {
    contributions.push({
      delta: clusterMatches * CLUSTER_MATCH_WEIGHT,
      label: `matches cluster ${matchedClusters.join(', ')}`,
    });
  }

  // Rule 2: keyword overlap with cluster names (case-insensitive).
  const entryKeywordsLower = new Set(entry.keywords.map((k) => k.toLowerCase()));
  let keywordMatches = 0;
  const matchedKeywords: string[] = [];
  for (const cluster of clustersInUse) {
    if (entryKeywordsLower.has(cluster.toLowerCase())) {
      keywordMatches += 1;
      matchedKeywords.push(cluster);
    }
  }
  if (keywordMatches > 0) {
    contributions.push({
      delta: keywordMatches * KEYWORD_MATCH_WEIGHT,
      label: `keyword overlap on ${matchedKeywords.join(', ')}`,
    });
  }

  // Rule 3: installed penalty.
  const key = `${entry.publisherId}/${entry.packId}`;
  if (input.installed.has(key) || entry.installed) {
    contributions.push({
      delta: INSTALLED_PENALTY,
      label: 'already installed',
    });
  }

  // Rule 4: license weighting.
  const licenseDelta = LICENSE_WEIGHTS[entry.licenseKind];
  if (licenseDelta !== 0) {
    contributions.push({
      delta: licenseDelta,
      label: `${entry.licenseKind} license`,
    });
  }

  const raw = contributions.reduce((acc, c) => acc + c.delta, 0);
  const score = Math.min(1, Math.max(0, raw));

  // Reason = the single largest positive contribution; falls back to
  // the license weighting if every positive contribution is zero or
  // absent.
  const positives = contributions.filter((c) => c.delta > 0);
  let reason: string;
  if (positives.length > 0) {
    positives.sort((a, b) => b.delta - a.delta);
    // Non-empty array — `at(0)` returns the largest positive.
    const top = positives[0];
    reason = top !== undefined ? top.label : `${entry.licenseKind} license`;
  } else {
    reason = `${entry.licenseKind} license`;
  }

  return { entry, score, reason };
}
