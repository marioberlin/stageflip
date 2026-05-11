// packages/capability-router/src/router.test.ts
// Integration tests for `routeCapability()`. Asserts per AC #6 + AC #11:
//   - happy path: multiple eligible adapters → ranked list
//   - empty registry → ok: false with no_eligible_adapters
//   - all-filtered → ok: false with dominant reason in detail string
//   - default rankingPreference is 'balanced'
//   - filteredByReason is dense (every reason present)
//   - cross-stage interaction: filtered set is correctly ranked

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import { describe, expect, it } from 'vitest';

import { routeCapability } from './router.js';

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

const TTS_CHEAP_FAST = mkAdapter({
  id: 'tts-cheap-fast',
  costPerCall: { usd: 0.01 },
  latencyMs: { p95: 100 },
});
const TTS_MID = mkAdapter({
  id: 'tts-mid',
  costPerCall: { usd: 0.05 },
  latencyMs: { p95: 500 },
});
const TTS_EXPENSIVE_SLOW = mkAdapter({
  id: 'tts-expensive-slow',
  costPerCall: { usd: 0.5 },
  latencyMs: { p95: 10000 },
});
const VIDEO_GEN = mkAdapter({
  id: 'video-gen',
  modality: { kind: 'video-gen' },
  costPerCall: { usd: 0.2 },
  latencyMs: { p95: 5000 },
});

// ──────────────────────────────────────────────────────────────────────────
// Happy path
// ──────────────────────────────────────────────────────────────────────────

