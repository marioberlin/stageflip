// packages/pack-publish-cli/src/commands/publish.ts
// T-500 — `stageflip-pack-publish publish <archive-path> --registry <url>
// [--token <env-var-name>] [--publisher-key <pem-path>]` — verify the
// signature against the publisher's public key, then POST the archive
// + signature + manifest to the marketplace registry.
//
// Marketplace endpoint contract is GATED ON T-536 (marketplace registry
// lands then). In P16 β this command operates in dry-run mode (use
// `dry-run://...` for `--registry`) so the pipeline is testable today.
//
// Determinism perimeter: this package lives OUTSIDE.

import { ED25519_SIGNATURE_LENGTH, verifyPackArchive } from '@stageflip/pack-format';
import { parseArchive } from '@stageflip/pack-signing';

import type { CliPublishDependencies } from '../deps.js';

/** Result of `runPublish`. */
export interface PublishResult {
  readonly mode: 'dry-run' | 'http';
  readonly packId: string;
  readonly version: string;
  readonly url: string;
  readonly httpStatus?: number;
}

/**
 * Run the `publish` subcommand. Args: `<archive-path> --registry <url>
 * [--token <env-var-name>] [--publisher-key <pem-path>]`. Exit 0 on
 * success / dry-run, 1 on any error.
 */
