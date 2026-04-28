// packages/render-farm/src/k8s-stub.ts
// KubernetesRenderFarmAdapter stub (T-266 D-T266-2). Class skeleton with the
// methods bound to the contract, all of which throw NotImplementedError. The
// shape exists so consumers compile against it; the real implementation lands
// when a vendor is picked (see docs/ops/render-farm-vendors.md).
//
// The stub config is deliberately opaque (`Record<string, unknown>`) per the
// escalation note in T-266: we don't yet know the actual K8s deployment shape,
// so locking a typed config now would require bigger churn later. A real
// implementation will replace this with a typed K8sAdapterConfig.

import type {
  RenderFarmAdapter,
  RenderFarmCapabilities,
  RenderFarmJob,
  RenderFarmJobStatus,
  StreamLogsOptions,
} from './contract.js';
import { NotImplementedError } from './errors.js';

/** Opaque config — see file header for rationale. */
export type KubernetesAdapterConfig = Readonly<Record<string, unknown>>;

const STUB_MESSAGE =
  'KubernetesRenderFarmAdapter is not implemented; pick a vendor (see docs/ops/render-farm-vendors.md) and ship the adapter.';

export class KubernetesRenderFarmAdapter implements RenderFarmAdapter {
  readonly vendor = 'k8s';
  readonly capabilities: RenderFarmCapabilities = {
    streamingLogs: false,
    gpuTypes: ['cpu-only'],
    fastScaleUp: false,
    // 0 explicitly signals "not deployed" (T-266 AC #11). Production must
    // surface this to operators rather than silently no-op'ing submissions.
    maxConcurrentJobs: 0,
  };

  // The config is captured but never read — keeping it on the instance lets
  // the eventual implementation read its own config without a constructor
  // signature change.
  readonly #config: KubernetesAdapterConfig;

  constructor(config: KubernetesAdapterConfig = {}) {
    this.#config = config;
  }

  /** Read the captured config. Used by tests; not part of the public contract. */
  getConfig(): KubernetesAdapterConfig {
    return this.#config;
  }

  submitJob(_job: RenderFarmJob): Promise<{ readonly jobId: string }> {
    return Promise.reject(new NotImplementedError(STUB_MESSAGE));
  }

  cancelJob(_jobId: string): Promise<void> {
    return Promise.reject(new NotImplementedError(STUB_MESSAGE));
  }

  getJobStatus(_jobId: string): Promise<RenderFarmJobStatus> {
    return Promise.reject(new NotImplementedError(STUB_MESSAGE));
  }

  // biome-ignore lint/correctness/useYield: stub throws before any yield is reachable
  async *streamLogs(_jobId: string, _opts?: StreamLogsOptions): AsyncIterable<string> {
    throw new NotImplementedError(STUB_MESSAGE);
  }
}
