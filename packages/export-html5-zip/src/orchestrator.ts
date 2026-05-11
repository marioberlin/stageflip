// packages/export-html5-zip/src/orchestrator.ts
// IAB / GDN HTML5 banner export orchestrator. Produces one deterministic
// ZIP per `BannerSize`:
//
//   index.html        — from HtmlBundler, with clickTag injected
//   assets/*          — non-inlined assets from HtmlBundler
//   fallback.png      — mandatory fallback static image (IAB requirement)
//   fallback.gif      — optional animated fallback
//
// Budget enforcement: when the produced ZIP exceeds
// `DisplayBudget.totalZipKb`, the orchestrator emits an `error`-severity
// `ExportFinding` and keeps the bytes so the UI can show the overage.
// Callers that want hard-fail semantics should check `MultiSizeExportResult.ok`.

import type { AssetRef, BannerFallback, DisplayBudget } from '@stageflip/schema';

import {
  type AiDisclosureBadgeConfig,
  DEFAULT_AI_BADGE,
  annotateAiElementsInHtml,
  injectAiBadge,
} from './ai-badge.js';
import type { AssetResolver } from './asset-resolver.js';
import { injectClickTagScript } from './click-tag.js';
import { mapWithConcurrency } from './concurrency.js';
import { type AiContentDisclosure, extractAiDisclosures } from './provenance-walk.js';
import type {
  BannerExportInput,
  BannerExportResult,
  BannerSize,
  ExportFinding,
  FallbackProvider,
  HtmlBundler,
  MultiSizeExportResult,
} from './types.js';
import { type ZipFile, packDeterministicZip, stringToZipBytes } from './zip.js';

/** Wiring the orchestrator needs. All three are pluggable. */
export interface ExportOrchestratorOptions {
  readonly bundler: HtmlBundler;
  readonly assetResolver: AssetResolver;
  /**
   * Optional fallback provider. When `input.fallback` is present it wins;
   * otherwise the provider is called per size. At least one of
   * `input.fallback` or `fallbackProvider` must produce a fallback — IAB
   * compliance requires a static backup image.
   */
  readonly fallbackProvider?: FallbackProvider;
  /** Concurrency cap for multi-size export. Default 3. */
  readonly concurrency?: number;
  /**
   * T-439 — per-tenant AI-disclosure badge config (FTC + EU AI Act). Partial
   * overrides are merged with `DEFAULT_AI_BADGE`. When `text === ''`, the
   * visible badge is suppressed BUT the `aiContent` manifest field still
   * surfaces AI elements (with `disclosure.{ftc,euAiAct} = 'requires-tenant-config'`).
   * Ignored when `BannerExportInput.aiElements` is absent or contains no
   * AI-kind elements.
   */
  readonly aiBadge?: Partial<AiDisclosureBadgeConfig>;
}

const DEFAULT_CONCURRENCY = 3;

function sizeId(size: BannerSize): string {
  return size.id ?? `${size.width}x${size.height}`;
}

async function resolveFallback(
  size: BannerSize,
  input: BannerExportInput,
  fallbackProvider: FallbackProvider | undefined,
): Promise<BannerFallback> {
  if (input.fallback !== undefined) return input.fallback;
  if (fallbackProvider === undefined) {
    throw new Error(
      `no fallback source for size '${sizeId(size)}' — pass BannerExportInput.fallback or ExportOrchestratorOptions.fallbackProvider`,
    );
  }
  return fallbackProvider.generate(size);
}

async function resolveAssetBytes(resolver: AssetResolver, ref: AssetRef): Promise<Uint8Array> {
  const bytes = await resolver.resolve(ref);
  if (bytes.length === 0) {
    throw new Error(`asset '${ref}' resolved to zero bytes — rejecting empty fallback`);
  }
  return bytes;
}

function budgetFinding(
  size: BannerSize,
  zipKb: number,
  budget: DisplayBudget,
): ExportFinding | null {
  if (zipKb <= budget.totalZipKb) return null;
  return {
    severity: 'error',
    code: 'budget-exceeded',
    message:
      `banner '${sizeId(size)}' ZIP is ${zipKb.toFixed(1)} KB, ` +
      `exceeds budget cap of ${budget.totalZipKb} KB`,
    sizeId: sizeId(size),
  };
}

/**
 * Build the ZIP for a single `BannerSize`. Exported for callers that
 * want per-size progress / streaming — the multi-size entry point
 * wraps this in `mapWithConcurrency`.
 */
export async function exportHtml5ZipForSize(
  size: BannerSize,
  input: BannerExportInput,
  opts: ExportOrchestratorOptions,
): Promise<BannerExportResult> {
  const findings: ExportFinding[] = [];

  const bundle = await opts.bundler.bundle(size);
  let html = injectClickTagScript(bundle.html, input.clickTag);

  // T-439 — provenance walk: extract AI-generated content disclosures.
  const badgeConfig: AiDisclosureBadgeConfig = { ...DEFAULT_AI_BADGE, ...(opts.aiBadge ?? {}) };
  const badgeEnabled = badgeConfig.text.length > 0;
  const aiContent: AiContentDisclosure | undefined =
    input.aiElements !== undefined && input.aiElements.length > 0
      ? (() => {
          const walked = extractAiDisclosures(input.aiElements ?? [], { badgeEnabled });
          return walked.elements.length > 0 ? walked : undefined;
        })()
      : undefined;
  if (aiContent !== undefined) {
    if (badgeEnabled) {
      html = injectAiBadge(html, badgeConfig);
    }
    const ids = aiContent.elements.map((e) => e.elementId);
    html = annotateAiElementsInHtml(html, ids);
  }

  const fallback = await resolveFallback(size, input, opts.fallbackProvider);
  const pngBytes = await resolveAssetBytes(opts.assetResolver, fallback.png);
  const gifBytes =
    fallback.gif !== undefined
      ? await resolveAssetBytes(opts.assetResolver, fallback.gif)
      : undefined;

  const files: ZipFile[] = [
    { path: 'index.html', bytes: stringToZipBytes(html) },
    { path: 'fallback.png', bytes: pngBytes },
  ];
  if (gifBytes !== undefined) {
    files.push({ path: 'fallback.gif', bytes: gifBytes });
  }
  for (const asset of bundle.assets) {
    files.push({ path: asset.path, bytes: asset.bytes });
  }

  const zipBytes = packDeterministicZip(files);
  const zipKb = zipBytes.length / 1024;
  const budgetIssue = budgetFinding(size, zipKb, input.budget);
  if (budgetIssue !== null) findings.push(budgetIssue);

  return {
    size,
    zipBytes,
    zipKb,
    findings,
    ...(aiContent !== undefined ? { aiContent } : {}),
  };
}

/**
 * Orchestrate a multi-size banner export. Each size goes through the
 * bundler + clickTag injection + fallback embed + deterministic ZIP
 * independently, with a configurable concurrency cap. Per-size errors
 * propagate up through `Promise.reject` — callers that want
 * collect-all semantics should wrap per-size calls in
 * `exportHtml5ZipForSize` instead.
 */
export async function exportHtml5Zip(
  input: BannerExportInput,
  opts: ExportOrchestratorOptions,
): Promise<MultiSizeExportResult> {
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
  const results = await mapWithConcurrency(
    input.sizes,
    concurrency,
    (size): Promise<BannerExportResult> => exportHtml5ZipForSize(size, input, opts),
  );
  const ok = results.every((r) => r.findings.every((f) => f.severity !== 'error'));
  return { results, ok };
}
