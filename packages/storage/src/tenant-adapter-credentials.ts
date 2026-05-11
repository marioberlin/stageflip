// packages/storage/src/tenant-adapter-credentials.ts
// Per-adapter credential schema (T-444). Pairs with
// `TenantSettings.adapterCredentials?` (a map of adapterId → credential)
// and is the row shape stored by `TenantAdapterCredentialsStore`.
//
// Both `apiKey` and `baseUrl` are individually optional, but at least
// one MUST be present — an empty `{}` is rejected at the schema
// boundary (the row would otherwise be meaningless).
//
// Adapter id keys are validated kebab-case (matches the
// `AdapterDescriptor.id` regex).

import { z } from 'zod';

/**
 * Single-adapter credential. The host's `SandboxFactory` injects this
 * into the runner; the runner forwards it to the adapter — scoped to
 * one `(tenantId, adapterId)` pair.
 */
export const adapterCredentialSchema = z
  .object({
    apiKey: z.string().min(1).optional(),
    baseUrl: z.string().url().optional(),
  })
  .strict()
  .refine(
    (val) => val.apiKey !== undefined || val.baseUrl !== undefined,
    'at least one of apiKey or baseUrl is required',
  );

export type AdapterCredential = z.infer<typeof adapterCredentialSchema>;

/** Kebab-case adapter id (matches `adapterDescriptorSchema.id` regex). */
export const adapterIdSchema = z
  .string()
  .min(1)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'adapterId must be kebab-case (lowercase a-z0-9, hyphen-separated)',
  );

/**
 * Map of adapter id → credential. Lives on
 * `TenantSettings.adapterCredentials?`. v1 imposes no size cap; in
 * practice each tenant has at most ~9 entries (one per reference
 * adapter that requires a credential).
 *
 * `z.record(keySchema, valueSchema)` validates each key against the
 * regex; an empty record is allowed (== no per-adapter credentials).
 */
export const adapterCredentialsMapSchema = z.record(adapterIdSchema, adapterCredentialSchema);

export type AdapterCredentialsMap = z.infer<typeof adapterCredentialsMapSchema>;
