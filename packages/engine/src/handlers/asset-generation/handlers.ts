// packages/engine/src/handlers/asset-generation/handlers.ts
// `asset-generation` bundle — 3 agent-callable tools that wrap the Phase 14 α
// Provider Seam infrastructure (T-418 adapters-core + T-419 asset-gen-contract +
// T-420 asset-cache + T-421 MediaProvenance schema). Canonical bundle #25.
//
// Tools:
//   - generate_asset           — dispatch (modality, prompt, ...) through
//                                AdapterRegistry → LicenseGate →
//                                FallbackChainExecutor; on success, derive a
//                                content-addressed cacheKey, build
//                                MediaProvenance, and emit a JSON-Patch op
//                                that mounts an audio/image/video element
//                                with provenance populated.
//   - list_adapters            — enumerate registered AdapterDescriptors.
//   - get_adapter_capabilities — look up a single descriptor by id.
//
// Per D-T423-2: handlers declare `MutationContext` (the canonical write-tier
// context). The wiring seams (`adapterRegistry`, `licenseGate`,
// `tenantContext`, `executeAdapterCall`, `assetCacheStore`) live on a soft
// sub-interface `AssetGenerationContext` mirroring T-386's
// `VariantPersistenceContext` pattern. When a seam is absent (the current
// state on `main` — no concrete adapters registered yet), every handler
// returns a typed `{ ok: false, reason: 'asset_generation_unavailable' }`
// response. Hosts wire the seams at orchestrator-construction time;
// downstream consumer tasks (T-425 + T-426..T-434) own the wiring.
//
// The bundle dispatches the shell only; T-423 does NOT register concrete
// adapters. Reference adapters land via T-426..T-434.

import {
  ADAPTER_MODALITY_KINDS,
  type AdapterDescriptor,
  type AdapterModalityKind,
  type AdapterRegistry,
  FallbackChainExecutor,
  type LicenseGate,
  type TenantContext,
} from '@stageflip/adapters-core';
import {
  type AssetCacheKey,
  type AssetCacheStore,
  cacheKeyString,
  deriveCacheKey,
} from '@stageflip/asset-cache';
import type { LLMToolDefinition } from '@stageflip/llm-abstraction';
import {
  type MediaProvenance,
  type MediaProvenanceKind,
  mediaProvenanceSchema,
} from '@stageflip/schema';
import { z } from 'zod';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import { nextElementId } from '../create-mutate/ids.js';

export const ASSET_GENERATION_BUNDLE_NAME = 'asset-generation';

// ---------------------------------------------------------------------------
// Modality discipline
// ---------------------------------------------------------------------------

/**
 * Modalities that produce an asset element on the document. Excludes the
 * three "session / marketplace" modalities (`research-session`,
 * `audience-backend`, `bundle`) that don't materialize a media element.
 * The schema rejects those at the input boundary so the unreachable
 * provenance-kind rows below never fire.
 */
export const ASSET_PRODUCING_MODALITIES = [
  'tts',
  'video-gen',
  'music-gen',
  'sfx',
  'three-d',
  'slide-deck-gen',
  'mind-map-gen',
  'table-gen',
  'quiz-gen',
  'flashcard-gen',
  'report-gen',
  'infographic-gen',
] as const satisfies readonly AdapterModalityKind[];

export type AssetProducingModality = (typeof ASSET_PRODUCING_MODALITIES)[number];

/**
 * Map an asset-producing modality to the matching `MediaProvenance.kind`
 * per ADR-008 §D2. Source-grounded modalities funnel into `'image-gen'`
 * in v1 (their visual output IS an image). T-431..T-434 may refine.
 */
const MEDIA_PROVENANCE_KIND_FOR_MODALITY: Readonly<
  Record<AssetProducingModality, MediaProvenanceKind>
> = {
  tts: 'tts',
  'video-gen': 'video-gen',
  'music-gen': 'music-gen',
  sfx: 'sfx',
  'three-d': 'three-d',
  'infographic-gen': 'image-gen',
  'slide-deck-gen': 'image-gen',
  'mind-map-gen': 'image-gen',
  'table-gen': 'image-gen',
  'quiz-gen': 'image-gen',
  'flashcard-gen': 'image-gen',
  'report-gen': 'image-gen',
};

