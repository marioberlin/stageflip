// packages/design-system/src/pipeline/step6-fonts.ts
// Step 6 — Font asset fetching. For each font-family in step 2's
// typography clusters, fetches font bytes via `FontFetcher` and uploads
// via `AssetStorage`. Skipped entirely when `fontFetcher` is undefined.

import { createHash } from 'node:crypto';
import type { LossFlag } from '@stageflip/loss-flags';
import type { AssetRef } from '@stageflip/schema';
import { emitLossFlag } from '../loss-flags.js';
import type { PipelineState, StepDiagnostic } from '../types.js';

export interface Step6Result {
  fontAssets: Record<string, AssetRef>;
  lossFlags: LossFlag[];
  diagnostic: Extract<StepDiagnostic, { step: 6 }>;
}

export async function runStep6(state: PipelineState): Promise<Step6Result> {
  const fontAssets: Record<string, AssetRef> = {};
  const lossFlags: LossFlag[] = [];
  let fetched = 0;
  let failed = 0;

  const fetcher = state.opts.fontFetcher;
  const storage = state.opts.storage;
  if (!fetcher || !storage) {
    return {
      fontAssets,
      lossFlags,
      diagnostic: { step: 6, kind: 'fonts', fetched, failed },
    };
  }

  // Group typography clusters by family → variant set.
  const variants = new Map<string, { weights: Set<number>; italics: Set<boolean> }>();
  for (const cluster of state.typographyClusters) {
    const family = cluster.token.fontFamily;
    let v = variants.get(family);
    if (!v) {
      v = { weights: new Set(), italics: new Set() };
      variants.set(family, v);
    }
    v.weights.add(cluster.token.fontWeight);
    v.italics.add(cluster.token.italic);
  }

  // Process families in stable sorted order (determinism).
  const families = Array.from(variants.keys()).sort();
  for (const family of families) {
    const v = variants.get(family);
    if (!v) continue;
    try {
      const results = await fetcher.fetch({
        family,
        weights: Array.from(v.weights).sort((a, b) => a - b),
        italics: Array.from(v.italics).sort(),
      });
      if (results.length === 0) {
        lossFlags.push(
          emitLossFlag({
            code: 'LF-DESIGN-SYSTEM-FONT-FETCH-FAILED',
            message: `No font bytes returned for family "${family}"`,
            location: {},
          }),
        );
        failed += 1;
        continue;
      }
      // We only persist the first variant — subsetting + multi-variant is
      // deferred per spec OOS. The asset id is the storage adapter's call.
      const first = results[0];
      if (!first) continue;
      const contentHash = createHash('sha256').update(first.bytes).digest('hex').slice(0, 24);
      const { id } = await storage.put(first.bytes, {
        contentType: first.contentType,
        contentHash,
      });
      fontAssets[family] = `asset:${id}` as AssetRef;
      fetched += 1;
    } catch (err) {
      lossFlags.push(
        emitLossFlag({
          code: 'LF-DESIGN-SYSTEM-FONT-FETCH-FAILED',
          message: `Failed to fetch font "${family}": ${err instanceof Error ? err.message : String(err)}`,
          location: {},
        }),
      );
      failed += 1;
    }
  }

  return {
    fontAssets,
    lossFlags,
    diagnostic: { step: 6, kind: 'fonts', fetched, failed },
  };
}
