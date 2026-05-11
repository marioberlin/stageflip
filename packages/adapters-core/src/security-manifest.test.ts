// packages/adapters-core/src/security-manifest.test.ts
// Tests for the `SecurityManifest` Zod schema (T-446). Cover happy-path
// (each of the 3 perimeter kinds), strict-mode rejection of unknown
// keys, and the `networkEndpoint`-presence cross-field invariant.

import { describe, expect, it } from 'vitest';

import {
  RELEVANT_AUDIT_EVENT_KINDS,
  RELEVANT_USAGE_FIELDS,
  SECURITY_PERIMETERS,
  parseSecurityManifest,
  securityManifestSchema,
} from './security-manifest.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const inProcessManifest = {
  adapterId: 'kokoro',
  perimeter: 'in-process' as const,
  dataLeavingPerimeter: {
    prompt: false,
    inputBytes: false,
    tenantId: false,
    cacheKey: false,
  },
  pii: { voiceClone: false, userContent: false },
  dataRetention: {
    providerRetainsInput: false,
    providerRetainsOutput: false,
    retentionPolicy: 'tenant-controlled' as const,
  },
  auditSignal: {
    relevantAuditEvents: ['start', 'complete', 'failed'] as const,
    relevantUsageFields: [
      'tenantId',
      'adapterId',
      'modality',
      'latencyMs',
      'outcome',
      'timestamp',
    ] as const,
  },
  lastReviewedAt: '2026-05-11',
};

const sidecarManifest = {
  adapterId: 'fish-speech',
  perimeter: 'sidecar-local' as const,
  dataLeavingPerimeter: {
    prompt: false,
    inputBytes: false,
    tenantId: false,
    cacheKey: false,
  },
  pii: { voiceClone: true, userContent: true },
  dataRetention: {
    providerRetainsInput: false,
    providerRetainsOutput: false,
    retentionPolicy: 'tenant-controlled' as const,
  },
  auditSignal: {
    relevantAuditEvents: ['start', 'complete', 'failed', 'killed-for-resource-limit'] as const,
    relevantUsageFields: [
      'tenantId',
      'adapterId',
      'modality',
      'latencyMs',
      'outcome',
      'timestamp',
    ] as const,
  },
  lastReviewedAt: '2026-05-11',
};

