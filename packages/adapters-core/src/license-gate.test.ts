// packages/adapters-core/src/license-gate.test.ts
// defaultLicenseGate tests — full matrix of (license × posture) outcomes,
// gpl-incompatible refused unconditionally, proprietary-byo
// requires-consent when credentials absent.

import { describe, expect, it } from 'vitest';

import type { AdapterDescriptor, AdapterLicenseKind } from './adapter-descriptor.js';
import {
  type LicenseGateDecision,
  TENANT_LICENSE_POSTURES,
  type TenantContext,
  type TenantLicensePosture,
  defaultLicenseGate,
} from './license-gate.js';

function makeAdapter(license: AdapterLicenseKind, id = 'stub'): AdapterDescriptor {
  return {
    id,
    modality: { kind: 'tts' },
    capability: {},
    license: { kind: license },
    sandbox: { kind: 'in-process' },
  };
}

function tenant(posture: TenantLicensePosture, credentials?: ReadonlySet<string>): TenantContext {
  return credentials !== undefined
    ? { licensePosture: posture, credentials }
    : { licensePosture: posture };
}

// Expected matrix, hand-derived from ADR-007 §D3 + THIRD_PARTY.md.
// For `proprietary-byo`, "allow" is the credential-present outcome;
// the credential-missing case is tested separately as `requires-consent`.
const MATRIX: Readonly<
  Record<AdapterLicenseKind, Readonly<Record<TenantLicensePosture, LicenseGateDecision>>>
> = {
  'apache-2.0': {
    'apache-2.0-only': 'allow',
    'permissive-only': 'allow',
    'permit-byo': 'allow',
    'permit-vendored': 'allow',
    'permit-all': 'allow',
  },
  mit: {
    'apache-2.0-only': 'deny',
    'permissive-only': 'allow',
    'permit-byo': 'allow',
    'permit-vendored': 'allow',
    'permit-all': 'allow',
  },
  'cc-by': {
    'apache-2.0-only': 'deny',
    'permissive-only': 'allow',
    'permit-byo': 'allow',
    'permit-vendored': 'allow',
    'permit-all': 'allow',
  },
  'proprietary-byo': {
    'apache-2.0-only': 'deny',
    'permissive-only': 'deny',
    'permit-byo': 'allow',
    'permit-vendored': 'allow',
    'permit-all': 'allow',
  },
  'proprietary-vendored': {
    'apache-2.0-only': 'deny',
    'permissive-only': 'deny',
    'permit-byo': 'deny',
    'permit-vendored': 'allow',
    'permit-all': 'allow',
  },
  'gpl-incompatible': {
    'apache-2.0-only': 'deny',
    'permissive-only': 'deny',
    'permit-byo': 'deny',
    'permit-vendored': 'deny',
    'permit-all': 'deny',
  },
};

describe('defaultLicenseGate', () => {
  it('matches the ADR-007 §D3 matrix for every (license × posture)', () => {
    const adapterId = 'gated-adapter';
    const creds = new Set([adapterId]);
    for (const [license, perPosture] of Object.entries(MATRIX) as [
      AdapterLicenseKind,
      Record<TenantLicensePosture, LicenseGateDecision>,
    ][]) {
      for (const posture of TENANT_LICENSE_POSTURES) {
        const expected = perPosture[posture];
        const adapter = makeAdapter(license, adapterId);
        const decision = defaultLicenseGate.evaluate(adapter, tenant(posture, creds));
        expect({ license, posture, decision }).toEqual({ license, posture, decision: expected });
      }
    }
  });

  it('refuses gpl-incompatible under every posture (unconditional)', () => {
    const adapter = makeAdapter('gpl-incompatible');
    for (const posture of TENANT_LICENSE_POSTURES) {
      expect(defaultLicenseGate.evaluate(adapter, tenant(posture))).toBe('deny');
      expect(defaultLicenseGate.evaluate(adapter, tenant(posture, new Set([adapter.id])))).toBe(
        'deny',
      );
    }
  });

  it('returns requires-consent for proprietary-byo when credentials absent', () => {
    const adapter = makeAdapter('proprietary-byo', 'paywall');
    for (const posture of [
      'permit-byo',
      'permit-vendored',
      'permit-all',
    ] as TenantLicensePosture[]) {
      expect(defaultLicenseGate.evaluate(adapter, tenant(posture))).toBe('requires-consent');
      expect(defaultLicenseGate.evaluate(adapter, tenant(posture, new Set()))).toBe(
        'requires-consent',
      );
      expect(
        defaultLicenseGate.evaluate(adapter, tenant(posture, new Set(['some-other-adapter']))),
      ).toBe('requires-consent');
    }
  });

  it('proprietary-byo with credentials present resolves to allow under permissive postures', () => {
    const adapter = makeAdapter('proprietary-byo', 'paywall');
    const creds = new Set([adapter.id]);
    expect(defaultLicenseGate.evaluate(adapter, tenant('permit-byo', creds))).toBe('allow');
    expect(defaultLicenseGate.evaluate(adapter, tenant('permit-vendored', creds))).toBe('allow');
    expect(defaultLicenseGate.evaluate(adapter, tenant('permit-all', creds))).toBe('allow');
  });

  it('proprietary-byo still denied under apache-2.0-only / permissive-only even with credentials', () => {
    const adapter = makeAdapter('proprietary-byo', 'paywall');
    const creds = new Set([adapter.id]);
    expect(defaultLicenseGate.evaluate(adapter, tenant('apache-2.0-only', creds))).toBe('deny');
    expect(defaultLicenseGate.evaluate(adapter, tenant('permissive-only', creds))).toBe('deny');
  });
});
