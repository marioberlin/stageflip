// packages/adapters-core/src/adapter-descriptor.test.ts
// AdapterDescriptor schema tests — round-trip every modality, license,
// sandbox kind; reject malformed shapes; enforce kebab-case id.

import { describe, expect, it } from 'vitest';

import {
  ADAPTER_LICENSE_KINDS,
  ADAPTER_MODALITY_KINDS,
  type AdapterDescriptor,
  SANDBOX_KINDS,
  adapterDescriptorSchema,
  parseAdapterDescriptor,
} from './adapter-descriptor.js';

const baseDescriptor: AdapterDescriptor = {
  id: 'kokoro-tts',
  modality: { kind: 'tts' },
  capability: { sampleRate: 24000 },
  license: { kind: 'apache-2.0' },
  sandbox: { kind: 'in-process' },
};

describe('adapterDescriptorSchema', () => {
  it('parses a minimal descriptor', () => {
    const parsed = adapterDescriptorSchema.parse(baseDescriptor);
    expect(parsed).toEqual(baseDescriptor);
  });

  it('round-trips every modality kind', () => {
    expect(ADAPTER_MODALITY_KINDS).toHaveLength(15);
    for (const kind of ADAPTER_MODALITY_KINDS) {
      const candidate: AdapterDescriptor = {
        ...baseDescriptor,
        id: `${kind}-stub`,
        modality: { kind },
      };
      const parsed = parseAdapterDescriptor(candidate);
      expect(parsed.modality.kind).toBe(kind);
    }
  });

  it('round-trips every license posture', () => {
    expect(ADAPTER_LICENSE_KINDS).toHaveLength(6);
    for (const kind of ADAPTER_LICENSE_KINDS) {
      const candidate: AdapterDescriptor = { ...baseDescriptor, license: { kind } };
      const parsed = parseAdapterDescriptor(candidate);
      expect(parsed.license.kind).toBe(kind);
    }
  });

  it('round-trips every sandbox kind', () => {
    expect(SANDBOX_KINDS).toHaveLength(4);
    const sandboxes: AdapterDescriptor['sandbox'][] = [
      { kind: 'in-process' },
      { kind: 'sidecar', runtime: 'node' },
      { kind: 'sidecar', runtime: 'python' },
      { kind: 'remote-service', baseUrlEnvVar: 'KOKORO_BASE_URL' },
      { kind: 'wasm-sandbox' },
    ];
    for (const sandbox of sandboxes) {
      const candidate: AdapterDescriptor = { ...baseDescriptor, sandbox };
      const parsed = parseAdapterDescriptor(candidate);
      expect(parsed.sandbox).toEqual(sandbox);
    }
  });

  it('round-trips full descriptor with cost / latency / sourceGrounded / requiresResearchProvider', () => {
    const candidate: AdapterDescriptor = {
      id: 'notebooklm-summarizer',
      modality: { kind: 'report-gen' },
      capability: { maxTokens: 4096 },
      license: { kind: 'proprietary-byo' },
      sandbox: { kind: 'remote-service', baseUrlEnvVar: 'NLM_BASE_URL' },
      costPerCall: { usd: 0.05, tokensIn: 2000, tokensOut: 500 },
      latencyMs: { p50: 1800, p95: 4200 },
      sourceGrounded: true,
      requiresResearchProvider: 'notebooklm',
    };
    const parsed = parseAdapterDescriptor(candidate);
    expect(parsed).toEqual(candidate);
  });

  it('rejects unknown top-level keys (strict)', () => {
    expect(() =>
      // @ts-expect-error intentional unknown key for negative test
      parseAdapterDescriptor({ ...baseDescriptor, extraField: 'nope' }),
    ).toThrow();
  });

  it('rejects non-kebab-case ids', () => {
    for (const badId of [
      'Kokoro-TTS',
      'kokoro_tts',
      'kokoro tts',
      'KOKORO',
      '-leading',
      'trailing-',
      'double--hyphen',
    ]) {
      expect(() => parseAdapterDescriptor({ ...baseDescriptor, id: badId })).toThrow();
    }
  });

  it('accepts kebab-case ids', () => {
    for (const goodId of ['k', 'kokoro', 'kokoro-tts', 'a1', 'tier-1-pro', 'g3-fast']) {
      expect(() => parseAdapterDescriptor({ ...baseDescriptor, id: goodId })).not.toThrow();
    }
  });

  it('rejects empty id', () => {
    expect(() => parseAdapterDescriptor({ ...baseDescriptor, id: '' })).toThrow();
  });

  it('rejects unknown modality kind', () => {
    expect(() =>
      parseAdapterDescriptor({ ...baseDescriptor, modality: { kind: 'totally-fake' } }),
    ).toThrow();
  });

  it('rejects unknown license kind', () => {
    expect(() =>
      parseAdapterDescriptor({ ...baseDescriptor, license: { kind: 'agpl-3.0' } }),
    ).toThrow();
  });

  it('rejects sidecar with unknown runtime', () => {
    expect(() =>
      parseAdapterDescriptor({ ...baseDescriptor, sandbox: { kind: 'sidecar', runtime: 'go' } }),
    ).toThrow();
  });

  it('rejects remote-service with empty baseUrlEnvVar', () => {
    expect(() =>
      parseAdapterDescriptor({
        ...baseDescriptor,
        sandbox: { kind: 'remote-service', baseUrlEnvVar: '' },
      }),
    ).toThrow();
  });

  it('rejects negative cost / latency hints', () => {
    expect(() => parseAdapterDescriptor({ ...baseDescriptor, costPerCall: { usd: -1 } })).toThrow();
    expect(() => parseAdapterDescriptor({ ...baseDescriptor, latencyMs: { p50: -10 } })).toThrow();
  });

  it('accepts capability as an arbitrary record (opaque envelope)', () => {
    const candidate: AdapterDescriptor = {
      ...baseDescriptor,
      capability: { anything: 'goes', nested: { deeply: [1, 2, 3] } },
    };
    expect(() => parseAdapterDescriptor(candidate)).not.toThrow();
  });
});
