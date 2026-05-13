// packages/engine/src/license/license-runtime.ts
// T-496 — Clip-mount license gate (ADR-012 §D6 point 2). The pack-loader
// (T-495) runs the install-time gate; this runtime re-checks tenant
// entitlement at clip-mount time so a pack that was admitted at install
// can be refused later if its entitlement lapses / is revoked mid-session.
//
// Determinism: `packages/engine/**` is OUTSIDE the determinism perimeter
// per CLAUDE.md §3, so `Date.now()` is fair game for cache TTL bookkeeping.

import type { LicenseClaim, PackFormatLossFlagCode, PackManifest } from '@stageflip/pack-format';
import type { TenantEntitlement, TenantEntitlementsLike } from '@stageflip/pack-loader';

/**
 * A clip's license provenance — captured at `registerPack` time and
 * queried at clip-mount time. The runtime keeps a `Map<clipKind,
 * ClipLicenseRecord>` so `canMountClip` is a constant-time lookup.
 */
export interface ClipLicenseRecord {
  readonly clipKind: string;
  readonly packId: string;
  readonly publisherId: string;
  readonly license: PackManifest['license'];
}

/**
 * Result of a `canMountClip` call. `ok:true` means the engine may
 * instantiate the clip; `ok:false` means refuse + emit `reason` as
 * a loss flag. `detail` is a human-readable string for logging /
 * telemetry; it is not part of the LF code itself.
 */
export interface LicenseMountResult {
  readonly ok: boolean;
  readonly reason?: PackFormatLossFlagCode;
  readonly detail?: string;
}

export interface LicenseRuntimeDependencies {
  readonly entitlements: TenantEntitlementsLike;
  /** Optional cache TTL (ms). Default: 60_000. */
  readonly cacheTtlMs?: number;
}

interface CacheEntry {
  readonly entitlement: TenantEntitlement | null;
  readonly fetchedAt: number;
}

const DEFAULT_CACHE_TTL_MS = 60_000;

/**
 * Stateful license-runtime instance. The host engine builds one per
 * tenant session, calls `registerPack(manifest)` for each loaded pack,
 * then consults `canMountClip(kind)` before instantiating clips. Core /
 * built-in clips (never registered through a pack) are implicitly
 * licensed — `canMountClip` returns `{ok:true}` for unknown kinds.
 */
export class LicenseRuntime {
  readonly #entitlements: TenantEntitlementsLike;
  readonly #cacheTtlMs: number;
  readonly #clipLicenses = new Map<string, ClipLicenseRecord>();
  readonly #entitlementCache = new Map<string, CacheEntry>();

  constructor(deps: LicenseRuntimeDependencies) {
    this.#entitlements = deps.entitlements;
    this.#cacheTtlMs = deps.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  }

  /**
   * Register a pack's clipKind contributions against its license.
   * Idempotent for repeated calls with the same manifest; later
   * registrations of the same clipKind overwrite earlier ones (the
   * engine is responsible for upstream collision detection — by the
   * time a manifest reaches the license runtime it has been admitted).
   */
  registerPack(manifest: PackManifest): void {
    const clipKinds = manifest.contributes.clipKinds ?? [];
    for (const entry of clipKinds) {
      this.#clipLicenses.set(entry.kind, {
        clipKind: entry.kind,
        packId: manifest.id,
        publisherId: manifest.publisher.id,
        license: manifest.license,
      });
    }
  }

  /**
   * Check whether a clipKind may be mounted right now. Returns
   * `{ok:true}` for:
   *   - unknown / never-registered clipKinds (core clips)
   *   - clips contributed by open-licensed packs
   *   - clips contributed by paid / enterprise packs whose entitlement
   *     status is currently `'active'`
   *
   * Returns `{ok:false, reason:'LF-LICENSE-CLIP-REVOKED', detail}` for
   * paid / enterprise clips whose entitlement is null / lapsed /
   * revoked / pending.
   */
  async canMountClip(clipKind: string): Promise<LicenseMountResult> {
    const record = this.#clipLicenses.get(clipKind);
    if (!record) {
      // Implicit licensing for core / built-in clips that never went
      // through pack registration.
      return { ok: true };
    }

    const license: LicenseClaim = record.license;
    if (license.kind === 'open') {
      return { ok: true };
    }

    // paid-per-tenant or enterprise — both require an active
    // entitlement against the declared sku.
    const sku = license.sku;
    const entitlement = await this.#getEntitlementCached(sku);

    if (entitlement === null) {
      return {
        ok: false,
        reason: 'LF-LICENSE-CLIP-REVOKED',
        detail: `no entitlement on file for sku '${sku}' (clip '${clipKind}' from pack '${record.packId}')`,
      };
    }

    if (entitlement.status !== 'active') {
      return {
        ok: false,
        reason: 'LF-LICENSE-CLIP-REVOKED',
        detail: `entitlement for sku '${sku}' is ${entitlement.status} (clip '${clipKind}' from pack '${record.packId}')`,
      };
    }

    return { ok: true };
  }

  /** Flush the entitlement cache. Intended for tests + admin tooling. */
  clearCache(): void {
    this.#entitlementCache.clear();
  }

  async #getEntitlementCached(sku: string): Promise<TenantEntitlement | null> {
    const now = Date.now();
    const hit = this.#entitlementCache.get(sku);
    if (hit && now - hit.fetchedAt < this.#cacheTtlMs) {
      return hit.entitlement;
    }
    const fresh = await this.#entitlements.getEntitlement(sku);
    this.#entitlementCache.set(sku, { entitlement: fresh, fetchedAt: now });
    return fresh;
  }
}