/** Element types `generate_asset` may mount. Constrained to the three media-bearing kinds. */
export const ASSET_ELEMENT_TYPES = ['audio', 'image', 'video'] as const;
export type AssetElementType = (typeof ASSET_ELEMENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Soft-seam context — `AssetGenerationContext`
// ---------------------------------------------------------------------------

/**
 * Inputs the host-supplied `executeAdapterCall` seam receives. Opaque on
 * purpose: per-modality call shapes live in `@stageflip/asset-gen-contract`
 * (T-419); this bundle does not bind to those shapes. The seam owns the
 * adapter dispatch — including upload of any produced bytes to the asset
 * store and assignment of an `AssetRef` (the caller-supplied
 * `target.src`).
 */
export interface ExecuteAdapterCallInput {
  readonly adapter: AdapterDescriptor;
  readonly modality: AssetProducingModality;
  readonly prompt: string;
  readonly model?: string;
  readonly voice?: string;
  readonly params?: Record<string, unknown>;
  readonly seed?: number | string;
  readonly researchSessionId?: string;
  readonly cacheKey: string;
  readonly cacheKeyParts: AssetCacheKey;
  readonly tenantContext: TenantContext;
}

/**
 * Result the host-supplied `executeAdapterCall` seam returns. The seam
 * must throw on failure (the FallbackChainExecutor catches + emits
 * telemetry + advances). Success carries no payload — the bundle uses
 * the caller-supplied `target.src` as the asset reference (T-423 does
 * not own asset upload; the seam owns it).
 */
export interface ExecuteAdapterCallResult {
  readonly ok: true;
}

// ---------------------------------------------------------------------------
// T-438 — optimistic-placeholder seam
// ---------------------------------------------------------------------------

/**
 * Inputs the host-supplied `placeholderResolver.dispatch` callback receives
 * when `generate_asset` is invoked with `optimistic: true`. Mirrors
 * `ExecuteAdapterCallInput` but carries the full `licensed` candidate
 * adapter list (the seam owns adapter selection / fallback-chain
 * execution in the optimistic path; the synchronous path uses
 * `FallbackChainExecutor` directly).
 *
 * The seam owns the eventual swap: once an adapter resolves, the seam
 * MUST deliver a follow-up patch that replaces the placeholder element
 * (correlated via `placeholderId`) with the terminal-state MediaElement.
 * The transport (next-cycle tool call vs streaming event) is the seam's
 * choice — T-438 ships only the contract. T-442 lands the transport
 * plumbing.
 */
export interface PlaceholderDispatchInput {
  readonly placeholderId: string;
  readonly licensed: readonly AdapterDescriptor[];
  readonly modality: AssetProducingModality;
  readonly prompt: string;
  readonly model?: string;
  readonly voice?: string;
  readonly params?: Record<string, unknown>;
  readonly seed?: number | string;
  readonly researchSessionId?: string;
  readonly cacheKey: string;
  readonly cacheKeyParts: AssetCacheKey;
  readonly tenantContext: TenantContext;
  readonly target: {
    readonly slideId: string;
    readonly elementType: AssetElementType;
    readonly src: string;
  };
}

/**
 * Soft-seam the host wires to enable `optimistic: true` on
 * `generate_asset`. Absent when the host hasn't opted in; in that case
 * `generate_asset` with `optimistic: true` returns
 * `{ ok: false, reason: 'asset_generation_unavailable' }`.
 *
 * `dispatch` is fire-and-forget from the handler's POV — the handler
 * does NOT await it. Implementations typically resolve immediately
 * after kicking the adapter off in their own queue (returning a Promise
 * the handler discards).
 */
export interface PlaceholderResolver {
  dispatch(input: PlaceholderDispatchInput): Promise<void>;
}

/**
 * Soft-seam context the executor wires for asset-generation tools. When
 * any required seam is absent, handlers return
 * `{ ok: false, reason: 'asset_generation_unavailable' }`.
 *
 * Required seams for `generate_asset`: `adapterRegistry` + `licenseGate`
 * + `tenantContext` + `executeAdapterCall`.
 *
 * Required seams for `list_adapters` + `get_adapter_capabilities`:
 * `adapterRegistry`.
 *
 * Optional: `assetCacheStore` — written to on `generate_asset` success
 * if present.
 */
export interface AssetGenerationContext extends MutationContext {
  readonly adapterRegistry?: AdapterRegistry;
  readonly licenseGate?: LicenseGate;
  readonly tenantContext?: TenantContext;
  readonly executeAdapterCall?: (
    input: ExecuteAdapterCallInput,
  ) => Promise<ExecuteAdapterCallResult>;
  readonly assetCacheStore?: AssetCacheStore<{ assetUri: string }>;
  /**
   * T-438 — optimistic-placeholder seam. When wired, callers MAY pass
   * `optimistic: true` to `generate_asset` and the handler returns
   * immediately with a placeholder result while the seam dispatches
   * the real adapter call in the background.
   */
  readonly placeholderResolver?: PlaceholderResolver;
  /**
   * T-438 — UUID source. Optional; defaults to `crypto.randomUUID()`.
   * Tests inject a deterministic generator. Editor / Node hosts may
   * omit. (Web Crypto's `randomUUID` is available in both browser
   * editors and Node ≥18, so the default is safe.)
   */
  readonly randomUuid?: () => string;
  /**
   * T-438 — clock source for `estimatedCompletionAt` derivation.
   * Optional; defaults to `Date.now()`. Tests inject a deterministic
   * clock. Living OUTSIDE `packages/frame-runtime` / clip / renderer
   * code, so the determinism rules do not apply.
   */
  readonly nowMs?: () => number;
}

// ---------------------------------------------------------------------------
// Shared schema atoms
// ---------------------------------------------------------------------------

const transformInputSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
    rotation: z.number().finite().optional(),
    opacity: z.number().min(0).max(1).optional(),
  })
  .strict();

