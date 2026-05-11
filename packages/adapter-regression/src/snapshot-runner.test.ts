// packages/adapter-regression/src/snapshot-runner.test.ts
// Tests for the pure snapshot-runner (T-435). Uses synthetic adapter
// doubles to verify the OK / drift / mismatch verdicts.

import { describe, expect, it } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import type { CanonicalInput } from './canonical-input.js';
import {
  type AdapterRegressionSnapshot,
  descriptorSha256,
  outputSha256,
} from './snapshot-format.js';
import {
  type RegressableAdapter,
  formatVerdict,
  runAdapterAgainstSnapshot,
} from './snapshot-runner.js';

const STUB_DESCRIPTOR: AdapterDescriptor = {
  id: 'demo',
  modality: { kind: 'tts' },
  capability: {},
  license: { kind: 'apache-2.0' },
  sandbox: { kind: 'in-process' },
};

function fakeAdapter(
  result: { readonly cacheKey: string } & Record<string, unknown>,
  overrides?: { descriptor?: AdapterDescriptor; id?: string; throws?: boolean },
): RegressableAdapter {
  // The runner only needs `{ cacheKey }`; we widen to any additional fields
  // so the synthetic doubles can echo plausible adapter output shapes.
  return {
    id: overrides?.id ?? 'demo',
    descriptor: overrides?.descriptor ?? STUB_DESCRIPTOR,
    invoke: async (_input: CanonicalInput) => {
      if (overrides?.throws) throw new Error('synthetic failure');
      return result;
    },
  };
}

async function buildExpectedSnapshot(
  adapter: RegressableAdapter,
  input: CanonicalInput,
  result: Record<string, unknown> & { readonly cacheKey: string },
): Promise<AdapterRegressionSnapshot> {
  return {
    id: adapter.id,
    modality: adapter.descriptor.modality.kind,
    descriptorSha256: await descriptorSha256(adapter.descriptor),
    sampleInputs: [
      {
        name: 'minimal',
        input,
        outputSha256: await outputSha256(result),
        cacheKey: result.cacheKey,
      },
    ],
  };
}

describe('runAdapterAgainstSnapshot', () => {
  it('returns ok when adapter output matches snapshot', async () => {
    const result = { cacheKey: 'tts/aaa', url: 'data:audio/wav;...', durationS: 0.5 };
    const adapter = fakeAdapter(result);
    const snapshot = await buildExpectedSnapshot(adapter, { text: 'hi' }, result);
    const verdict = await runAdapterAgainstSnapshot(adapter, snapshot);
    expect(verdict.ok).toBe(true);
  });

  it('reports cacheKey drift', async () => {
    const result = { cacheKey: 'tts/aaa', url: 'data:audio/wav;...', durationS: 0.5 };
    const adapter = fakeAdapter(result);
    const snapshot = await buildExpectedSnapshot(adapter, { text: 'hi' }, result);
    // Mutate the snapshot's expected cacheKey.
    const mutated: AdapterRegressionSnapshot = {
      ...snapshot,
      sampleInputs: [{ ...snapshot.sampleInputs[0]!, cacheKey: 'tts/wrong' }],
    };
    const verdict = await runAdapterAgainstSnapshot(adapter, mutated);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.sampleDrifts).toHaveLength(1);
    expect(verdict.sampleDrifts[0]?.field).toBe('cacheKey');
    expect(verdict.sampleDrifts[0]?.expected).toBe('tts/wrong');
    expect(verdict.sampleDrifts[0]?.actual).toBe('tts/aaa');
  });

  it('reports outputSha256 drift', async () => {
    const result = { cacheKey: 'tts/aaa', url: 'data:audio/wav;...', durationS: 0.5 };
    const adapter = fakeAdapter(result);
    const snapshot = await buildExpectedSnapshot(adapter, { text: 'hi' }, result);
    const mutated: AdapterRegressionSnapshot = {
      ...snapshot,
      sampleInputs: [{ ...snapshot.sampleInputs[0]!, outputSha256: 'f'.repeat(64) }],
    };
    const verdict = await runAdapterAgainstSnapshot(adapter, mutated);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.sampleDrifts.some((d) => d.field === 'outputSha256')).toBe(true);
  });

  it('reports descriptor drift', async () => {
    const result = { cacheKey: 'tts/aaa', url: 'data:audio/wav;...', durationS: 0.5 };
    const adapter = fakeAdapter(result);
    const snapshot = await buildExpectedSnapshot(adapter, { text: 'hi' }, result);
    const mutated: AdapterRegressionSnapshot = {
      ...snapshot,
      descriptorSha256: 'a'.repeat(64),
    };
    const verdict = await runAdapterAgainstSnapshot(adapter, mutated);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.descriptorDrift).toBeDefined();
  });

  it('reports id mismatch', async () => {
    const result = { cacheKey: 'tts/aaa', url: 'data:audio/wav;...', durationS: 0.5 };
    const adapter = fakeAdapter(result, { id: 'demo' });
    const snapshot = await buildExpectedSnapshot(adapter, { text: 'hi' }, result);
    const mutated: AdapterRegressionSnapshot = { ...snapshot, id: 'wrong-id' };
    const verdict = await runAdapterAgainstSnapshot(adapter, mutated);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.idMismatch).toEqual({ expected: 'wrong-id', actual: 'demo' });
  });

  it('reports modality mismatch', async () => {
    const result = { cacheKey: 'tts/aaa', url: 'data:audio/wav;...', durationS: 0.5 };
    const adapter = fakeAdapter(result);
    const snapshot = await buildExpectedSnapshot(adapter, { text: 'hi' }, result);
    const mutated: AdapterRegressionSnapshot = { ...snapshot, modality: 'video-gen' };
    const verdict = await runAdapterAgainstSnapshot(adapter, mutated);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.modalityMismatch).toEqual({ expected: 'video-gen', actual: 'tts' });
  });

  it('treats invocation throw as outputSha256 drift', async () => {
    const result = { cacheKey: 'tts/aaa', url: 'data:audio/wav;...', durationS: 0.5 };
    const adapter = fakeAdapter(result, { throws: true });
    const snapshot = await buildExpectedSnapshot(
      fakeAdapter(result),
      { text: 'hi' },
      result,
    );
    const verdict = await runAdapterAgainstSnapshot(adapter, snapshot);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.sampleDrifts[0]?.field).toBe('outputSha256');
    expect(verdict.sampleDrifts[0]?.actual).toMatch(/THREW/);
  });
});

describe('formatVerdict', () => {
  it('formats an OK verdict', () => {
    expect(formatVerdict('demo', { ok: true })).toContain('OK');
  });

  it('formats a drift verdict with sample drifts', () => {
    const out = formatVerdict('demo', {
      ok: false,
      sampleDrifts: [
        {
          sampleName: 'minimal',
          field: 'cacheKey',
          expected: 'tts/aaa',
          actual: 'tts/bbb',
        },
      ],
    });
    expect(out).toContain('DRIFT');
    expect(out).toContain('cacheKey');
    expect(out).toContain('tts/aaa');
    expect(out).toContain('tts/bbb');
  });
});
