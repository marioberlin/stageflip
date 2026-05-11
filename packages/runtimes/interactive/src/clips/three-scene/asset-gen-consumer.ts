// packages/runtimes/interactive/src/clips/three-scene/asset-gen-consumer.ts
// 3D→ThreeSceneClip GLB consumer (T-437).
//
// When a 3D-modality adapter (Tripo, Meshy) generates a GLB asset, the
// result carries a deterministic `cacheKey` per ADR-008 §D1 (T-420
// `@stageflip/asset-cache`). This file lets `ThreeSceneClip` mount the
// cached bytes by resolving the cacheKey against a pluggable
// `AssetCacheLookup` callback.
//
// Mirrors the T-436 captions/tts-bypass pattern:
//   1. A static `THREE_D_BYPASS_WHITELIST` of provider ids whose GLB
//      output the host trusts.
//   2. A pure resolver `resolveAssetGenGlb()` that turns a
//      `{ kind, cacheKey, provider }` descriptor + a lookup callback
//      into either `{ ok: true, bytes, provider }` or
//      `{ ok: false, reason }`.
//   3. Schema-agnostic: the runtime mirrors the structural shape of
//      `seedSrc` locally so we don't add a runtime dep on
//      `@stageflip/schema`'s `MediaProvenance` (T-421), the 3D adapter
//      packages (T-428 / T-429), or `@stageflip/asset-cache` (T-420).
//
// The factory's `assetGenResolver` hook (see `factory.ts`) is the
// glue: hosts wire a closure over their own `AssetCacheStore` instance
// and pass the descriptor at call time. The resolver result is merged
// into `setupProps.__assetGen` so the author's `ThreeClipSetup<P>`
// callback can mount the bytes (or pick a placeholder on failure)
// inside the Three.js scene.
//
// DETERMINISM SUB-RULE (T-309 / T-309a): path-matched. This file calls
// only the provided `AssetCacheLookup` and pure JS — no forbidden API.
//
// Browser-safe: no Node-only imports.

/**
 * 3D adapter ids whose GLB output the host trusts for the
 * ThreeSceneClip asset-gen mount path. Initial entries (T-437):
 * T-428 Tripo + T-429 Meshy.
 *
 * Adding a third entry is a deliberate host-side trust signal —
 * `ThreeDCapabilityDescriptor.outputFormats` including `'glb'` alone is
 * not sufficient. Pair every whitelist change with a three-runtime
 * SKILL update.
 */
export const THREE_D_BYPASS_WHITELIST = ['tripo', 'meshy'] as const;

/** A provider id known to emit host-trusted GLB output. */
export type ThreeDBypassWhitelistedProvider = (typeof THREE_D_BYPASS_WHITELIST)[number];

/**
 * Local mirror of the relevant fields from
 * `@stageflip/schema#MediaProvenance` — kept structural so this module
 * does NOT pull `@stageflip/schema` into the runtime bundle. Hosts
 * build this descriptor at the call site from their own
 * `MediaProvenance` instance.
 */
export interface AssetGenSeedSrc {
  /** Discriminator. Resolver only fires on `'asset-gen'`. */
  readonly kind: string;
  /**
   * The `ThreeDResult.cacheKey` from the upstream 3D adapter (T-428 /
   * T-429). Format: `${modality}/${64-hex-sha256}` per ADR-008 §D1.
   */
  readonly cacheKey: string;
  /**
   * Adapter id (`AdapterDescriptor.id`). Resolver checks this against
   * {@link THREE_D_BYPASS_WHITELIST}.
   */
  readonly provider?: string;
}

/**
 * Pluggable cache-lookup callback. Hosts wire a closure over their own
 * `AssetCacheStore<Uint8Array>` instance — see ADR-008 §D1 and T-420
 * `@stageflip/asset-cache`.
 *
 * Returns the cached GLB bytes when the key is set; `undefined` on
 * cache miss. The callback may be async because production stores
 * (Redis, CDN, AssetStorage) need network I/O.
 */
export type AssetCacheLookup = (cacheKey: string) => Promise<Uint8Array | undefined>;

/** Successful resolution — cache hit, bytes available, provider trusted. */
export interface AssetGenGlbOk {
  readonly ok: true;
  readonly bytes: Uint8Array;
  readonly provider: ThreeDBypassWhitelistedProvider;
}