const assetRefInputSchema = z.string().regex(/^asset:[A-Za-z0-9_-]+$/, 'src must be "asset:<id>"');

const targetInputSchema = z
  .object({
    slideId: z.string().min(1),
    elementType: z.enum(ASSET_ELEMENT_TYPES),
    transform: transformInputSchema,
    src: assetRefInputSchema,
  })
  .strict();

// ---------------------------------------------------------------------------
// 1 — generate_asset
// ---------------------------------------------------------------------------

const generateAssetInput = z
  .object({
    modality: z.enum(ASSET_PRODUCING_MODALITIES),
    prompt: z.string().min(1).max(16000),
    model: z.string().min(1).max(200).optional(),
    voice: z.string().min(1).max(200).optional(),
    params: z.record(z.unknown()).optional(),
    seed: z.union([z.number(), z.string().min(1)]).optional(),
    researchSessionId: z.string().min(1).optional(),
    target: targetInputSchema,
    /**
     * T-438 — when `true`, the handler returns a placeholder result
     * immediately and dispatches the real adapter via
     * `placeholderResolver` in the background. Default `false`
     * (back-compat — synchronous path identical to T-423).
     */
    optimistic: z.boolean().optional(),
  })
  .strict();

type GenerateAssetInput = z.infer<typeof generateAssetInput>;

const adapterErrorSchema = z
  .object({
    adapterId: z.string(),
    modality: z.string(),
    errorMessage: z.string(),
  })
  .strict();

const generateAssetSuccessSyncSchema = z
  .object({
    ok: z.literal(true),
    slideId: z.string(),
    elementId: z.string(),
    cacheKey: z.string(),
    provenance: mediaProvenanceSchema,
  })
  .strict();

const generateAssetSuccessPlaceholderSchema = z
  .object({
    ok: z.literal(true),
    kind: z.literal('placeholder'),
    slideId: z.string(),
    elementId: z.string(),
    placeholderId: z.string(),
    modality: z.enum(ASSET_PRODUCING_MODALITIES),
    cacheKey: z.string(),
    estimatedCompletionAt: z.string().datetime().optional(),
  })
  .strict();

const generateAssetOutput = z.union([
  generateAssetSuccessSyncSchema,
  generateAssetSuccessPlaceholderSchema,
  z
    .object({
      ok: z.literal(false),
      reason: z.enum([
        'asset_generation_unavailable',
        'wrong_mode',
        'slide_not_found',
        'no_adapter_for_modality',
        'no_licensed_adapter',
        'all_adapters_failed',
      ]),
      detail: z.string().optional(),
      errors: z.array(adapterErrorSchema).optional(),
    })
    .strict(),
]);

type GenerateAssetOutput = z.infer<typeof generateAssetOutput>;

const FALLBACK_EXECUTOR = new FallbackChainExecutor();

function getAssetSeam(ctx: MutationContext): AssetGenerationContext {
  return ctx as AssetGenerationContext;
}

/** Find slide index in slide-mode docs; null otherwise. */
function findSlideIndex(ctx: MutationContext, slideId: string): number | null {
  if (ctx.document.content.mode !== 'slide') return null;
  const idx = ctx.document.content.slides.findIndex((s) => s.id === slideId);
  return idx === -1 ? null : idx;
}

/**
 * Build the audio / image / video element payload with `provenance`
 * populated. Defaults match the matching schema (`elementBaseSchema` +
 * per-type schema).
 */
function buildMediaElement(
  elementId: string,
  elementType: AssetElementType,
  transform: GenerateAssetInput['target']['transform'],
  src: string,
  provenance: MediaProvenance,
): Record<string, unknown> {
  const transformWithDefaults = {
    x: transform.x,
    y: transform.y,
    width: transform.width,
    height: transform.height,
    rotation: transform.rotation ?? 0,
    opacity: transform.opacity ?? 1,
  };
  const base = {
    id: elementId,
    type: elementType,
    transform: transformWithDefaults,
    visible: true,
    locked: false,
    animations: [] as unknown[],
    src,
    provenance,
  };
  if (elementType === 'video') {
    return { ...base, muted: false, loop: false, playbackRate: 1 };
  }
  if (elementType === 'audio') {
    return { ...base, loop: false };
  }
  // image: no extra defaults
  return { ...base, fit: 'cover' };
}

