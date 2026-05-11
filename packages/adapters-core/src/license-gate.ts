// packages/adapters-core/src/license-gate.ts
// `LicenseGate` — pluggable predicate that gates adapter selection by
// tenant license posture. Per ADR-007 §D3 + CLAUDE.md §3 + THIRD_PARTY.md.
//
// The default implementation enforces the matrix below. Hosts MAY supply
// a custom gate (e.g., for early-access tenants with bespoke postures);
// the routing engine (T-425) accepts whatever `LicenseGate` implementation
// the host shell wires in.
//
// `gpl-incompatible` is refused under EVERY posture — preserves the
// CLAUDE.md §3 / `pnpm check-licenses` whitelist invariant. `proprietary-byo`
// returns `'requires-consent'` when the tenant has not declared the
// credential present (caller-owned semantics — `TenantContext.credentials`
// is keyed by `adapter.id`).

import type { AdapterDescriptor, AdapterLicenseKind } from './adapter-descriptor.js';

/**
 * Tenant license posture. Lives at `TenantSettings.features.licensePosture`
 * per ADR-007 §D3 / T-411a's `TenantSettingsStore` facet.
 *
 * - `apache-2.0-only`  — strictest; only `apache-2.0` adapters.
 * - `permissive-only`  — `apache-2.0` + `mit` + `cc-by`.
 * - `permit-byo`       — adds `proprietary-byo` (credentials required).
 * - `permit-vendored`  — adds `proprietary-vendored`.
 * - `permit-all`       — every non-GPL posture.
 */
export type TenantLicensePosture =
  | 'apache-2.0-only'
  | 'permissive-only'
  | 'permit-byo'
  | 'permit-vendored'
  | 'permit-all';

/** Every tenant license posture, frozen. */
export const TENANT_LICENSE_POSTURES = [
  'apache-2.0-only',
  'permissive-only',
  'permit-byo',
  'permit-vendored',
  'permit-all',
] as const satisfies readonly TenantLicensePosture[];

/**
 * Tenant context the license gate consults. `credentials` is a set of
 * adapter ids for which the tenant has declared credentials present —
 * this is caller-owned semantics (the storage of credentials themselves
 * lives outside adapters-core, per CLAUDE.md "no secrets in package").
 */
export interface TenantContext {
  readonly licensePosture: TenantLicensePosture;
  readonly credentials?: ReadonlySet<string>;
}

/**
 * License-gate decision.
 *
 * - `allow`             — adapter passes; routing engine may rank it.
 * - `deny`              — adapter rejected; routing engine excludes it.
 * - `requires-consent`  — adapter requires tenant action (e.g., supply a
 *                         credential). Routing engine surfaces this as
 *                         `LF-ADAPTER-CREDENTIAL-MISSING` per ADR-007 §D11.
 */
export type LicenseGateDecision = 'allow' | 'deny' | 'requires-consent';

/**
 * Pluggable license-gate predicate. The default impl matches ADR-007 §D3 +
 * THIRD_PARTY.md whitelist; hosts may supply their own.
 */
export interface LicenseGate {
  evaluate(adapter: AdapterDescriptor, tenant: TenantContext): LicenseGateDecision;
}

/**
 * Postures (in increasing order of permissiveness) that admit each license
 * kind. Lookup table sourced verbatim from ADR-007 §D3 + the matrix in
 * `docs/tasks/T-418.md`. `gpl-incompatible` is absent — it is refused
 * unconditionally below.
 */
const ADMISSION: Readonly<
  Record<Exclude<AdapterLicenseKind, 'gpl-incompatible'>, ReadonlySet<TenantLicensePosture>>
> = {
  'apache-2.0': new Set([
    'apache-2.0-only',
    'permissive-only',
    'permit-byo',
    'permit-vendored',
    'permit-all',
  ]),
  mit: new Set(['permissive-only', 'permit-byo', 'permit-vendored', 'permit-all']),
  'cc-by': new Set(['permissive-only', 'permit-byo', 'permit-vendored', 'permit-all']),
  'proprietary-byo': new Set(['permit-byo', 'permit-vendored', 'permit-all']),
  'proprietary-vendored': new Set(['permit-vendored', 'permit-all']),
};

/**
 * Default license-gate implementation. Enforces ADR-007 §D3 + THIRD_PARTY.md
 * whitelist. `gpl-incompatible` always denied. `proprietary-byo` returns
 * `'requires-consent'` when the tenant lacks credentials for the adapter id.
 */
export const defaultLicenseGate: LicenseGate = {
  evaluate(adapter, tenant) {
    const license = adapter.license.kind;
    if (license === 'gpl-incompatible') return 'deny';

    const admissibleFor = ADMISSION[license];
    if (!admissibleFor.has(tenant.licensePosture)) {
      return 'deny';
    }
    if (license === 'proprietary-byo') {
      const credentials = tenant.credentials;
      if (credentials === undefined || !credentials.has(adapter.id)) {
        return 'requires-consent';
      }
    }
    return 'allow';
  },
};
