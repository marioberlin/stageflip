// packages/pack-discovery/src/editor/recommendation-ranker.ts
// T-546 — Editor-specific wrapper around T-504's `recommendPacks`. It
// derives `clustersInUse` from a `ClusterUsageTracker` and forwards
// `installed` + `limit` through. The base scoring rules (cluster /
// keyword / installed / license) live unchanged in `recommender.ts` —
// this module's job is to ADAPT the editor's signals into the input
// shape `recommendPacks` already accepts.
//
// We deliberately do NOT reimplement scoring here. If future editor
// work needs more nuanced weighting (e.g. recency boost on
// most-recently-used clusters), it lands by widening the input the
// base recommender accepts — not by forking scorer logic.

import type { PackCatalogue } from '../catalogue.js';
import { type PackRecommendation, recommendPacks } from '../recommender.js';
import type { ClusterUsageTracker } from './cluster-usage-tracker.js';

/** Input to `rankRecommendationsForEditor`. */
export interface EditorRecommendationInput {
  readonly usage: ClusterUsageTracker;
  readonly installed: ReadonlySet<string>;
  readonly limit?: number;
}

/**
 * Editor-side entry point: derive the cluster signal from a usage
 * tracker, then delegate to T-504's `recommendPacks`. The returned
 * `PackRecommendation` rows are the recommender's output, unmodified.
 *
 * Per T-546 spec point 4 in the Implementer instructions: this MUST
 * delegate to the base recommender without reimplementing the scorer.
 */
export async function rankRecommendationsForEditor(
  catalogue: PackCatalogue,
  input: EditorRecommendationInput,
): Promise<readonly PackRecommendation[]> {
  const clustersInUse = input.usage.clustersInUse();
  const baseInput =
    input.limit === undefined
      ? { clustersInUse, installed: input.installed }
      : { clustersInUse, installed: input.installed, limit: input.limit };
  return recommendPacks(catalogue, baseInput);
}
