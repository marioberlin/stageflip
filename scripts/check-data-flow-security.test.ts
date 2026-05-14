// scripts/check-data-flow-security.test.ts
// Unit tests for the T-446 check-data-flow-security CI gate. The
// consistency check is pure; tests drive synthetic descriptor + manifest
// pairs and assert the verdict shape. An additional integration test
// runs `main` against the real `packages/` tree to verify the inaugural
// 9-adapter state passes end-to-end.
//
// R-17 closure (2026-05-15): the gate now ALSO discovers + validates
// the 5 Phase 13 frontier-clip provider seams. Tests exercise the
// frontier-clip discovery + extraction code paths against a tmpdir
// fixture (happy path + MISSING / PARSE-ERROR / INVALID).

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  parseAdapterDescriptor,
  type AdapterDescriptor,
  type SecurityManifest,
} from '../packages/adapters-core/src/index.js';

import {
  buildReport,
  checkManifestDescriptorConsistency,
  discoverFrontierClipSeams,
  extractFromFrontierClipSeam,
  formatReport,
  FRONTIER_CLIP_FAMILIES_REQUIRING_MANIFEST,
  isAdapterPackageName,
  main,
} from './check-data-flow-security.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDescriptor(overrides: {
  readonly id?: string;
  readonly sandbox?: AdapterDescriptor['sandbox'];
}): AdapterDescriptor {
  return parseAdapterDescriptor({
    id: overrides.id ?? 'synthetic',
    modality: { kind: 'tts' },
    capability: {},
    license: { kind: 'apache-2.0' },
    sandbox: overrides.sandbox ?? { kind: 'in-process' },
  });
}

const inProcessManifest: SecurityManifest = {
  adapterId: 'synthetic',
  perimeter: 'in-process',
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
    retentionPolicy: 'tenant-controlled',
  },
  auditSignal: {
    relevantAuditEvents: ['start', 'complete', 'failed'],
    relevantUsageFields: ['tenantId', 'adapterId', 'modality', 'latencyMs', 'outcome', 'timestamp'],
  },
  lastReviewedAt: '2026-05-11',
};

const remoteManifest: SecurityManifest = {
  adapterId: 'remote-synthetic',
  perimeter: 'remote-network',
  dataLeavingPerimeter: {
    prompt: true,
    inputBytes: true,
    tenantId: false,
    cacheKey: false,
  },
  pii: { voiceClone: false, userContent: true },
  networkEndpoint: {
    hostname: 'api.example.com',
    protocol: 'https',
    authMethod: 'bearer-token',
  },
  dataRetention: {
    providerRetainsInput: true,
    providerRetainsOutput: true,
    retentionPolicy: 'provider-default',
  },
  auditSignal: {
    relevantAuditEvents: ['start', 'complete', 'failed'],
    relevantUsageFields: [
      'tenantId',
      'adapterId',
      'modality',
      'latencyMs',
      'costAmount',
      'outcome',
      'timestamp',
    ],
  },
  lastReviewedAt: '2026-05-11',
};

// ---------------------------------------------------------------------------
// isAdapterPackageName
// ---------------------------------------------------------------------------

