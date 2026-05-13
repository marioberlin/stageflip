// packages/marketplace-npm/src/verifier/license-verifier.ts
// T-539 — License-claim verifier for the marketplace npm-based path
// per ADR-014 §D2. Given a pack manifest's `LicenseClaim`, the
// publisher's npm scope, and the tenant's locally-stored npm tokens,
// decide whether the install should proceed.
//
// Gate semantics:
//   open                 → always pass (no token check)
//   paid-per-tenant      → require (a) a token for the publisher scope
//                          AND (b) an `active` entitlement
//   enterprise           → require (a) a token for the publisher scope
//                          AND (b) an `active` entitlement
//
// Failure modes map to existing pack-format LF codes:
//   LF-NPM-TOKEN-MISSING   no token in the local store for the scope
//   LF-LICENSE-PACK-DENIED no / lapsed / pending entitlement
//   LF-LICENSE-CLIP-REVOKED entitlement explicitly revoked
//
// Determinism perimeter: outside (CLI / host side).

import type { NpmTokenStore } from '../tokens/token-store.js';

/** Subset of `LicenseClaim` this verifier needs. */
export interface LicenseClaimInput {
  readonly kind: 'open' | 'paid-per-tenant' | 'enterprise';
  readonly sku?: string;
  readonly spdx?: string;
}

/** Input to `verifyLicenseClaim`. */
export interface LicenseVerificationInput {
  /** The pack manifest's license claim. */
  readonly license: LicenseClaimInput;
  /** The publisher's npm scope (e.g. `@stageflip`). */
  readonly publisherScope: string;
  /**
   * Status of the tenant's entitlement for `license.sku` (when paid /
   * enterprise). Pass `null` / omit when the verifier should treat
   * the entitlement as "missing" (no row in the entitlements store).
   * The sidecar verification HTTP client typically supplies this.
   */
  readonly entitlementStatus?: 'active' | 'lapsed' | 'revoked' | 'pending' | null;
}

/** Result of `verifyLicenseClaim`. */
export interface LicenseVerificationResult {
  readonly ok: boolean;
  readonly reason?: 'LF-NPM-TOKEN-MISSING' | 'LF-LICENSE-PACK-DENIED' | 'LF-LICENSE-CLIP-REVOKED';
  readonly detail?: string;
}

/**
 * Verify a pack manifest license claim against the tenant's npm
 * tokens + entitlement status. See module header for gate semantics.
 *
 * Throws on unknown `license.kind` — callers must pass a value from
 * the `LicenseClaim` discriminated union.
 */
export async function verifyLicenseClaim(
  input: LicenseVerificationInput,
  tokens: NpmTokenStore,
): Promise<LicenseVerificationResult> {
  const { license, publisherScope, entitlementStatus } = input;

  if (license.kind === 'open') {
    return { ok: true };
  }

  if (license.kind !== 'paid-per-tenant' && license.kind !== 'enterprise') {
    // Exhaustiveness gate: the LicenseClaim union only has three
    // members; an unknown `kind` is a programmer error.
    throw new Error(`verifyLicenseClaim: unknown license.kind: ${JSON.stringify(license.kind)}`);
  }

  // Both paid + enterprise require a tenant npm token for the
  // publisher's scope.
  const token = await tokens.lookup(publisherScope);
  if (token === null) {
    return {
      ok: false,
      reason: 'LF-NPM-TOKEN-MISSING',
      detail: `No npm auth token configured for scope ${publisherScope}; cannot install ${license.kind} pack`,
    };
  }

  // Then a matching entitlement.
  if (entitlementStatus === 'revoked') {
    return {
      ok: false,
      reason: 'LF-LICENSE-CLIP-REVOKED',
      detail: `Entitlement for sku ${license.sku ?? '<unknown>'} is revoked`,
    };
  }

  if (entitlementStatus !== 'active') {
    // Includes `lapsed`, `pending`, `null` / missing.
    return {
      ok: false,
      reason: 'LF-LICENSE-PACK-DENIED',
      detail: `Entitlement for sku ${license.sku ?? '<unknown>'} is ${entitlementStatus ?? 'missing'}`,
    };
  }

  return { ok: true };
}
