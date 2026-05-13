// packages/marketplace-telemetry-dashboard/src/first-party/scope.ts
// T-541 — First-party launch-pack identifiers + helpers. The dashboard
// hard-codes the six first-party packs and filters out third-party
// events at receiver time. Third-party telemetry lives in a separate
// dashboard (deferred).
//
// Determinism perimeter: outside (server-side).

import { hashPackId } from '@stageflip/pack-telemetry';

/** A first-party pack identifier (publisher + pack id). */
export interface FirstPartyPackId {
  readonly publisherId: string;
  readonly packId: string;
}

/**
 * The six first-party launch packs shipped under the `stageflip`
 * publisher umbrella. Order is alphabetical by `packId` for
 * deterministic enumeration.
 */
export const FIRST_PARTY_PACK_IDS: readonly FirstPartyPackId[] = Object.freeze([
  { publisherId: 'stageflip', packId: 'creator-style' },
  { publisherId: 'stageflip', packId: 'finance' },
  { publisherId: 'stageflip', packId: 'frontier-fx' },
  { publisherId: 'stageflip', packId: 'news-pro' },
  { publisherId: 'stageflip', packId: 'sports-networks' },
  { publisherId: 'stageflip', packId: 'wedding-events' },
]);

/**
 * Compute the SHA-256 hash set for the six first-party launch packs.
 * The receiver uses this set to filter incoming events; only events
 * whose `packIdHash` is in this set are accepted.
 */
export function computeFirstPartyHashes(): Set<string> {
  const out = new Set<string>();
  for (const id of FIRST_PARTY_PACK_IDS) {
    out.add(hashPackId(id.publisherId, id.packId));
  }
  return out;
}

/** Test-only convenience: check whether a hash matches a first-party pack. */
export function isFirstPartyHash(
  hash: string,
  scope: ReadonlySet<string> = computeFirstPartyHashes(),
): boolean {
  return scope.has(hash);
}
