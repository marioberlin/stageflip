// packages/schema/src/presets/frontmatter.ts
// Zod schemas for the YAML frontmatter at the head of every preset SKILL.md
// AND every cluster SKILL.md. Two distinct shapes share a directory; the
// loader distinguishes by filename (cluster = `SKILL.md`) or, equivalently,
// by the presence of `tier: 'cluster'`. See ADR-004 §D1/§D2 and T-304
// §D-T304-3 / §D-T304-5.
//
// License vocabulary is intentionally permissive (`z.string().min(1)`) per the
// 2026-04-28 Orchestrator amendment of T-304: the canonical license vocabulary
// is owned by the font-license registry (T-307, ADR-004 §D3). Top-level
// `.strict()` is preserved — typos in field NAMES still fail loud.

import { z } from 'zod';

/** Cluster names enumerated by ADR-004 §D2. The eight on-disk directories. */
export const PRESET_CLUSTERS = [
  'news',
  'sports',
  'weather',
  'titles',
  'data',
  'captions',
  'ctas',
  'ar',
] as const;
export type PresetCluster = (typeof PRESET_CLUSTERS)[number];

/**
 * Permissions a preset may declare for the interactive runtime tier.
 * Mirrors ADR-003 §D2; widening this list is a coordinated change with that
 * ADR and the runtime's permission gate.
 */
export const PRESET_PERMISSIONS = ['network', 'mic', 'camera', 'geolocation'] as const;
export type PresetPermission = (typeof PRESET_PERMISSIONS)[number];

const idSlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
  message: 'id must be a lowercase kebab-case slug (a–z, 0–9, hyphens)',
});

const fontLicenseSchema = z.string().min(1, {
  // T-307 owns the canonical license vocabulary (ADR-004 §D3). T-304 only
  // validates SHAPE: a non-empty string. Composite values like
  // 'apache-2.0 + ofl' or 'commercial-byo' must pass here.
  message: 'license must be a non-empty string',
});

const preferredFontSchema = z
  .object({
    family: z.string().min(1),
    license: fontLicenseSchema,
  })
  .strict();

const fallbackFontSchema = z
  .object({
    family: z.string().min(1),
    // weight: nonnegative (NOT positive) per T-304 amendment v2 (2026-04-28).
    // On-disk stub `ctas/coinbase-dvd-qr.md` uses `weight: 0` as a "no
    // fallback font" sentinel for text-free presets (QR-code-only).
    // T-307/T-308 own the semantic question "should text-free presets
    // declare fonts?". T-304 validates SHAPE only, accepting the sentinel.
    weight: z.number().int().nonnegative(),
    license: fontLicenseSchema,
  })
  .strict();

const signOffSchema = z
  .object({
    parityFixture: z.string().regex(/^(pending-user-review|signed:\d{4}-\d{2}-\d{2}|na)$/, {
      message: 'parityFixture must be "pending-user-review", "signed:YYYY-MM-DD", or "na"',
    }),
    typeDesign: z.string().regex(/^(pending-cluster-batch|signed:\d{4}-\d{2}-\d{2}|na)$/, {
      message: 'typeDesign must be "pending-cluster-batch", "signed:YYYY-MM-DD", or "na"',
    }),
  })
  .strict();

/**
 * Strict schema for a preset SKILL.md frontmatter block. Top-level `.strict()`
 * is the security primitive — typos in field names fail loud. Nested objects
 * (`preferredFont`, `fallbackFont`, `signOff`) are also strict for the same
 * reason.
 */
export const presetFrontmatterSchema = z
  .object({
    id: idSlugSchema,
    cluster: z.enum(PRESET_CLUSTERS),
    clipKind: z.string().min(1),
    source: z.string().min(1),
    status: z.enum(['stub', 'substantive']),
    preferredFont: preferredFontSchema,
    fallbackFont: fallbackFontSchema.optional(),
    permissions: z.array(z.enum(PRESET_PERMISSIONS)).default([]),
    signOff: signOffSchema,
  })
  .strict();

export type PresetFrontmatter = z.infer<typeof presetFrontmatterSchema>;

/**
 * Strict schema for a cluster SKILL.md frontmatter block. Disjoint from
 * `presetFrontmatterSchema`: the discriminator is filename (`SKILL.md`) at
 * loader time, but `tier: 'cluster'` makes it self-describing too.
 */
export const clusterSkillFrontmatterSchema = z
  .object({
    title: z.string().min(1),
    id: z.string().regex(/^skills\/stageflip\/presets\/[a-z]+$/, {
      message: 'cluster id must be skills/stageflip/presets/<cluster>',
    }),
    tier: z.literal('cluster'),
    status: z.enum(['stub', 'substantive']),
    last_updated: z.preprocess(
      // gray-matter + js-yaml parse unquoted YYYY-MM-DD as a JS Date. Coerce
      // back to the canonical string so downstream consumers get a stable
      // shape. (Same trick @stageflip/skills-core uses.)
      (v) =>
        v instanceof Date
          ? `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(
              v.getUTCDate(),
            ).padStart(2, '0')}`
          : v,
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'last_updated must be YYYY-MM-DD',
      }),
    ),
    owner_task: z.string().regex(/^T-\d+/, { message: 'owner_task must start with T-NNN' }),
    related: z.array(z.string()).default([]),
  })
  .strict();

export type ClusterSkillFrontmatter = z.infer<typeof clusterSkillFrontmatterSchema>;