export async function runPublish(
  args: readonly string[],
  deps: CliPublishDependencies,
): Promise<number> {
  let archivePath: string | undefined;
  let registryUrl: string | undefined;
  let tokenEnvVar: string | undefined;
  let publisherKeyPath: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--registry') {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) {
        deps.logger.error('stageflip-pack-publish publish: --registry requires a value');
        return 1;
      }
      registryUrl = next;
      i += 1;
      continue;
    }
    if (arg === '--token') {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) {
        deps.logger.error('stageflip-pack-publish publish: --token requires a value');
        return 1;
      }
      tokenEnvVar = next;
      i += 1;
      continue;
    }
    if (arg === '--publisher-key') {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) {
        deps.logger.error('stageflip-pack-publish publish: --publisher-key requires a value');
        return 1;
      }
      publisherKeyPath = next;
      i += 1;
      continue;
    }
    if (arg?.startsWith('--')) {
      deps.logger.error(`stageflip-pack-publish publish: unknown flag: ${arg}`);
      return 1;
    }
    if (archivePath === undefined) {
      archivePath = arg;
    } else {
      deps.logger.error(`stageflip-pack-publish publish: unexpected positional: ${arg}`);
      return 1;
    }
  }

  if (archivePath === undefined) {
    deps.logger.error('stageflip-pack-publish publish: <archive-path> is required');
    return 1;
  }
  if (registryUrl === undefined) {
    deps.logger.error('stageflip-pack-publish publish: --registry <url> is required');
    return 1;
  }

  // Validate the archive + signature files exist.
  if (!(await deps.fs.exists(archivePath))) {
    deps.logger.error(`stageflip-pack-publish publish: archive not found: ${archivePath}`);
    return 1;
  }
  const signaturePath = `${archivePath}.sig`;
  if (!(await deps.fs.exists(signaturePath))) {
    deps.logger.error(`stageflip-pack-publish publish: signature not found: ${signaturePath}`);
    return 1;
  }

  // Read archive + signature.
  const archiveBytes = await deps.fs.readFile(archivePath);
  const signature = await deps.fs.readFile(signaturePath);
  if (signature.length !== ED25519_SIGNATURE_LENGTH) {
    deps.logger.error(
      `stageflip-pack-publish publish: signature has unexpected length ${signature.length} (expected ${ED25519_SIGNATURE_LENGTH})`,
    );
    return 1;
  }

  // Parse the archive to extract the manifest.
  let manifest: ManifestShape;
  try {
    manifest = extractManifest(archiveBytes);
  } catch (err) {
    deps.logger.error(
      `stageflip-pack-publish publish: unable to read manifest from archive: ${(err as Error).message}`,
    );
    return 1;
  }

  // Verify the signature with the supplied publisher key (when provided).
  // The flag is optional in T-500 because the publisher-key registry
  // lands with the marketplace in T-536; we offer a local verify path
  // for testing the pipeline today.
  if (publisherKeyPath !== undefined) {
    if (!(await deps.fs.exists(publisherKeyPath))) {
      deps.logger.error(
        `stageflip-pack-publish publish: publisher key not found: ${publisherKeyPath}`,
      );
      return 1;
    }
    const keyBytes = await deps.fs.readFile(publisherKeyPath);
    const publicKeyPem = new TextDecoder().decode(keyBytes);
    let ok: boolean;
    try {
      ok = verifyPackArchive(archiveBytes, signature, publicKeyPem);
    } catch (err) {
      deps.logger.error(
        `stageflip-pack-publish publish: signature verification threw: ${(err as Error).message}`,
      );
      return 1;
    }
    if (!ok) {
      deps.logger.error(
        `stageflip-pack-publish publish: signature did not verify against ${publisherKeyPath}`,
      );
      return 1;
    }
  }

  const packId = String(manifest.id ?? '');
  const version = String(manifest.version ?? '');

  // Dry-run path — print intent, skip HTTP, exit 0.
  if (registryUrl.startsWith('dry-run://')) {
    deps.logger.info(`would publish ${packId}@${version} to ${registryUrl}`);
    return 0;
  }

  // Real publish — resolve token env var, POST.
  if (tokenEnvVar === undefined) {
    deps.logger.error(
      'stageflip-pack-publish publish: --token <env-var-name> is required when --registry is not dry-run://',
    );
    return 1;
  }
  const token = deps.env.get(tokenEnvVar);
  if (token === undefined || token.length === 0) {
    deps.logger.error(
      `stageflip-pack-publish publish: environment variable '${tokenEnvVar}' is not set`,
    );
    return 1;
  }

  const endpoint = `${registryUrl.replace(/\/$/, '')}/api/v1/packs`;
  const body = {
    packId,
    version,
    manifest,
    // Encode binary blobs base64 — the marketplace contract (T-536+)
    // will define the canonical wire format; for now we ship a
    // structured JSON payload that's reviewable in the dry-run mode.
    archiveBase64: toBase64(archiveBytes),
    signatureBase64: toBase64(signature),
  };
  let res: { status: number; statusText: string; bodyText: string };
  try {
    res = await deps.http.post(endpoint, body, {
      authorization: `Bearer ${token}`,
    });
  } catch (err) {
    deps.logger.error(
      `stageflip-pack-publish publish: HTTP error posting to ${endpoint}: ${(err as Error).message}`,
    );
    return 1;
  }

  if (res.status >= 200 && res.status < 300) {
    deps.logger.info(`published ${packId}@${version} to ${endpoint} (status ${res.status})`);
    return 0;
  }
  deps.logger.error(
    `stageflip-pack-publish publish: registry returned ${res.status} ${res.statusText}: ${res.bodyText}`,
  );
  return 1;
}

/** Minimal manifest shape the publish command needs. */
interface ManifestShape {
  readonly id?: string;
  readonly version?: string;
  readonly [key: string]: unknown;
}

/**
 * Pull `manifest.json` out of an in-memory archive blob. Used to
 * surface `<pack-id>@<version>` in the publish summary and to forward
 * the parsed manifest to the registry payload.
 */
function extractManifest(archiveBytes: Uint8Array): ManifestShape {
  const files = parseArchive(archiveBytes);
  const entry = files.find((f) => f.path === 'manifest.json');
  if (!entry) {
    throw new Error('archive does not contain manifest.json');
  }
  const text = new TextDecoder().decode(entry.content);
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('manifest.json is not a JSON object');
  }
  return parsed as ManifestShape;
}

/** Base64-encode a `Uint8Array` without depending on Node's `Buffer` typing. */
function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}
