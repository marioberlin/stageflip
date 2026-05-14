// packages/on-device-player-packaging/src/update-channel.ts
// Update-channel descriptor schema + resolver (T-400). Describes HOW the
// binary discovers updates; the actual update server is a downstream
// concern (out of scope for T-400). Three channels: `stable`, `beta`,
// `canary`. `rolloutPercentage` is optional — the server is free to
// stage rollout but the descriptor records the device's expected
// rollout cohort for diagnostic correlation.

import { z } from 'zod';

/**
 * Schema for the update-channel descriptor embedded inside
 * `OnDeviceBinaryManifest.updateChannel`. The `publisherKeyId` refs the
 * publisher-key registry from `@stageflip/pack-signing` (TOFU pattern
 * mirrored — see `docs/security-review-track-a.md` R-11).
 */
export const updateChannelDescriptorSchema = z
  .object({
    channel: z.enum(['stable', 'beta', 'canary']),
    endpoint: z.string().url(),
    publisherKeyId: z.string().min(1),
    pollIntervalSec: z.number().int().min(60).max(86400),
    rolloutPercentage: z.number().min(0).max(100).optional(),
  })
  .strict();

export type UpdateChannelDescriptor = z.infer<typeof updateChannelDescriptorSchema>;

/** Result of a single update-discovery call. */
export interface UpdateAvailability {
  readonly hasUpdate: boolean;
  readonly latestVersion: string;
  readonly downloadUrl?: string;
}

/**
 * Arguments for `resolveUpdate`. In production, callers omit `fetcher`
 * and a default `fetch`-backed implementation is used (NOT implemented
 * in this scaffold — see comment below). In tests, callers inject a
 * stub fetcher.
 */
export interface ResolveUpdateArgs {
  readonly descriptor: UpdateChannelDescriptor;
  readonly currentVersion: string;
  readonly fetcher?: (url: string) => Promise<{ version: string; downloadUrl: string } | null>;
}

/**
 * Discover whether an update is available on the configured channel.
 *
 * Calls `descriptor.endpoint + '?current=<version>'`; the server is
 * expected to return `{ version, downloadUrl }` for the latest available
 * artifact on the channel, or `null` to indicate "no update available"
 * (or the device is already at the latest version).
 *
 * Comparison is exact-string for now (`hasUpdate` is true iff `version
 * !== currentVersion`). A future revision will use the workspace's
 * semver helpers once the binary's release cadence demands it.
 */
export async function resolveUpdate(args: ResolveUpdateArgs): Promise<UpdateAvailability> {
  const fetcher = args.fetcher ?? defaultFetcher;
  const url = `${args.descriptor.endpoint}?current=${encodeURIComponent(args.currentVersion)}`;
  const result = await fetcher(url);
  if (result === null) {
    return { hasUpdate: false, latestVersion: args.currentVersion };
  }
  const hasUpdate = result.version !== args.currentVersion;
  return hasUpdate
    ? { hasUpdate: true, latestVersion: result.version, downloadUrl: result.downloadUrl }
    : { hasUpdate: false, latestVersion: result.version };
}

/**
 * Default fetcher placeholder. Production builds wire the real
 * implementation via the device's HTTP stack (Node `undici`,
 * platform-specific TLS, etc.). The scaffold throws so production
 * callers MUST inject a fetcher explicitly; tests inject stubs and
 * never reach this path.
 */
async function defaultFetcher(
  _url: string,
): Promise<{ version: string; downloadUrl: string } | null> {
  throw new Error(
    'resolveUpdate: no fetcher injected and default fetcher is not wired in this scaffold. The on-device binary build pipeline must supply one. See T-400 ADR-005 §D4.',
  );
}