/**
 * `generate_asset` — dispatch a (modality, prompt, ...) request through the
 * Provider Seam, derive a content-addressed cache key, build
 * `MediaProvenance`, and emit a JSON-Patch op that mounts the produced
 * media element on the target slide.
 *
 * **T-438 — optimistic mode.** When `input.optimistic === true`, the
 * handler returns immediately after deriving the cacheKey + selecting
 * licensed candidates: it emits a placeholder MediaElement (provenance
 * `kind: 'asset-gen-pending'` + `placeholderId` + `cacheKey` +
 * `estimatedCompletionAt`) and fires the real adapter dispatch
 * fire-and-forget via the `placeholderResolver.dispatch` seam. The
 * seam owns the eventual swap from placeholder → resolved asset
 * (transport: next-cycle tool call or T-442 streaming event).
 *
 * Soft-seam context: requires `adapterRegistry` + `licenseGate` +
 * `tenantContext`. Synchronous mode (`optimistic` absent or `false`)
 * additionally requires `executeAdapterCall`. Optimistic mode
 * additionally requires `placeholderResolver`.
 * When any required seam is absent, returns
 * `{ ok: false, reason: 'asset_generation_unavailable' }`.
 *
 * Error responses (typed, not exceptions):
 *   - `asset_generation_unavailable` — seams missing.
 *   - `wrong_mode`                   — document is not slide-mode.
 *   - `slide_not_found`              — `target.slideId` not present.
 *   - `no_adapter_for_modality`      — registry has no adapters for the modality.
 *   - `no_licensed_adapter`          — license gate denies every candidate.
 *   - `all_adapters_failed`          — fallback chain exhausted; per-adapter errors carried.
 *
 * The cache key derivation is verbatim ADR-008 §D1 (delegated to
 * `@stageflip/asset-cache`'s `deriveCacheKey` + `cacheKeyString`). The
 * provenance shape passes `mediaProvenanceSchema.parse` strictly. The
 * patch op writes against `/content/slides/<idx>/elements/-` (append).
 *
 * v1 does NOT consult the cache store on entry (cache-hit short-circuit
 * is T-435/T-436/T-437); the optional `assetCacheStore` seam is written
 * to on success only.
 */
