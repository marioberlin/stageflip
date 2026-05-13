// packages/pack-signing/src/commands/verify.ts
// T-498 — `stageflip-pack-sign verify <archive-path> --key <public.pem>`
// — read the archive + `<archive-path>.sig`, verify the Ed25519
// signature, print `verified` / `signature did not verify`.
//
// Determinism perimeter: this package lives OUTSIDE.

import { ED25519_SIGNATURE_LENGTH, verifyPackArchive } from '@stageflip/pack-format';

import type { CliSignDependencies } from '../deps.js';

/** Result of `verifySignedPack`. Never throws on bad signature. */
export type VerifyResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

/** Options for `verifySignedPack`. */
export interface VerifyPackOptions {
  readonly archivePath: string;
  readonly publicKeyPath: string;
}

/**
 * Verify the signature on a signed pack archive. Reads the archive +
 * its `.sig` sidecar + the public key PEM, runs Ed25519 verification.
 * Returns a structured result rather than throwing — bad signatures
 * are an expected outcome, not an exception.
 */
export async function verifySignedPack(
  opts: VerifyPackOptions,
  deps: CliSignDependencies,
): Promise<VerifyResult> {
  if (!(await deps.fs.exists(opts.archivePath))) {
    return { ok: false, detail: `archive not found: ${opts.archivePath}` };
  }
  const signaturePath = `${opts.archivePath}.sig`;
  if (!(await deps.fs.exists(signaturePath))) {
    return { ok: false, detail: `signature not found: ${signaturePath}` };
  }
  if (!(await deps.fs.exists(opts.publicKeyPath))) {
    return { ok: false, detail: `public key not found: ${opts.publicKeyPath}` };
  }

  const archiveBytes = await deps.fs.readFile(opts.archivePath);
  const signature = await deps.fs.readFile(signaturePath);
  if (signature.length !== ED25519_SIGNATURE_LENGTH) {
    return {
      ok: false,
      detail: `signature has unexpected length ${signature.length} (expected ${ED25519_SIGNATURE_LENGTH})`,
    };
  }
  const publicKeyBytes = await deps.fs.readFile(opts.publicKeyPath);
  const publicKeyPem = new TextDecoder().decode(publicKeyBytes);

  let ok: boolean;
  try {
    ok = verifyPackArchive(archiveBytes, signature, publicKeyPem);
  } catch (err) {
    return { ok: false, detail: `verification threw: ${(err as Error).message}` };
  }
  if (!ok) {
    return { ok: false, detail: 'signature did not verify' };
  }
  return { ok: true };
}

/**
 * Run the `verify` subcommand. Args: `<archive-path> --key
 * <public.pem>`. Returns 0 if verified, 1 otherwise.
 */
export async function runVerifyCommand(
  args: readonly string[],
  deps: CliSignDependencies,
): Promise<number> {
  let archivePath: string | undefined;
  let publicKeyPath: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--key') {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) {
        deps.logger.error('stageflip-pack-sign verify: --key requires a value');
        return 1;
      }
      publicKeyPath = next;
      i += 1;
      continue;
    }
    if (arg?.startsWith('--')) {
      deps.logger.error(`stageflip-pack-sign verify: unknown flag: ${arg}`);
      return 1;
    }
    if (archivePath === undefined) {
      archivePath = arg;
    } else {
      deps.logger.error(`stageflip-pack-sign verify: unexpected positional: ${arg}`);
      return 1;
    }
  }
  if (archivePath === undefined) {
    deps.logger.error('stageflip-pack-sign verify: <archive-path> is required');
    return 1;
  }
  if (publicKeyPath === undefined) {
    deps.logger.error('stageflip-pack-sign verify: --key <public.pem> is required');
    return 1;
  }
  const result = await verifySignedPack({ archivePath, publicKeyPath }, deps);
  if (result.ok) {
    deps.logger.info('verified');
    return 0;
  }
  deps.logger.error(result.detail);
  return 1;
}
