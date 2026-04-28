// packages/render-farm/src/k8s-stub.test.ts
// KubernetesRenderFarmAdapter stub tests (T-266 ACs #9–#11).

import { describe, expect, it } from 'vitest';

import { NotImplementedError } from './errors.js';
import { KubernetesRenderFarmAdapter } from './k8s-stub.js';

describe('KubernetesRenderFarmAdapter (stub)', () => {
  it('AC #9: constructor accepts an opaque config object', () => {
    const config = { kubeconfig: '/path', namespace: 'stageflip-bakes', whatever: 42 };
    const a = new KubernetesRenderFarmAdapter(config);
    expect(a.getConfig()).toEqual(config);
  });

  it('AC #9: constructs without args (default empty config)', () => {
    const a = new KubernetesRenderFarmAdapter();
    expect(a.getConfig()).toEqual({});
  });

  it('AC #11: capabilities reports maxConcurrentJobs: 0 (signals not deployed)', () => {
    const a = new KubernetesRenderFarmAdapter();
    expect(a.capabilities.maxConcurrentJobs).toBe(0);
  });

  it('AC #11: capabilities are stub-typed but compatible with the contract', () => {
    const a = new KubernetesRenderFarmAdapter();
    expect(a.capabilities).toEqual({
      streamingLogs: false,
      gpuTypes: ['cpu-only'],
      fastScaleUp: false,
      maxConcurrentJobs: 0,
    });
  });

  it('vendor identifier is "k8s"', () => {
    expect(new KubernetesRenderFarmAdapter().vendor).toBe('k8s');
  });

  describe('AC #10: every method throws NotImplementedError', () => {
    const a = new KubernetesRenderFarmAdapter();
    const job = {
      bakeId: 'b1',
      image: 'stageflip/blender-worker:latest',
      resources: { cpu: 1, memoryGB: 4 },
      env: {},
    };

    it('submitJob', async () => {
      await expect(a.submitJob(job)).rejects.toThrow(NotImplementedError);
      await expect(a.submitJob(job)).rejects.toThrow(/render-farm-vendors\.md/);
    });

    it('cancelJob', async () => {
      await expect(a.cancelJob('any')).rejects.toThrow(NotImplementedError);
    });

    it('getJobStatus', async () => {
      await expect(a.getJobStatus('any')).rejects.toThrow(NotImplementedError);
    });

    it('streamLogs', async () => {
      const iter = a.streamLogs('any');
      await expect(async () => {
        for await (const _line of iter) {
          /* unreachable */
        }
      }).rejects.toThrow(NotImplementedError);
    });
  });
});