const generateAsset: ToolHandler<GenerateAssetInput, GenerateAssetOutput, MutationContext> = {
  name: 'generate_asset',
  bundle: ASSET_GENERATION_BUNDLE_NAME,
  description:
    "Generate a new media asset (audio / image / video) by dispatching through the Provider Seam (ADR-007 + ADR-008). Sealed `modality` enum (12 asset-producing modalities: tts / video-gen / music-gen / sfx / three-d / infographic-gen / slide-deck-gen / mind-map-gen / table-gen / quiz-gen / flashcard-gen / report-gen). Required `prompt` (1..16000 chars; normalized via NFC + trim + collapse + lowercase before hashing). Optional `model` / `voice` (TTS-only) / `params` / `seed` / `researchSessionId` (source-grounded). Optional `optimistic: boolean` (T-438) — when true, the tool returns a placeholder result `{ ok: true, kind: 'placeholder', slideId, elementId, placeholderId, modality, cacheKey, estimatedCompletionAt? }` IMMEDIATELY and dispatches the real adapter in the background via the `placeholderResolver` seam; the editor renders the placeholder element (provenance.kind = 'asset-gen-pending') as a greyed-out box with spinner until a follow-up swap patch replaces it with the resolved asset. Required `target: { slideId, elementType: audio|image|video, transform, src: 'asset:<id>' }`. The bundle derives a content-addressed cache key per ADR-008 §D1, populates a strict `MediaProvenance` shape, and emits a JSON-Patch `add` op that mounts the element on the named slide with `provenance` populated. Returns `{ ok: true, slideId, elementId, cacheKey, provenance }` on synchronous success; placeholder shape on optimistic success; typed `{ ok: false, reason }` on every failure path. Read soft-seam: when the executor has not wired the asset-generation context (`adapterRegistry` + `licenseGate` + `tenantContext` + `executeAdapterCall` for sync; `placeholderResolver` instead for optimistic), returns `{ ok: false, reason: 'asset_generation_unavailable' }` rather than throwing. v1 does not cache-hit short-circuit (T-435/T-436/T-437 land that); the optional cache store is written on success only.",
  inputSchema: generateAssetInput,
  outputSchema: generateAssetOutput,
  handle: async (input, ctx) => {
    const seam = getAssetSeam(ctx);

    // 1 — seam check (synchronous path requires executeAdapterCall;
    // optimistic path requires placeholderResolver instead).
    if (
      seam.adapterRegistry === undefined ||
      seam.licenseGate === undefined ||
      seam.tenantContext === undefined ||
      (input.optimistic === true
        ? seam.placeholderResolver === undefined
        : seam.executeAdapterCall === undefined)
    ) {
      return {
        ok: false,
        reason: 'asset_generation_unavailable',
        detail:
          input.optimistic === true
            ? 'generate_asset with optimistic: true requires the placeholderResolver seam (plus adapterRegistry + licenseGate + tenantContext). The executor has not wired it — pre-T-442.'
            : 'generate_asset requires AssetGenerationContext seams (adapterRegistry + licenseGate + tenantContext + executeAdapterCall). The executor has not wired them — pre-T-425/T-426..T-434.',
      };
    }

    // 2 — document mode + slide existence checks
    if (ctx.document.content.mode !== 'slide') {
      return { ok: false, reason: 'wrong_mode' };
    }
    const slideIndex = findSlideIndex(ctx, input.target.slideId);
    if (slideIndex === null) {
      return { ok: false, reason: 'slide_not_found' };
    }

    // 3 — derive cache key
    const cacheKeyParts = await deriveCacheKey({
      modality: input.modality,
      model: input.model ?? '',
      ...(input.voice !== undefined ? { voice: input.voice } : {}),
      prompt: input.prompt,
      params: input.params ?? {},
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
    });
    const cacheKey = cacheKeyString(cacheKeyParts);

    // 4 — adapter selection
    const candidates = seam.adapterRegistry.list(input.modality);
    if (candidates.length === 0) {
      return { ok: false, reason: 'no_adapter_for_modality' };
    }
    const licensed: AdapterDescriptor[] = [];
    for (const adapter of candidates) {
      const decision = seam.licenseGate.evaluate(adapter, seam.tenantContext);
      if (decision === 'allow') licensed.push(adapter);
    }
    if (licensed.length === 0) {
      return { ok: false, reason: 'no_licensed_adapter' };
    }

    // 4b — optimistic branch (T-438) — return placeholder immediately,
    // dispatch the real adapter via the placeholderResolver seam in
    // the background. The seam owns adapter execution + the eventual
    // swap; the synchronous-path steps 5-8 do NOT run.
    if (input.optimistic === true) {
      // Non-null asserted from step-1 seam check (we returned early
      // when placeholderResolver was undefined for optimistic mode).
      // biome-ignore lint/style/noNonNullAssertion: validated above
      const placeholderResolverLocal = seam.placeholderResolver!;
      // biome-ignore lint/style/noNonNullAssertion: validated above
      const tenantContextLocal = seam.tenantContext!;

      const uuid = (seam.randomUuid ?? defaultRandomUuid)();
      const placeholderId = `ph-${uuid}`;
      const estimatedCompletionAt = deriveEstimatedCompletionAt(
        licensed,
        input.modality,
        seam.nowMs ?? defaultNowMs,
      );

      // Build placeholder provenance + element. Carries kind:
      // 'asset-gen-pending' + placeholderId + cacheKey + the same
      // adapter-hint fields the synchronous provenance would carry,
      // so the editor can render a labeled spinner ("Generating with
      // <provider>...") even before the swap.
      const placeholderProvenance: Record<string, unknown> = {
        kind: 'asset-gen-pending' as const,
        placeholderId,
        cacheKey,
        provider: licensed[0]?.id,
        prompt: normalizePromptForProvenance(input.prompt),
      };
      if (input.model !== undefined) placeholderProvenance.model = input.model;
      if (input.seed !== undefined) placeholderProvenance.seed = input.seed;
      if (input.voice !== undefined) placeholderProvenance.voiceId = input.voice;
      if (input.researchSessionId !== undefined) {
        placeholderProvenance.researchSessionId = input.researchSessionId;
      }
      if (estimatedCompletionAt !== undefined) {
        placeholderProvenance.estimatedCompletionAt = estimatedCompletionAt;
      }
      const provenance = mediaProvenanceSchema.parse(placeholderProvenance);

      const elementId = nextElementId(ctx.document);
      const element = buildMediaElement(
        elementId,
        input.target.elementType,
        input.target.transform,
        input.target.src,
        provenance,
      );
      ctx.patchSink.push({
        op: 'add',
        path: `/content/slides/${slideIndex}/elements/-`,
        value: element,
      });

      // Fire-and-forget the dispatch; the seam owns the eventual swap.
      // Errors from the seam are logged via the seam's own telemetry
      // surface; we deliberately do not surface them on the handler's
      // sync return value — the placeholder result IS the return.
      void placeholderResolverLocal
        .dispatch({
          placeholderId,
          licensed,
          modality: input.modality,
          prompt: input.prompt,
          ...(input.model !== undefined ? { model: input.model } : {}),
          ...(input.voice !== undefined ? { voice: input.voice } : {}),
          ...(input.params !== undefined ? { params: input.params } : {}),
          ...(input.seed !== undefined ? { seed: input.seed } : {}),
          ...(input.researchSessionId !== undefined
            ? { researchSessionId: input.researchSessionId }
            : {}),
          cacheKey,
          cacheKeyParts,
          tenantContext: tenantContextLocal,
          target: {
            slideId: input.target.slideId,
            elementType: input.target.elementType,
            src: input.target.src,
          },
        })
        .catch((_err) => {
          // Seam dispatch errors are the seam's responsibility (it
          // owns the swap transport + telemetry). Swallow here so the
          // background continuation never raises an unhandled
          // rejection on the host process.
        });

      const result: GenerateAssetOutput = {
        ok: true,
        kind: 'placeholder',
        slideId: input.target.slideId,
        elementId,
        placeholderId,
        modality: input.modality,
        cacheKey,
        ...(estimatedCompletionAt !== undefined ? { estimatedCompletionAt } : {}),
      };
      return result;
    }

    // 5 — fallback-chain execution
    // biome-ignore lint/style/noNonNullAssertion: validated in step-1 seam check
    const tenantContextLocal = seam.tenantContext!;
    // biome-ignore lint/style/noNonNullAssertion: validated in step-1 seam check
    const executeAdapterCallLocal = seam.executeAdapterCall!;
    const callInputBase = {
      modality: input.modality,
      prompt: input.prompt,
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.voice !== undefined ? { voice: input.voice } : {}),
      ...(input.params !== undefined ? { params: input.params } : {}),
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
      ...(input.researchSessionId !== undefined
        ? { researchSessionId: input.researchSessionId }
        : {}),
      cacheKey,
      cacheKeyParts,
      tenantContext: tenantContextLocal,
    } as const;
    const execResult = await FALLBACK_EXECUTOR.execute(licensed, async (adapter) =>
      executeAdapterCallLocal({ adapter, ...callInputBase }),
    );
    if (!execResult.ok) {
      return {
        ok: false,
        reason: 'all_adapters_failed',
        errors: execResult.errors.map((e) => ({
          adapterId: e.adapterId,
          modality: e.modality,
          errorMessage: e.errorMessage,
        })),
      };
    }

    // 6 — build provenance
    const provenanceKind = MEDIA_PROVENANCE_KIND_FOR_MODALITY[input.modality];
    const provenanceCandidate: Record<string, unknown> = {
      kind: provenanceKind,
      provider: execResult.adapter.id,
      cacheKey,
      // Prompt stored normalized — matches what the cache key was derived from.
      prompt: normalizePromptForProvenance(input.prompt),
    };
    if (input.model !== undefined) provenanceCandidate.model = input.model;
    if (input.seed !== undefined) provenanceCandidate.seed = input.seed;
    if (input.voice !== undefined) provenanceCandidate.voiceId = input.voice;
    if (input.researchSessionId !== undefined) {
      provenanceCandidate.researchSessionId = input.researchSessionId;
    }
    // Validate via the canonical schema before threading into the patch.
    const provenance = mediaProvenanceSchema.parse(provenanceCandidate);

    // 7 — emit patch
    const elementId = nextElementId(ctx.document);
    const element = buildMediaElement(
      elementId,
      input.target.elementType,
      input.target.transform,
      input.target.src,
      provenance,
    );
    ctx.patchSink.push({
      op: 'add',
      path: `/content/slides/${slideIndex}/elements/-`,
      value: element,
    });

    // 8 — optional cache-store write (success-only, no read short-circuit)
    if (seam.assetCacheStore !== undefined) {
      await seam.assetCacheStore.set(cacheKey, { assetUri: input.target.src });
    }

    return {
      ok: true,
      slideId: input.target.slideId,
      elementId,
      cacheKey,
      provenance,
    };
  },
};