describe('routeCapability — happy path', () => {
  it('returns ok: true with ranked eligible candidates (balanced default)', () => {
    const result = routeCapability({
      adapters: [TTS_EXPENSIVE_SLOW, TTS_CHEAP_FAST, TTS_MID],
      modality: 'tts',
      tenant: { licensePosture: 'permit-all' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidates.map((a) => a.id)).toEqual([
      'tts-cheap-fast',
      'tts-mid',
      'tts-expensive-slow',
    ]);
    expect(result.totalConsidered).toBe(3);
    expect(result.filteredByReason['modality-mismatch']).toBe(0);
  });

  it("orders by cheapest when rankingPreference === 'cheapest'", () => {
    const result = routeCapability({
      adapters: [TTS_EXPENSIVE_SLOW, TTS_CHEAP_FAST, TTS_MID],
      modality: 'tts',
      tenant: { licensePosture: 'permit-all' },
      rankingPreference: 'cheapest',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidates.map((a) => a.id)).toEqual([
      'tts-cheap-fast',
      'tts-mid',
      'tts-expensive-slow',
    ]);
  });

  it("orders by fastest when rankingPreference === 'fastest'", () => {
    const result = routeCapability({
      adapters: [TTS_EXPENSIVE_SLOW, TTS_MID, TTS_CHEAP_FAST],
      modality: 'tts',
      tenant: { licensePosture: 'permit-all' },
      rankingPreference: 'fastest',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidates.map((a) => a.id)).toEqual([
      'tts-cheap-fast',
      'tts-mid',
      'tts-expensive-slow',
    ]);
  });

  it("orders by qualityScorer when rankingPreference === 'highest-quality'", () => {
    const scores: Readonly<Record<string, number>> = {
      'tts-cheap-fast': 0.5,
      'tts-mid': 0.99, // best quality
      'tts-expensive-slow': 0.7,
    };
    const result = routeCapability({
      adapters: [TTS_CHEAP_FAST, TTS_MID, TTS_EXPENSIVE_SLOW],
      modality: 'tts',
      tenant: { licensePosture: 'permit-all' },
      rankingPreference: 'highest-quality',
      qualityScorer: (a) => scores[a.id] ?? 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidates.map((a) => a.id)).toEqual([
      'tts-mid',
      'tts-expensive-slow',
      'tts-cheap-fast',
    ]);
  });

  it('filters non-modality adapters before ranking', () => {
    const result = routeCapability({
      adapters: [VIDEO_GEN, TTS_CHEAP_FAST, TTS_MID],
      modality: 'tts',
      tenant: { licensePosture: 'permit-all' },
      rankingPreference: 'cheapest',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidates.map((a) => a.id)).toEqual(['tts-cheap-fast', 'tts-mid']);
    expect(result.filteredByReason['modality-mismatch']).toBe(1);
    expect(result.totalConsidered).toBe(3);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Empty / not-eligible paths
// ──────────────────────────────────────────────────────────────────────────

describe('routeCapability — empty / not-eligible paths', () => {
  it('returns ok: false when the adapter list is empty', () => {
    const result = routeCapability({
      adapters: [],
      modality: 'tts',
      tenant: { licensePosture: 'permit-all' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('no_eligible_adapters');
    expect(result.detail).toContain('no adapters supplied');
    expect(result.totalConsidered).toBe(0);
  });

  it('returns ok: false when every adapter is filtered out', () => {
    // Only video-gen adapters; caller requests tts.
    const result = routeCapability({
      adapters: [VIDEO_GEN],
      modality: 'tts',
      tenant: { licensePosture: 'permit-all' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('no_eligible_adapters');
    expect(result.detail).toContain('modality-mismatch');
    expect(result.filteredByReason['modality-mismatch']).toBe(1);
    expect(result.totalConsidered).toBe(1);
  });

  it('detail string names the dominant rejection reason', () => {
    // 2 license-denied + 1 modality-mismatch → dominant is license-denied.
    const gpl1 = mkAdapter({ id: 'gpl-1', license: { kind: 'gpl-incompatible' } });
    const gpl2 = mkAdapter({ id: 'gpl-2', license: { kind: 'gpl-incompatible' } });
    const result = routeCapability({
      adapters: [gpl1, gpl2, VIDEO_GEN],
      modality: 'tts',
      tenant: { licensePosture: 'permit-all' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain('license-denied');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Determinism
// ──────────────────────────────────────────────────────────────────────────

describe('routeCapability — determinism', () => {
  it('produces the same output for the same input (pure function)', () => {
    const args = {
      adapters: [TTS_EXPENSIVE_SLOW, TTS_CHEAP_FAST, TTS_MID],
      modality: 'tts' as const,
      tenant: { licensePosture: 'permit-all' as const },
      rankingPreference: 'cheapest' as const,
    };
    const r1 = routeCapability(args);
    const r2 = routeCapability(args);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.candidates.map((a) => a.id)).toEqual(r2.candidates.map((a) => a.id));
    expect(r1.filteredByReason).toEqual(r2.filteredByReason);
  });

  it('does NOT mutate the input adapters array', () => {
    const adapters: readonly AdapterDescriptor[] = [TTS_EXPENSIVE_SLOW, TTS_CHEAP_FAST, TTS_MID];
    const before = adapters.map((a) => a.id);
    routeCapability({
      adapters,
      modality: 'tts',
      tenant: { licensePosture: 'permit-all' },
      rankingPreference: 'cheapest',
    });
    const after = adapters.map((a) => a.id);
    expect(after).toEqual(before);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Cross-cutting cases (license / sandbox / predicate combined)
// ──────────────────────────────────────────────────────────────────────────

describe('routeCapability — cross-cutting filters', () => {
  it('combines license + sandbox + predicate filtering with ranking', () => {
    const apacheInProc = mkAdapter({
      id: 'apache-in-proc',
      license: { kind: 'apache-2.0' },
      sandbox: { kind: 'in-process' },
      costPerCall: { usd: 0.02 },
      latencyMs: { p95: 200 },
    });
    const mitSidecar = mkAdapter({
      id: 'mit-sidecar',
      license: { kind: 'mit' },
      sandbox: { kind: 'sidecar', runtime: 'python' },
      costPerCall: { usd: 0.01 },
      latencyMs: { p95: 100 },
    });
    const apacheSidecar = mkAdapter({
      id: 'apache-sidecar',
      license: { kind: 'apache-2.0' },
      sandbox: { kind: 'sidecar', runtime: 'node' },
      costPerCall: { usd: 0.03 },
      latencyMs: { p95: 300 },
    });

    const result = routeCapability({
      adapters: [apacheInProc, mitSidecar, apacheSidecar],
      modality: 'tts',
      tenant: { licensePosture: 'apache-2.0-only' },
      hostSandboxKinds: new Set(['in-process']),
      rankingPreference: 'cheapest',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Only apache-in-proc passes (mit blocked by license; apache-sidecar
    // blocked by sandbox).
    expect(result.candidates.map((a) => a.id)).toEqual(['apache-in-proc']);
    expect(result.filteredByReason['license-denied']).toBe(1);
    expect(result.filteredByReason['sandbox-unavailable']).toBe(1);
  });
});
