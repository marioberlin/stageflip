// packages/renderer-cdp/src/asset-resolver.ts
// Asynchronous asset preflight (T-084a). Walks the RIRDocument for every
// URL-bearing content ref (via asset-refs.ts), passes each ref through a
// pluggable AssetResolver to fetch and cache it, then produces a rewritten
// document whose URLs point at local file:// paths. Refs that the resolver
// can't handle (YouTube embeds, arbitrary iframes, anything without a
// fetch path) come back as loss-flags — recorded, not fetched, and left
// unrewritten so the export can choose to rasterize or fail later.
//
// Actual HTTP fetch + content-hash disk cache + Puppeteer-screenshot
// rasterization for embeds lives below this interface — T-085+ and the
// Phase 5 parity harness. Tests inject InMemoryAssetResolver to exercise
// the orchestrator without touching disk or network.

import type { RIRDocument } from '@stageflip/rir';

import { type AssetRef, collectAssetRefs, rewriteDocumentAssets } from './asset-refs';

export type AssetResolution =
  /** Fetched and cached locally; `localUrl` is the replacement (typically file://). */
  | { readonly status: 'ok'; readonly localUrl: string }
  /**
   * Resolver cannot fetch this ref. The URL stays remote in the rewritten
   * document; a downstream stage (rasterize-via-screenshot, fail-loud) sees
   * it in the loss-flags list.
   */
  | { readonly status: 'loss-flag'; readonly reason: string };

export interface AssetResolver {
  /** Fetch + cache one ref. Must not mutate `ref`. */
  resolve(ref: AssetRef): Promise<AssetResolution>;
}

/**
 * Test / fixture resolver. Returns `ok` for URLs whose entries are in the
 * provided map, and `loss-flag` for everything else. Records every call
 * order for assertions.
 */
export class InMemoryAssetResolver implements AssetResolver {
  public readonly calls: AssetRef[] = [];

  constructor(private readonly fixtures: Readonly<Record<string, string>>) {}

  async resolve(ref: AssetRef): Promise<AssetResolution> {
    this.calls.push(ref);
    const hit = this.fixtures[ref.url];
    if (hit !== undefined) {
      return { status: 'ok', localUrl: hit };
    }
    return {
      status: 'loss-flag',
      reason: `InMemoryAssetResolver: ${ref.url} not in fixture map`,
    };
  }
}

/** One ref plus its successful resolution — built for convenient consumption. */
export interface ResolvedAssetEntry {
  readonly ref: AssetRef;
  readonly localUrl: string;
}

/** One ref plus the reason the resolver refused it. */
export interface LossFlag {
  readonly ref: AssetRef;
  readonly reason: string;
}

export interface ResolveAssetsResult {
  /** RIR document with URLs rewritten to `file://` paths where resolved. */
  readonly document: RIRDocument;
  /** Successful `(ref, localUrl)` entries. One per unique URL. */
  readonly resolutions: readonly ResolvedAssetEntry[];
  /** Refs the resolver refused. Their URLs are NOT rewritten. */
  readonly lossFlags: readonly LossFlag[];
  /** Convenience map `originalUrl → localUrl` built from `resolutions`. */
  readonly resolutionMap: Readonly<Record<string, string>>;
}

/**
 * Resolve every URL-bearing asset in `document` through `resolver`, dedup by
 * URL, then produce a rewritten document. Refs that come back as
 * `loss-flag` are surfaced separately so callers can decide whether to
 * rasterize them, fail loud, or proceed with a degraded render.
 */
export async function resolveAssets(
  document: RIRDocument,
  resolver: AssetResolver,
): Promise<ResolveAssetsResult> {
  const refs = collectAssetRefs(document);

  const resolutions: ResolvedAssetEntry[] = [];
  const lossFlags: LossFlag[] = [];
  const resolutionMap: Record<string, string> = {};

  for (const ref of refs) {
    const out = await resolver.resolve(ref);
    if (out.status === 'ok') {
      resolutions.push({ ref, localUrl: out.localUrl });
      resolutionMap[ref.url] = out.localUrl;
    } else {
      lossFlags.push({ ref, reason: out.reason });
    }
  }

  const rewritten =
    resolutions.length === 0 ? document : rewriteDocumentAssets(document, resolutionMap);

  return {
    document: rewritten,
    resolutions,
    lossFlags,
    resolutionMap,
  };
}