/** NFC-trim-collapse-lowercase normalize — mirrors `@stageflip/asset-cache`'s `normalizePrompt`. */
function normalizePromptForProvenance(prompt: string): string {
  return prompt.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * T-438 — per-modality fallback latency hint (milliseconds) when the
 * chosen adapter exposes no `latencyMs.p95` capability metadata. These
 * are upper-bound editor hints (the spinner countdown), not contracts.
 */
const DEFAULT_LATENCY_FALLBACK_MS: Readonly<Record<AssetProducingModality, number>> = {
  tts: 5_000, // 1-5s typical
  'music-gen': 30_000, // ~30s
  sfx: 8_000,
  'video-gen': 120_000, // 1-2min
  'three-d': 60_000, // ~1min
  'infographic-gen': 30_000,
  'slide-deck-gen': 300_000, // up to 5min
  'mind-map-gen': 60_000,
  'table-gen': 30_000,
  'quiz-gen': 45_000,
  'flashcard-gen': 30_000,
  'report-gen': 300_000,
};

/**
 * Derive an upper-bound ISO-8601 timestamp for the placeholder
 * countdown. Picks the largest `latencyMs.p95` across the candidate
 * adapters (the fallback chain may try several); falls back to the
 * per-modality hint above. Returns `undefined` when the clock seam is
 * unwired AND no candidate exposes a latency hint — in that case the
 * editor renders an indefinite spinner.
 */
function deriveEstimatedCompletionAt(
  licensed: readonly AdapterDescriptor[],
  modality: AssetProducingModality,
  nowMs: () => number,
): string | undefined {
  let maxLatencyMs: number | undefined;
  for (const adapter of licensed) {
    const p95 = adapter.latencyMs?.p95;
    if (typeof p95 === 'number' && Number.isFinite(p95) && p95 > 0) {
      maxLatencyMs = maxLatencyMs === undefined ? p95 : Math.max(maxLatencyMs, p95);
    }
  }
  const latencyMs = maxLatencyMs ?? DEFAULT_LATENCY_FALLBACK_MS[modality];
  if (latencyMs === undefined) return undefined;
  return new Date(nowMs() + latencyMs).toISOString();
}

/**
 * Default UUID source. Uses Web Crypto's `randomUUID` which is
 * available in both browser editor contexts and Node ≥18 (where
 * `globalThis.crypto.randomUUID` resolves to the same implementation).
 */
function defaultRandomUuid(): string {
  return globalThis.crypto.randomUUID();
}

/** Default clock. */
function defaultNowMs(): number {
  return Date.now();
}

// ---------------------------------------------------------------------------
// 2 — list_adapters
// ---------------------------------------------------------------------------

const listAdaptersInput = z
  .object({
    modality: z.enum(ADAPTER_MODALITY_KINDS).optional(),
  })
  .strict();
type ListAdaptersInput = z.infer<typeof listAdaptersInput>;

const adapterDescriptorOutSchema: z.ZodType<AdapterDescriptor> = z.custom<AdapterDescriptor>(
  (v) => typeof v === 'object' && v !== null,
);

const listAdaptersOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      adapters: z.array(adapterDescriptorOutSchema),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['asset_generation_unavailable']),
      detail: z.string().optional(),
    })
    .strict(),
]);
type ListAdaptersOutput = z.infer<typeof listAdaptersOutput>;

