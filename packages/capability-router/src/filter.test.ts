// packages/capability-router/src/filter.test.ts
// Filter-pipeline tests. Asserts per AC #4 + AC #8 + AC #9 + AC #11:
//   - stage 1 (modality match) — pass + reject paths
//   - stage 2 (capability predicate) — pass + reject + absent paths
//   - stage 3 (license / sandbox) — every LicenseGate decision +
//     sandbox-availability paths
//   - ordering invariant: rejection at stage N is NOT re-considered at
//     stage N+1 (first-failure attribution)
//   - buildFilterPipeline returns a reusable closure

import type { AdapterDescriptor, LicenseGate, TenantContext } from '@stageflip/adapters-core';
import { describe, expect, it } from 'vitest';

import { buildFilterPipeline } from './filter.js';

// ──────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────

function mkAdapter(
  over: Partial<AdapterDescriptor> & Pick<AdapterDescriptor, 'id'>,
): AdapterDescriptor {
  return {
    modality: { kind: 'tts' },
    capability: {},
    license: { kind: 'apache-2.0' },
    sandbox: { kind: 'in-process' },
    ...over,
  };
}

const PERMIT_ALL_TENANT: TenantContext = { licensePosture: 'permit-all' };

const TTS_APACHE = mkAdapter({
  id: 'tts-apache',
  modality: { kind: 'tts' },
  license: { kind: 'apache-2.0' },
});
const TTS_MIT = mkAdapter({ id: 'tts-mit', modality: { kind: 'tts' }, license: { kind: 'mit' } });
const VIDEO_APACHE = mkAdapter({
  id: 'video-apache',
  modality: { kind: 'video-gen' },
  license: { kind: 'apache-2.0' },
});
const TTS_GPL = mkAdapter({
  id: 'tts-gpl',
  modality: { kind: 'tts' },
  license: { kind: 'gpl-incompatible' },
});
const TTS_BYO = mkAdapter({
  id: 'tts-byo',
  modality: { kind: 'tts' },
  license: { kind: 'proprietary-byo' },
});
const TTS_SIDECAR = mkAdapter({
  id: 'tts-sidecar',
  modality: { kind: 'tts' },
  sandbox: { kind: 'sidecar', runtime: 'python' },
});

// ──────────────────────────────────────────────────────────────────────────
// Stage 1: modality match
// ──────────────────────────────────────────────────────────────────────────