const remoteManifest = {
  adapterId: 'runway',
  perimeter: 'remote-network' as const,
  dataLeavingPerimeter: {
    prompt: true,
    inputBytes: true,
    tenantId: false,
    cacheKey: false,
  },
  pii: { voiceClone: false, userContent: true },
  networkEndpoint: {
    hostname: 'api.runwayml.com',
    protocol: 'https' as const,
    authMethod: 'bearer-token' as const,
  },
  dataRetention: {
    providerRetainsInput: true,
    providerRetainsOutput: true,
    retentionPolicy: 'provider-default' as const,
  },
  auditSignal: {
    relevantAuditEvents: ['start', 'complete', 'failed'] as const,
    relevantUsageFields: [
      'tenantId',
      'adapterId',
      'modality',
      'latencyMs',
      'costAmount',
      'outcome',
      'timestamp',
    ] as const,
  },
  lastReviewedAt: '2026-05-11',
};

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe('securityManifestSchema — happy paths', () => {
  it('accepts an in-process manifest', () => {
    const parsed = parseSecurityManifest(inProcessManifest);
    expect(parsed.perimeter).toBe('in-process');
    expect(parsed.networkEndpoint).toBeUndefined();
  });

  it('accepts a sidecar-local manifest', () => {
    const parsed = parseSecurityManifest(sidecarManifest);
    expect(parsed.perimeter).toBe('sidecar-local');
    expect(parsed.networkEndpoint).toBeUndefined();
  });

  it('accepts a remote-network manifest with networkEndpoint', () => {
    const parsed = parseSecurityManifest(remoteManifest);
    expect(parsed.perimeter).toBe('remote-network');
    expect(parsed.networkEndpoint?.hostname).toBe('api.runwayml.com');
    expect(parsed.networkEndpoint?.authMethod).toBe('bearer-token');
  });

  it('accepts a retentionDurationDays when supplied', () => {
    const withDuration = {
      ...remoteManifest,
      dataRetention: { ...remoteManifest.dataRetention, retentionDurationDays: 30 },
    };
    const parsed = parseSecurityManifest(withDuration);
    expect(parsed.dataRetention.retentionDurationDays).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Strict-mode rejection
// ---------------------------------------------------------------------------

describe('securityManifestSchema — strict-mode rejection', () => {
  it('rejects unknown top-level key', () => {
    const bad = { ...inProcessManifest, mysteryField: 'value' };
    expect(() => parseSecurityManifest(bad)).toThrow();
  });

  it('rejects unknown nested key in dataLeavingPerimeter', () => {
    const bad = {
      ...inProcessManifest,
      dataLeavingPerimeter: {
        ...inProcessManifest.dataLeavingPerimeter,
        bogus: true,
      },
    };
    expect(() => parseSecurityManifest(bad)).toThrow();
  });

  it('rejects unknown nested key in networkEndpoint', () => {
    const bad = {
      ...remoteManifest,
      networkEndpoint: { ...remoteManifest.networkEndpoint, port: 443 },
    };
    expect(() => parseSecurityManifest(bad)).toThrow();
  });

  it('rejects non-kebab adapterId', () => {
    const bad = { ...inProcessManifest, adapterId: 'BadId' };
    expect(() => parseSecurityManifest(bad)).toThrow();
  });

  it('rejects malformed lastReviewedAt', () => {
    const bad = { ...inProcessManifest, lastReviewedAt: 'May 11 2026' };
    expect(() => parseSecurityManifest(bad)).toThrow();
  });

  it('rejects empty relevantAuditEvents array', () => {
    const bad = {
      ...inProcessManifest,
      auditSignal: { ...inProcessManifest.auditSignal, relevantAuditEvents: [] },
    };
    expect(() => parseSecurityManifest(bad)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Cross-field invariant: networkEndpoint presence
// ---------------------------------------------------------------------------

describe('securityManifestSchema — networkEndpoint presence invariant', () => {
  it('rejects remote-network perimeter without networkEndpoint', () => {
    const { networkEndpoint: _omit, ...rest } = remoteManifest;
    expect(() => parseSecurityManifest(rest)).toThrow(/networkEndpoint is required/i);
  });

  it('rejects in-process perimeter with networkEndpoint present', () => {
    const bad = {
      ...inProcessManifest,
      networkEndpoint: {
        hostname: 'example.com',
        protocol: 'https' as const,
        authMethod: 'bearer-token' as const,
      },
    };
    expect(() => parseSecurityManifest(bad)).toThrow(/networkEndpoint must be absent/i);
  });

  it('rejects sidecar-local perimeter with networkEndpoint present', () => {
    const bad = {
      ...sidecarManifest,
      networkEndpoint: {
        hostname: 'example.com',
        protocol: 'https' as const,
        authMethod: 'api-key-header' as const,
      },
    };
    expect(() => parseSecurityManifest(bad)).toThrow(/networkEndpoint must be absent/i);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('SecurityManifest constants', () => {
  it('SECURITY_PERIMETERS exhausts the union', () => {
    expect(SECURITY_PERIMETERS).toEqual(['in-process', 'sidecar-local', 'remote-network']);
  });

  it('RELEVANT_AUDIT_EVENT_KINDS exhausts the union', () => {
    expect(RELEVANT_AUDIT_EVENT_KINDS).toEqual([
      'start',
      'complete',
      'failed',
      'killed-for-resource-limit',
    ]);
  });

  it('RELEVANT_USAGE_FIELDS exhausts the union', () => {
    expect(RELEVANT_USAGE_FIELDS).toEqual([
      'tenantId',
      'adapterId',
      'modality',
      'latencyMs',
      'costAmount',
      'outcome',
      'timestamp',
    ]);
  });

  it('parseSecurityManifest delegates to the schema', () => {
    expect(securityManifestSchema.safeParse(inProcessManifest).success).toBe(true);
  });
});