/**
 * `list_adapters` — enumerate registered AdapterDescriptors, optionally
 * filtered by modality. Returns `{ ok: true, adapters: [] }` when the
 * registry is empty (the empty list IS the answer; not an error).
 *
 * Read soft-seam: when the executor has not wired `adapterRegistry`,
 * returns `{ ok: false, reason: 'asset_generation_unavailable' }`.
 */
const listAdapters: ToolHandler<ListAdaptersInput, ListAdaptersOutput, MutationContext> = {
  name: 'list_adapters',
  bundle: ASSET_GENERATION_BUNDLE_NAME,
  description:
    "Enumerate registered AdapterDescriptors via `@stageflip/adapters-core`'s AdapterRegistry. Optional `modality` (sealed enum from adapters-core) filter. Returns `{ ok: true, adapters: AdapterDescriptor[] }`; the empty list is returned (not an error) when no adapters match. Read soft-seam: when the executor has not wired `adapterRegistry`, returns `{ ok: false, reason: 'asset_generation_unavailable' }`. The descriptor shape carries id, modality, capability (opaque per-modality), license, sandbox, and optional cost / latency hints; per-modality call shapes live in `@stageflip/asset-gen-contract`.",
  inputSchema: listAdaptersInput,
  outputSchema: listAdaptersOutput,
  handle: (input, ctx) => {
    const seam = getAssetSeam(ctx);
    if (seam.adapterRegistry === undefined) {
      return { ok: false, reason: 'asset_generation_unavailable' };
    }
    const adapters =
      input.modality !== undefined
        ? seam.adapterRegistry.list(input.modality)
        : seam.adapterRegistry.list();
    return { ok: true, adapters: [...adapters] };
  },
};

// ---------------------------------------------------------------------------
// 3 — get_adapter_capabilities
// ---------------------------------------------------------------------------

const getAdapterCapabilitiesInput = z
  .object({
    modality: z.enum(ADAPTER_MODALITY_KINDS),
    adapterId: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'adapterId must be kebab-case'),
  })
  .strict();
type GetAdapterCapabilitiesInput = z.infer<typeof getAdapterCapabilitiesInput>;