describe('filter pipeline — stage 1 (modality)', () => {
  it('rejects adapters whose modality.kind !== input.modality', () => {
    const pipeline = buildFilterPipeline({ modality: 'tts', tenant: PERMIT_ALL_TENANT });
    const result = pipeline([TTS_APACHE, VIDEO_APACHE]);
    expect(result.passed.map((a) => a.id)).toEqual(['tts-apache']);
    expect(result.filteredByReason['modality-mismatch']).toBe(1);
    expect(result.filteredByReason['capability-mismatch']).toBe(0);
    expect(result.filteredByReason['license-denied']).toBe(0);
  });

  it('passes adapters when ALL match the requested modality', () => {
    const pipeline = buildFilterPipeline({ modality: 'tts', tenant: PERMIT_ALL_TENANT });
    const result = pipeline([TTS_APACHE, TTS_MIT]);
    expect(result.passed.map((a) => a.id)).toEqual(['tts-apache', 'tts-mit']);
    expect(result.filteredByReason['modality-mismatch']).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Stage 2: capability predicate
// ──────────────────────────────────────────────────────────────────────────

describe('filter pipeline — stage 2 (capability predicate)', () => {
  it('rejects adapters where the predicate returns false', () => {
    const pipeline = buildFilterPipeline({
      modality: 'tts',
      tenant: PERMIT_ALL_TENANT,
      capabilityPredicate: (_cap, adapter) => adapter.id === 'tts-apache',
    });
    const result = pipeline([TTS_APACHE, TTS_MIT]);
    expect(result.passed.map((a) => a.id)).toEqual(['tts-apache']);
    expect(result.filteredByReason['capability-mismatch']).toBe(1);
  });

  it('passes every stage-1 survivor when no predicate is supplied', () => {
    const pipeline = buildFilterPipeline({ modality: 'tts', tenant: PERMIT_ALL_TENANT });
    const result = pipeline([TTS_APACHE, TTS_MIT]);
    expect(result.passed.map((a) => a.id)).toEqual(['tts-apache', 'tts-mit']);
    expect(result.filteredByReason['capability-mismatch']).toBe(0);
  });

  it('does NOT invoke the predicate on adapters rejected at stage 1', () => {
    let calls = 0;
    const pipeline = buildFilterPipeline({
      modality: 'tts',
      tenant: PERMIT_ALL_TENANT,
      capabilityPredicate: () => {
        calls += 1;
        return true;
      },
    });
    pipeline([VIDEO_APACHE, TTS_APACHE]);
    // VIDEO_APACHE is rejected at stage 1 (modality-mismatch); only
    // TTS_APACHE reaches the predicate.
    expect(calls).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Stage 3: license + sandbox
// ──────────────────────────────────────────────────────────────────────────

describe('filter pipeline — stage 3 (license gate)', () => {
  it('rejects gpl-incompatible adapters unconditionally', () => {
    const pipeline = buildFilterPipeline({ modality: 'tts', tenant: PERMIT_ALL_TENANT });
    const result = pipeline([TTS_APACHE, TTS_GPL]);
    expect(result.passed.map((a) => a.id)).toEqual(['tts-apache']);
    expect(result.filteredByReason['license-denied']).toBe(1);
  });

  it('rejects mit adapters under apache-2.0-only tenant posture', () => {
    const pipeline = buildFilterPipeline({
      modality: 'tts',
      tenant: { licensePosture: 'apache-2.0-only' },
    });
    const result = pipeline([TTS_APACHE, TTS_MIT]);
    expect(result.passed.map((a) => a.id)).toEqual(['tts-apache']);
    expect(result.filteredByReason['license-denied']).toBe(1);
  });

  it("returns 'credential-missing' for proprietary-byo when credentials are absent", () => {
    const pipeline = buildFilterPipeline({
      modality: 'tts',
      tenant: { licensePosture: 'permit-byo' },
    });
    const result = pipeline([TTS_BYO]);
    expect(result.passed).toEqual([]);
    expect(result.filteredByReason['credential-missing']).toBe(1);
    expect(result.filteredByReason['license-denied']).toBe(0);
  });

  it('allows proprietary-byo adapters when credentials are present', () => {
    const pipeline = buildFilterPipeline({
      modality: 'tts',
      tenant: {
        licensePosture: 'permit-byo',
        credentials: new Set(['tts-byo']),
      },
    });
    const result = pipeline([TTS_BYO]);
    expect(result.passed.map((a) => a.id)).toEqual(['tts-byo']);
    expect(result.filteredByReason['credential-missing']).toBe(0);
  });

  it('accepts a caller-supplied LicenseGate that overrides default behavior', () => {
    const denyAll: LicenseGate = { evaluate: () => 'deny' };
    const pipeline = buildFilterPipeline({
      modality: 'tts',
      tenant: PERMIT_ALL_TENANT,
      licenseGate: denyAll,
    });
    const result = pipeline([TTS_APACHE, TTS_MIT]);
    expect(result.passed).toEqual([]);
    expect(result.filteredByReason['license-denied']).toBe(2);
  });
});

describe('filter pipeline — stage 3 (sandbox)', () => {
  it('rejects adapters whose sandbox.kind is absent from hostSandboxKinds', () => {
    const pipeline = buildFilterPipeline({
      modality: 'tts',
      tenant: PERMIT_ALL_TENANT,
      hostSandboxKinds: new Set(['in-process']),
    });
    const result = pipeline([TTS_APACHE, TTS_SIDECAR]);
    expect(result.passed.map((a) => a.id)).toEqual(['tts-apache']);
    expect(result.filteredByReason['sandbox-unavailable']).toBe(1);
  });

  it('does not filter on sandbox when hostSandboxKinds is omitted (default)', () => {
    const pipeline = buildFilterPipeline({ modality: 'tts', tenant: PERMIT_ALL_TENANT });
    const result = pipeline([TTS_APACHE, TTS_SIDECAR]);
    expect(result.passed.map((a) => a.id)).toEqual(['tts-apache', 'tts-sidecar']);
    expect(result.filteredByReason['sandbox-unavailable']).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Ordering invariant: first-failure attribution
// ──────────────────────────────────────────────────────────────────────────

describe('filter pipeline — ordering invariant', () => {
  it('attributes a stage-1 rejection to modality-mismatch (NOT to later stages)', () => {
    // VIDEO_APACHE fails stage 1; if the pipeline were to re-test it at
    // stages 2/3 it might also fail capability or license. The invariant
    // is that only stage-1's tally increments.
    const pipeline = buildFilterPipeline({
      modality: 'tts',
      tenant: { licensePosture: 'apache-2.0-only' },
      capabilityPredicate: () => false, // would reject everything at stage 2
    });
    const result = pipeline([VIDEO_APACHE]);
    expect(result.filteredByReason['modality-mismatch']).toBe(1);
    expect(result.filteredByReason['capability-mismatch']).toBe(0);
    expect(result.filteredByReason['license-denied']).toBe(0);
  });

  it('attributes a stage-2 rejection to capability-mismatch (NOT to license)', () => {
    const pipeline = buildFilterPipeline({
      modality: 'tts',
      tenant: { licensePosture: 'apache-2.0-only' }, // would also deny MIT
      capabilityPredicate: () => false,
    });
    const result = pipeline([TTS_MIT]);
    expect(result.filteredByReason['capability-mismatch']).toBe(1);
    expect(result.filteredByReason['license-denied']).toBe(0);
  });

  it('returns a dense tally — every reason key present even at zero', () => {
    const pipeline = buildFilterPipeline({ modality: 'tts', tenant: PERMIT_ALL_TENANT });
    const result = pipeline([TTS_APACHE]);
    expect(Object.keys(result.filteredByReason).sort()).toEqual([
      'capability-mismatch',
      'credential-missing',
      'license-denied',
      'modality-mismatch',
      'sandbox-unavailable',
    ]);
  });

  it('returns frozen filteredByReason (immutable)', () => {
    const pipeline = buildFilterPipeline({ modality: 'tts', tenant: PERMIT_ALL_TENANT });
    const result = pipeline([TTS_APACHE]);
    expect(Object.isFrozen(result.filteredByReason)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// buildFilterPipeline — closure reuse
// ──────────────────────────────────────────────────────────────────────────

describe('buildFilterPipeline', () => {
  it('returns a closure callable multiple times with independent results', () => {
    const pipeline = buildFilterPipeline({ modality: 'tts', tenant: PERMIT_ALL_TENANT });
    const a = pipeline([TTS_APACHE, TTS_MIT]);
    const b = pipeline([VIDEO_APACHE]);
    expect(a.passed).toHaveLength(2);
    expect(b.passed).toHaveLength(0);
    expect(b.filteredByReason['modality-mismatch']).toBe(1);
  });

  it('handles empty input array', () => {
    const pipeline = buildFilterPipeline({ modality: 'tts', tenant: PERMIT_ALL_TENANT });
    const result = pipeline([]);
    expect(result.passed).toEqual([]);
    expect(result.filteredByReason['modality-mismatch']).toBe(0);
  });
});
