// packages/pack-format/src/manifest.ts
// T-494 — Zod schemas + types for the `.stageflip-pack` manifest per
// ADR-012 §D2. Strict at every layer; typos at field names fail loud
// at install time, not mysteriously at runtime.
//
// Determinism perimeter: this package lives OUTSIDE per CLAUDE.md §3
// (pack-format is loader-side; clip implementations contributed by a
// pack may be inside the perimeter, but the format itself is not).

import { z } from 'zod';

// ----------------------------------------------------------------------------
// LicenseClaim (ADR-012 §D4)
// ----------------------------------------------------------------------------

/** Permitted SPDX identifiers for open-license packs. */
export const OPEN_LICENSE_SPDX = ['MIT', 'Apache-2.0', 'CC-BY-4.0', 'CC0-1.0'] as const;
export type OpenLicenseSpdx = (typeof OPEN_LICENSE_SPDX)[number];

const openLicenseClaimSchema = z
  .object({
    kind: z.literal('open'),
    spdx: z.enum(OPEN_LICENSE_SPDX),
  })
  .strict();

const paidLicenseClaimSchema = z
  .object({
    kind: z.literal('paid-per-tenant'),
    sku: z.string().min(1),
    entitlementType: z.enum(['subscription', 'one-time']),
  })
  .strict();

const enterpriseLicenseClaimSchema = z
  .object({
    kind: z.literal('enterprise'),
    sku: z.string().min(1),
    contractRef: z.string().min(1).optional(),
  })
  .strict();

/** Discriminated union per ADR-012 §D4. */
export const licenseClaimSchema = z.discriminatedUnion('kind', [
  openLicenseClaimSchema,
  paidLicenseClaimSchema,
  enterpriseLicenseClaimSchema,
]);
export type LicenseClaim = z.infer<typeof licenseClaimSchema>;

// ----------------------------------------------------------------------------
// PackContributions (ADR-012 §D5)
// ----------------------------------------------------------------------------

const packPresetContributionSchema = z
  .object({
    id: z.string().min(1),
    cluster: z.string().min(1),
  })
  .strict();

const packClipKindContributionSchema = z
  .object({
    kind: z.string().min(1),
    module: z.string().min(1),
  })
  .strict();

const packFontContributionSchema = z
  .object({
    family: z.string().min(1),
    license: z.string().min(1),
  })
  .strict();

const packFixtureContributionSchema = z
  .object({
    id: z.string().min(1),
  })
  .strict();

const packAssetContributionSchema = z
  .object({
    path: z.string().min(1),
    mimeType: z.string().min(1),
  })
  .strict();

const packToolContributionSchema = z
  .object({
    bundleName: z.string().min(1),
    tools: z.array(z.string().min(1)).min(1),
  })
  .strict();

const packAdapterContributionSchema = z
  .object({
    id: z.string().min(1),
    modality: z.string().min(1),
  })
  .strict();

const packThemePackContributionSchema = z
  .object({
    id: z.string().min(1),
  })
  .strict();

export const packContributionsSchema = z
  .object({
    presets: z.array(packPresetContributionSchema).optional(),
    clipKinds: z.array(packClipKindContributionSchema).optional(),
    fonts: z.array(packFontContributionSchema).optional(),
    fixtures: z.array(packFixtureContributionSchema).optional(),
    assets: z.array(packAssetContributionSchema).optional(),
    tools: z.array(packToolContributionSchema).optional(),
    adapters: z.array(packAdapterContributionSchema).optional(),
    themePacks: z.array(packThemePackContributionSchema).optional(),
  })
  .strict();
export type PackContributions = z.infer<typeof packContributionsSchema>;

// ----------------------------------------------------------------------------
// Manifest (ADR-012 §D2)
// ----------------------------------------------------------------------------

const packPublisherSchema = z
  .object({
    id: z.string().min(1),
    displayName: z.string().min(1),
  })
  .strict();

const packIntegritySchema = z
  .object({
    algorithm: z.literal('sha256'),
    hash: z.string().regex(/^[0-9a-f]{64}$/, 'hash must be 64-char lowercase hex'),
  })
  .strict();

const semverRangeRegex = /^[\^~>=<*\d\s.,|-]+$/;

/**
 * Strict Zod schema for `manifest.json` per ADR-012 §D2. Required +
 * optional fields fully enumerated; unknown keys reject at parse time.
 */
export const packManifestSchema = z
  .object({
    manifestVersion: z.literal('1'),
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'id must be lowercase kebab-case'),
    name: z.string().min(1),
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?(?:\+[a-z0-9.-]+)?$/i, 'version must be semver'),
    publisher: packPublisherSchema,
    platformCompatibility: z
      .string()
      .regex(semverRangeRegex, 'platformCompatibility must be a semver range'),
    license: licenseClaimSchema,
    integrity: packIntegritySchema,
    contributes: packContributionsSchema,

    // Optional surface
    description: z.string().min(1).optional(),
    homepage: z.string().url().optional(),
    repository: z.string().url().optional(),
    keywords: z.array(z.string().min(1)).optional(),
    dependsOn: z.array(z.string().min(1)).optional(),
    requiresAdapter: z
      .array(
        z
          .object({
            id: z.string().min(1),
            modality: z.string().min(1),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export type PackManifest = z.infer<typeof packManifestSchema>;

/**
 * Parse `manifest.json` bytes (or a parsed object) and return a typed
 * `PackManifest`. Throws `PackManifestParseError` (wrapping the Zod
 * error) on rejection.
 */
export function parsePackManifest(input: unknown): PackManifest {
  const result = packManifestSchema.safeParse(input);
  if (!result.success) {
    throw new PackManifestParseError(result.error.message);
  }
  return result.data;
}

/**
 * Thrown by `parsePackManifest` when the input rejects. Carries the
 * Zod error message verbatim so consumers can surface the field-path
 * + cause to the user.
 */
export class PackManifestParseError extends Error {
  override readonly name = 'PackManifestParseError';
}