const getAdapterCapabilitiesOutput = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      descriptor: adapterDescriptorOutSchema,
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum(['asset_generation_unavailable', 'not_found']),
      detail: z.string().optional(),
    })
    .strict(),
]);
type GetAdapterCapabilitiesOutput = z.infer<typeof getAdapterCapabilitiesOutput>;

/**
 * `get_adapter_capabilities` — look up a single AdapterDescriptor by
 * `(modality, adapterId)`. Returns `{ ok: true, descriptor }` on hit,
 * `{ ok: false, reason: 'not_found' }` on miss.
 *
 * Read soft-seam: when the executor has not wired `adapterRegistry`,
 * returns `{ ok: false, reason: 'asset_generation_unavailable' }`.
 */
const getAdapterCapabilities: ToolHandler<
  GetAdapterCapabilitiesInput,
  GetAdapterCapabilitiesOutput,
  MutationContext
> = {
  name: 'get_adapter_capabilities',
  bundle: ASSET_GENERATION_BUNDLE_NAME,
  description:
    "Look up a single AdapterDescriptor by `(modality, adapterId)` via the AdapterRegistry. Sealed `modality` enum (15 modalities from adapters-core). Required `adapterId` (kebab-case, 1..200 chars). Returns `{ ok: true, descriptor: AdapterDescriptor }` on hit; `{ ok: false, reason: 'not_found' }` on miss. Read soft-seam: when the executor has not wired `adapterRegistry`, returns `{ ok: false, reason: 'asset_generation_unavailable' }`. Use this to inspect a known adapter's capability shape (per-modality, opaque in the descriptor envelope) before calling generate_asset.",
  inputSchema: getAdapterCapabilitiesInput,
  outputSchema: getAdapterCapabilitiesOutput,
  handle: (input, ctx) => {
    const seam = getAssetSeam(ctx);
    if (seam.adapterRegistry === undefined) {
      return { ok: false, reason: 'asset_generation_unavailable' };
    }
    const descriptor = seam.adapterRegistry.lookup(input.modality, input.adapterId);
    if (descriptor === undefined) {
      return { ok: false, reason: 'not_found' };
    }
    return { ok: true, descriptor };
  },
};

// ---------------------------------------------------------------------------
// Barrel — handlers + LLM tool definitions
// ---------------------------------------------------------------------------

export const ASSET_GENERATION_HANDLERS: readonly ToolHandler<unknown, unknown, MutationContext>[] =
  [generateAsset, listAdapters, getAdapterCapabilities] as unknown as readonly ToolHandler<
    unknown,
    unknown,
    MutationContext
  >[];

const transformObject = {
  type: 'object' as const,
  description:
    'Affine transform on the canvas — `{ x, y, width (>0), height (>0), rotation? (degrees), opacity? (0..1) }`.',
};
const targetObject = {
  type: 'object' as const,
  description:
    'Mount target — `{ slideId, elementType: audio|image|video, transform, src: "asset:<id>" }`. The caller supplies `src` (the bundle does not own asset upload); the seam may overwrite it via cache-store side effects in a future task.',
};

export const ASSET_GENERATION_TOOL_DEFINITIONS: readonly LLMToolDefinition[] = [
  {
    name: 'generate_asset',
    description: generateAsset.description,
    input_schema: {
      type: 'object',
      required: ['modality', 'prompt', 'target'],
      additionalProperties: false,
      properties: {
        modality: { type: 'string', enum: [...ASSET_PRODUCING_MODALITIES] },
        prompt: { type: 'string', minLength: 1, maxLength: 16000 },
        model: { type: 'string', minLength: 1, maxLength: 200 },
        voice: { type: 'string', minLength: 1, maxLength: 200 },
        params: { type: 'object' },
        seed: { type: ['number', 'string'] },
        researchSessionId: { type: 'string', minLength: 1 },
        optimistic: { type: 'boolean' },
        target: targetObject,
        // Note: `transform` shape detailed in `targetObject.description` to keep
        // the schema flat for the LLM-facing JSONSchema.
      },
    },
  },
  {
    name: 'list_adapters',
    description: listAdapters.description,
    input_schema: {
      type: 'object',
      required: [],
      additionalProperties: false,
      properties: {
        modality: { type: 'string', enum: [...ADAPTER_MODALITY_KINDS] },
      },
    },
  },
  {
    name: 'get_adapter_capabilities',
    description: getAdapterCapabilities.description,
    input_schema: {
      type: 'object',
      required: ['modality', 'adapterId'],
      additionalProperties: false,
      properties: {
        modality: { type: 'string', enum: [...ADAPTER_MODALITY_KINDS] },
        adapterId: { type: 'string', minLength: 1, maxLength: 200 },
      },
    },
  },
];

// Avoid unused-import warning: `transformObject` is referenced via its description above.
void transformObject;