/**
 * Failure reasons the resolver may return. All are silent (no
 * exception thrown); the caller falls back to a placeholder GLB.
 *
 * - `kind-mismatch` — `seedSrc.kind !== 'asset-gen'`.
 * - `provider-missing` — `seedSrc.provider` is absent.
 * - `provider-not-whitelisted` — provider is not on
 *   {@link THREE_D_BYPASS_WHITELIST}.
 * - `cacheKey-missing` — `seedSrc.cacheKey` is empty.
 * - `cache-miss` — lookup returned `undefined`.
 * - `cache-empty` — lookup returned a zero-length `Uint8Array`.
 */
export type AssetGenGlbFailureReason =
  | 'kind-mismatch'
  | 'provider-missing'
  | 'provider-not-whitelisted'
  | 'cacheKey-missing'
  | 'cache-miss'
  | 'cache-empty';

/** Failed resolution — the caller should mount a placeholder. */
export interface AssetGenGlbFail {
  readonly ok: false;
  readonly reason: AssetGenGlbFailureReason;
}

/** Resolver return shape — discriminated on `ok`. */
export type AssetGenGlbResult = AssetGenGlbOk | AssetGenGlbFail;

const isWhitelistedProvider = (
  provider: string | undefined,
): provider is ThreeDBypassWhitelistedProvider => {
  if (provider === undefined) return false;
  return (THREE_D_BYPASS_WHITELIST as readonly string[]).includes(provider);
};

/**
 * Resolve an `asset-gen` seedSrc descriptor against the supplied
 * `AssetCacheStore` lookup. Returns the GLB bytes (with provider tag)
 * on success, or a structured failure reason — never throws.
 *
 * Eligibility rules (all must hold for success):
 *   - `seedSrc.kind === 'asset-gen'`
 *   - `seedSrc.provider` is on {@link THREE_D_BYPASS_WHITELIST}
 *   - `seedSrc.cacheKey` is a non-empty string
 *   - `lookup(cacheKey)` resolves to a non-empty `Uint8Array`
 *
 * The lookup is invoked AT MOST ONCE per call, and only after every
 * structural check passes — pre-flight failures (`kind-mismatch`,
 * `provider-missing`, `provider-not-whitelisted`, `cacheKey-missing`)
 * do not touch the cache. This keeps the surface honest for hosts
 * whose `AssetCacheStore.get()` has nontrivial cost (Redis round-trip,
 * AssetStorage GET) and keeps test recordings clean.
 *
 * Determinism: same inputs → same outputs. The resolver has no
 * internal state; multiple calls with the same descriptor + lookup
 * return byte-identical results.
 */
export async function resolveAssetGenGlb(
  seedSrc: AssetGenSeedSrc,
  lookup: AssetCacheLookup,
): Promise<AssetGenGlbResult> {
  // (1) Kind discriminator.
  if (seedSrc.kind !== 'asset-gen') {
    return { ok: false, reason: 'kind-mismatch' };
  }

  // (2) Provider presence.
  if (seedSrc.provider === undefined || seedSrc.provider.length === 0) {
    return { ok: false, reason: 'provider-missing' };
  }

  // (3) Whitelist membership.
  if (!isWhitelistedProvider(seedSrc.provider)) {
    return { ok: false, reason: 'provider-not-whitelisted' };
  }

  // (4) cacheKey presence.
  if (typeof seedSrc.cacheKey !== 'string' || seedSrc.cacheKey.length === 0) {
    return { ok: false, reason: 'cacheKey-missing' };
  }

  // (5) Cache lookup.
  const bytes = await lookup(seedSrc.cacheKey);
  if (bytes === undefined) {
    return { ok: false, reason: 'cache-miss' };
  }
  if (bytes.length === 0) {
    return { ok: false, reason: 'cache-empty' };
  }

  return { ok: true, bytes, provider: seedSrc.provider };
}

/**
 * Reserved key under which the factory merges the resolver result into
 * the author's `setupProps`. Authors that opt into asset-gen mounting
 * read this key inside their `ThreeClipSetup<P>` callback:
 *
 * ```ts
 * const setup: ThreeClipSetup<MyProps> = ({ container, props }) => {
 *   const ag = (props as Record<string, unknown>)[ASSET_GEN_SETUP_PROPS_KEY];
 *   if (ag && (ag as AssetGenGlbResult).ok) {
 *     // mount (ag as AssetGenGlbOk).bytes via three-gltf-loader
 *   } else {
 *     // mount a placeholder mesh
 *   }
 *   // …
 * };
 * ```
 *
 * The double-underscore prefix marks this as a runtime-reserved key
 * inside the schema-opaque `setupProps: Record<string, unknown>` slot.
 * Authors that don't use asset-gen mounting see no change.
 */
export const ASSET_GEN_SETUP_PROPS_KEY = '__assetGen';
