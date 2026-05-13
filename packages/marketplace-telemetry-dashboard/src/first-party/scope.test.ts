// packages/marketplace-telemetry-dashboard/src/first-party/scope.test.ts
// T-541 — Confirms the six launch-pack identifiers, hash determinism,
// and the `isFirstPartyHash` helper.

import { hashPackId } from '@stageflip/pack-telemetry';
import { describe, expect, it } from 'vitest';

import { FIRST_PARTY_PACK_IDS, computeFirstPartyHashes, isFirstPartyHash } from './scope.js';

describe('FIRST_PARTY_PACK_IDS', () => {
  it('lists exactly the six launch packs', () => {
    expect(FIRST_PARTY_PACK_IDS.length).toBe(6);
    const ids = FIRST_PARTY_PACK_IDS.map((p) => p.packId).sort();
    expect(ids).toEqual([
      'creator-style',
      'finance',
      'frontier-fx',
      'news-pro',
      'sports-networks',
      'wedding-events',
    ]);
    for (const p of FIRST_PARTY_PACK_IDS) {
      expect(p.publisherId).toBe('stageflip');
    }
  });
});

describe('computeFirstPartyHashes', () => {
  it('produces six deterministic SHA-256 hashes', () => {
    const a = computeFirstPartyHashes();
    const b = computeFirstPartyHashes();
    expect(a.size).toBe(6);
    expect([...a].sort()).toEqual([...b].sort());
    for (const h of a) {
      expect(h.length).toBe(64);
    }
  });

  it("contains the news-pro hash computed via pack-telemetry's hashPackId", () => {
    const scope = computeFirstPartyHashes();
    expect(scope.has(hashPackId('stageflip', 'news-pro'))).toBe(true);
  });
});

describe('isFirstPartyHash', () => {
  it('accepts a first-party hash and rejects an unrelated hash', () => {
    const newsProHash = hashPackId('stageflip', 'news-pro');
    const thirdPartyHash = hashPackId('acme', 'some-pack');
    expect(isFirstPartyHash(newsProHash)).toBe(true);
    expect(isFirstPartyHash(thirdPartyHash)).toBe(false);
  });
});
