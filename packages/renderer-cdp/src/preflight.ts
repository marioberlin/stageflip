// packages/renderer-cdp/src/preflight.ts
// Pre-capture analysis of an RIRDocument. Everything the dispatcher needs to
// know before the browser starts up: which clips are live vs bake, what
// fonts need to load, which assets need fetching, and any blocking
// diagnostics that should fail the export before spinning up Puppeteer.
//
// Preflight is pure (no IO). Real asset fetching lives in T-084a; bake
// orchestration lives in T-089 [rev]. This file produces the report; the
// consuming dispatcher decides what to do with it.

import { aggregateFontRequirements } from '@stageflip/fonts';
import type { RIRDocument } from '@stageflip/rir';
import type { FontRequirement } from '@stageflip/runtimes-contract';

import { type AssetRef, collectAssetRefs } from './asset-refs';
import { type DispatchedClip, dispatchClips } from './dispatch';

/** A blocker prevents the export from proceeding. */
export type PreflightBlockerKind =
  | 'unresolved-clips'
  | 'bake-not-implemented'
  | 'empty-fps'
  | 'empty-duration';

export interface PreflightBlocker {
  readonly kind: PreflightBlockerKind;
  readonly message: string;
}

/**
 * Full pre-capture report. A dispatcher that receives `blockers.length > 0`
 * MUST refuse to proceed — the export would otherwise produce degraded
 * output with no visible failure signal.
 */
export interface PreflightReport {
  /** Clips that will render via the live CDP adapter. */
  readonly liveTasks: readonly DispatchedClip[];
  /** Clips that require offline baking before live capture. */
  readonly bakeTasks: readonly DispatchedClip[];
  /** Canonical dedup'd font requirements for this export. */
  readonly fonts: readonly FontRequirement[];
  /** Asset refs that need fetching before capture (stub until T-084a). */
  readonly assetRefs: readonly AssetRef[];
  /** Blockers — non-empty means the export must not proceed. */
  readonly blockers: readonly PreflightBlocker[];
}

/**
 * Walk the document, resolve its clips, tier-split them, aggregate fonts,
 * and surface any reason the export should refuse to run. Synchronous and
 * pure — no browser, no IO.
 */
export function preflight(document: RIRDocument): PreflightReport {
  const blockers: PreflightBlocker[] = [];

  if (document.frameRate <= 0) {
    blockers.push({
      kind: 'empty-fps',
      message: `document.frameRate must be > 0 (got ${document.frameRate})`,
    });
  }
  if (document.durationFrames <= 0) {
    blockers.push({
      kind: 'empty-duration',
      message: `document.durationFrames must be > 0 (got ${document.durationFrames})`,
    });
  }

  const plan = dispatchClips(document);

  if (plan.unresolved.length > 0) {
    const summary = plan.unresolved
      .map((u) => `${u.reason}:${u.requestedRuntime}:${u.requestedKind}(${u.element.id})`)
      .join('; ');
    blockers.push({
      kind: 'unresolved-clips',
      message: `${plan.unresolved.length} clip(s) unresolved — ${summary}`,
    });
  }

  const liveTasks: DispatchedClip[] = [];
  const bakeTasks: DispatchedClip[] = [];
  for (const task of plan.resolved) {
    if (task.runtime.tier === 'bake') {
      bakeTasks.push(task);
    } else {
      liveTasks.push(task);
    }
  }

  if (bakeTasks.length > 0) {
    blockers.push({
      kind: 'bake-not-implemented',
      message: `${bakeTasks.length} bake-tier clip(s) — bake orchestration is T-089 interface-only today`,
    });
  }

  // RIR's FontRequirement (inferred from @stageflip/schema) and the contract's
  // FontRequirement (@stageflip/runtimes-contract) have matching intent but
  // subtly different optionality: schema always sets `style` (default
  // 'normal'); the contract leaves it optional. Map to the contract shape so
  // aggregateFontRequirements accepts it under exactOptionalPropertyTypes.
  const fonts = aggregateFontRequirements(
    document.fontRequirements.map((r): FontRequirement => {
      const out: {
        family: string;
        weight?: number | string;
        style?: 'normal' | 'italic' | 'oblique';
        subsets?: readonly string[];
        features?: readonly string[];
      } = { family: r.family, style: r.style };
      if (r.weight !== undefined) out.weight = r.weight;
      if (r.subsets !== undefined) out.subsets = r.subsets;
      if (r.features !== undefined) out.features = r.features;
      return out;
    }),
  );

  // Collect URL-bearing refs from the RIR. Resolution (fetch / cache /
  // rewrite) is a separate async phase driven by an AssetResolver; see
  // asset-resolver.ts and exportDocument's `assetResolver` option.
  const assetRefs = collectAssetRefs(document);

  return {
    liveTasks,
    bakeTasks,
    fonts,
    assetRefs,
    blockers,
  };
}

export type { AssetRef };