describe('isAdapterPackageName', () => {
  it('accepts @stageflip/tts-* names', () => {
    expect(isAdapterPackageName('@stageflip/tts-kokoro')).toBe(true);
  });

  it('accepts @stageflip/3d-* names', () => {
    expect(isAdapterPackageName('@stageflip/3d-tripo')).toBe(true);
  });

  it('rejects unscoped names', () => {
    expect(isAdapterPackageName('tts-kokoro')).toBe(false);
  });

  it('rejects non-adapter @stageflip packages', () => {
    expect(isAdapterPackageName('@stageflip/schema')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkManifestDescriptorConsistency — pure
// ---------------------------------------------------------------------------

describe('checkManifestDescriptorConsistency — in-process', () => {
  it('passes when manifest + descriptor agree', () => {
    const descriptor = makeDescriptor({ id: 'synthetic', sandbox: { kind: 'in-process' } });
    const issues = checkManifestDescriptorConsistency(inProcessManifest, descriptor, 'pkg');
    expect(issues).toEqual([]);
  });

  it('fails when in-process declares dataLeavingPerimeter.prompt', () => {
    const manifest: SecurityManifest = {
      ...inProcessManifest,
      dataLeavingPerimeter: { ...inProcessManifest.dataLeavingPerimeter, prompt: true },
    };
    const descriptor = makeDescriptor({ id: 'synthetic', sandbox: { kind: 'in-process' } });
    const issues = checkManifestDescriptorConsistency(manifest, descriptor, 'pkg');
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.cause).toMatch(/must not declare any dataLeavingPerimeter/);
  });

  it('fails when in-process declares networkEndpoint', () => {
    const manifest: SecurityManifest = {
      ...inProcessManifest,
      networkEndpoint: {
        hostname: 'example.com',
        protocol: 'https',
        authMethod: 'bearer-token',
      },
    };
    const descriptor = makeDescriptor({ id: 'synthetic', sandbox: { kind: 'in-process' } });
    const issues = checkManifestDescriptorConsistency(manifest, descriptor, 'pkg');
    expect(issues.some((i) => i.cause.includes('must not declare a networkEndpoint'))).toBe(true);
  });
});

describe('checkManifestDescriptorConsistency — sidecar', () => {
  it('passes when manifest declares sidecar-local + no networkEndpoint', () => {
    const manifest: SecurityManifest = { ...inProcessManifest, perimeter: 'sidecar-local' };
    const descriptor = makeDescriptor({
      id: 'synthetic',
      sandbox: { kind: 'sidecar', runtime: 'python' },
    });
    const issues = checkManifestDescriptorConsistency(manifest, descriptor, 'pkg');
    expect(issues).toEqual([]);
  });

  it('fails when sidecar adapter declares perimeter=in-process', () => {
    const descriptor = makeDescriptor({
      id: 'synthetic',
      sandbox: { kind: 'sidecar', runtime: 'python' },
    });
    const issues = checkManifestDescriptorConsistency(inProcessManifest, descriptor, 'pkg');
    expect(
      issues.some((i) => i.cause.includes("requires manifest.perimeter='sidecar-local'")),
    ).toBe(true);
  });
});

describe('checkManifestDescriptorConsistency — remote-service', () => {
  it('passes when manifest declares remote-network + networkEndpoint', () => {
    const descriptor = makeDescriptor({
      id: 'remote-synthetic',
      sandbox: { kind: 'remote-service', baseUrlEnvVar: 'X_API_BASE_URL' },
    });
    const issues = checkManifestDescriptorConsistency(remoteManifest, descriptor, 'pkg');
    expect(issues).toEqual([]);
  });

  it('fails when manifest perimeter !== remote-network', () => {
    const manifest: SecurityManifest = { ...remoteManifest, perimeter: 'in-process' };
    const descriptor = makeDescriptor({
      id: 'remote-synthetic',
      sandbox: { kind: 'remote-service', baseUrlEnvVar: 'X_API_BASE_URL' },
    });
    // Note: a real such manifest would be rejected at Zod parse (networkEndpoint
    // forbidden when perimeter !== 'remote-network'). The consistency check runs
    // strictly after Zod parse; we exercise it here on a hand-constructed value
    // to ensure both layers cooperatively catch mismatch.
    const handBuilt: SecurityManifest = { ...manifest };
    delete (handBuilt as { networkEndpoint?: unknown }).networkEndpoint;
    const issues = checkManifestDescriptorConsistency(handBuilt, descriptor, 'pkg');
    expect(
      issues.some((i) => i.cause.includes("requires manifest.perimeter='remote-network'")),
    ).toBe(true);
  });
});

describe('checkManifestDescriptorConsistency — adapterId mismatch', () => {
  it('flags when manifest.adapterId !== descriptor.id', () => {
    const descriptor = makeDescriptor({ id: 'other-id', sandbox: { kind: 'in-process' } });
    const issues = checkManifestDescriptorConsistency(inProcessManifest, descriptor, 'pkg');
    expect(issues.some((i) => i.cause.includes('does not match descriptor.id'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildReport + formatReport
// ---------------------------------------------------------------------------

describe('buildReport', () => {
  it('returns exit 0 for empty input', () => {
    const report = buildReport([], []);
    expect(report.exitCode).toBe(0);
    expect(report.rows).toEqual([]);
  });

  it('returns exit 0 for matched manifest+descriptor pair', () => {
    const descriptor = makeDescriptor({ id: 'synthetic', sandbox: { kind: 'in-process' } });
    const report = buildReport(
      [{ name: '@stageflip/tts-synthetic', dir: '/tmp/x' }],
      [{ manifest: inProcessManifest, descriptors: [descriptor], errors: [] }],
    );
    expect(report.exitCode).toBe(0);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.verdict).toBe('PASS');
  });

  it('returns exit 1 when manifest missing', () => {
    const descriptor = makeDescriptor({ id: 'synthetic', sandbox: { kind: 'in-process' } });
    const report = buildReport(
      [{ name: '@stageflip/tts-synthetic', dir: '/tmp/x' }],
      [
        {
          manifest: undefined,
          descriptors: [descriptor],
          errors: [
            {
              source: '@stageflip/tts-synthetic',
              kind: 'MISSING',
              cause: 'expected security.json',
            },
          ],
        },
      ],
    );
    expect(report.exitCode).toBe(1);
    expect(report.errors.some((e) => e.kind === 'MISSING')).toBe(true);
  });
});

describe('formatReport', () => {
  it('emits PASS when exitCode is 0', () => {
    const out = formatReport({
      packagesInspected: 0,
      frontierClipSeamsInspected: 0,
      rows: [],
      errors: [],
      inconsistencies: [],
      exitCode: 0,
    });
    expect(out).toContain('check-data-flow-security: PASS');
  });

  it('emits FAIL when exitCode is 1', () => {
    const out = formatReport({
      packagesInspected: 1,
      frontierClipSeamsInspected: 0,
      rows: [],
      errors: [{ source: 'pkg', kind: 'MISSING', cause: 'missing security.json' }],
      inconsistencies: [],
      exitCode: 1,
    });
    expect(out).toContain('check-data-flow-security: FAIL');
    expect(out).toContain('MISSING');
  });
});

// ---------------------------------------------------------------------------
// Integration — real workspace
// ---------------------------------------------------------------------------

describe('main — real workspace (inaugural 9-adapter state)', () => {
  it('exits 0 against packages/', async () => {
    const code = await main();
    expect(code).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Frontier-clip seam discovery + extraction (R-17)
// ---------------------------------------------------------------------------

const validFrontierManifest = {
  adapterId: 'frontier-clip-voice',
  perimeter: 'remote-network',
  dataLeavingPerimeter: {
    prompt: false,
    inputBytes: true,
    tenantId: true,
    cacheKey: false,
  },
  pii: { voiceClone: false, userContent: true },
  networkEndpoint: {
    hostname: 'host-injected.transcription-provider.local',
    protocol: 'https',
    authMethod: 'api-key-header',
  },
  dataRetention: {
    providerRetainsInput: false,
    providerRetainsOutput: false,
    retentionPolicy: 'tenant-controlled',
  },
  auditSignal: {
    relevantAuditEvents: ['start', 'complete', 'failed'],
    relevantUsageFields: ['tenantId', 'adapterId', 'modality', 'outcome', 'timestamp'],
  },
  lastReviewedAt: '2026-05-15',
};

describe('FRONTIER_CLIP_FAMILIES_REQUIRING_MANIFEST', () => {
  it('lists exactly the 5 Phase 13 frontier-clip families (R-17)', () => {
    expect([...FRONTIER_CLIP_FAMILIES_REQUIRING_MANIFEST].sort()).toEqual([
      'ai-chat',
      'ai-generative',
      'live-data',
      'voice',
      'web-embed',
    ]);
  });
});

describe('discoverFrontierClipSeams', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'frontier-clip-seam-disc-'));
  });

  it('returns empty when no clip family directories exist', () => {
    const seams = discoverFrontierClipSeams(tmp);
    expect(seams).toEqual([]);
  });

  it('discovers each family that has a directory; skips missing families', () => {
    mkdirSync(join(tmp, 'voice'));
    mkdirSync(join(tmp, 'ai-chat'));
    const seams = discoverFrontierClipSeams(tmp);
    expect(seams.map((s) => s.family).sort()).toEqual(['ai-chat', 'voice']);
    expect(seams.every((s) => s.tag.startsWith('frontier-clip:'))).toBe(true);
  });

  it('returns deterministic alphabetical order', () => {
    for (const family of FRONTIER_CLIP_FAMILIES_REQUIRING_MANIFEST) {
      mkdirSync(join(tmp, family));
    }
    const seams = discoverFrontierClipSeams(tmp);
    expect(seams.map((s) => s.family)).toEqual([
      'ai-chat',
      'ai-generative',
      'live-data',
      'voice',
      'web-embed',
    ]);
  });
});

describe('extractFromFrontierClipSeam', () => {
  let tmp: string;
  let seamDir: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'frontier-clip-seam-ext-'));
    seamDir = join(tmp, 'voice');
    mkdirSync(seamDir);
  });

  it('returns the parsed manifest on a valid security.json', () => {
    writeFileSync(join(seamDir, 'security.json'), JSON.stringify(validFrontierManifest));
    const result = extractFromFrontierClipSeam({
      family: 'voice',
      tag: 'frontier-clip:voice',
      dir: seamDir,
    });
    expect(result.errors).toEqual([]);
    expect(result.manifest?.adapterId).toBe('frontier-clip-voice');
  });

  it('emits MISSING when security.json is absent', () => {
    const result = extractFromFrontierClipSeam({
      family: 'voice',
      tag: 'frontier-clip:voice',
      dir: seamDir,
    });
    expect(result.manifest).toBeUndefined();
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]?.kind).toBe('MISSING');
    expect(result.errors[0]?.source).toBe('frontier-clip:voice');
  });

  it('emits PARSE-ERROR when security.json is malformed JSON', () => {
    writeFileSync(join(seamDir, 'security.json'), '{not json');
    const result = extractFromFrontierClipSeam({
      family: 'voice',
      tag: 'frontier-clip:voice',
      dir: seamDir,
    });
    expect(result.manifest).toBeUndefined();
    expect(result.errors.some((e) => e.kind === 'PARSE-ERROR')).toBe(true);
  });

  it('emits INVALID when JSON parses but fails Zod schema', () => {
    const broken = { ...validFrontierManifest, perimeter: 'not-a-valid-perimeter' };
    writeFileSync(join(seamDir, 'security.json'), JSON.stringify(broken));
    const result = extractFromFrontierClipSeam({
      family: 'voice',
      tag: 'frontier-clip:voice',
      dir: seamDir,
    });
    expect(result.manifest).toBeUndefined();
    expect(result.errors.some((e) => e.kind === 'INVALID')).toBe(true);
  });
});

describe('buildReport — frontier-clip seams (R-17)', () => {
  it('records a PASS row for each valid frontier-clip seam', () => {
    const manifest: SecurityManifest = validFrontierManifest as SecurityManifest;
    const report = buildReport(
      [],
      [],
      [{ family: 'voice', tag: 'frontier-clip:voice', dir: '/tmp/x' }],
      [{ manifest, errors: [] }],
    );
    expect(report.exitCode).toBe(0);
    expect(report.frontierClipSeamsInspected).toBe(1);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.verdict).toBe('PASS');
    expect(report.rows[0]?.packageName).toBe('frontier-clip:voice');
  });

  it('records a FAIL row + propagates MISSING error when seam manifest absent', () => {
    const report = buildReport(
      [],
      [],
      [{ family: 'voice', tag: 'frontier-clip:voice', dir: '/tmp/x' }],
      [
        {
          manifest: undefined,
          errors: [
            {
              source: 'frontier-clip:voice',
              kind: 'MISSING',
              cause: 'expected security.json',
            },
          ],
        },
      ],
    );
    expect(report.exitCode).toBe(1);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.verdict).toBe('FAIL');
    expect(report.errors.some((e) => e.kind === 'MISSING')).toBe(true);
  });

  it('keeps adapter + frontier-clip coverage independently visible in formatReport', () => {
    const manifest: SecurityManifest = validFrontierManifest as SecurityManifest;
    const report = buildReport(
      [],
      [],
      [{ family: 'voice', tag: 'frontier-clip:voice', dir: '/tmp/x' }],
      [{ manifest, errors: [] }],
    );
    const out = formatReport(report);
    expect(out).toMatch(/0 adapter packages inspected/);
    expect(out).toMatch(/1 frontier-clip seam inspected \(R-17\)/);
  });
});

describe('main — real workspace (frontier-clip seams included)', () => {
  it('still exits 0 with the 5 frontier-clip seam manifests in place (regression)', async () => {
    const code = await main();
    expect(code).toBe(0);
  });
});
