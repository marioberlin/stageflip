// scripts/regenerate-adapter-regression-snapshots.ts
// Regenerator companion to `scripts/check-adapter-regression.ts` (T-435).
//
// For each of the 9 reference adapters:
//   1. Build a `RegressableAdapter` (stub mode).
//   2. Compute the canonical descriptor SHA-256.
//   3. Feed the canonical input through `invoke()`; record the
//      `cacheKey` + canonicalized-output SHA-256.
//   4. Write the snapshot JSON at
//      `packages/adapter-regression/snapshots/<adapter-id>.json`.
//
// Idempotent: re-running produces byte-identical output. Invoked once
// at task creation, then each time an adapter intentionally changes
// its descriptor / capability / stub output / cache-key derivation.
//
// Pure aside from the file-write step. SHA-256 via Web Crypto
// SubtleCrypto (same as the gate). No clocks, no random, no `fetch()`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADAPTER_IDS,
  type AdapterId,
  type AdapterRegressionSnapshot,
  buildAdapter,
  canonicalInputFor,
  descriptorSha256,
  outputSha256,
  serializeAdapterRegressionSnapshot,
} from '../packages/adapter-regression/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const SNAPSHOTS_DIR_DEFAULT = resolve(
  REPO_ROOT,
  'packages',
  'adapter-regression',
  'snapshots',
);

/**
 * Build a snapshot for one adapter. Pure aside from the adapter's own
 * stub-mode invocation. Exported for tests.
 */
export async function buildSnapshotFor(adapterId: AdapterId): Promise<AdapterRegressionSnapshot> {
  const adapter = buildAdapter(adapterId);
  const input = canonicalInputFor(adapterId);
  const result = await adapter.invoke(input);
  return {
    id: adapter.id,
    modality: adapter.descriptor.modality.kind,
    descriptorSha256: await descriptorSha256(adapter.descriptor),
    sampleInputs: [
      {
        name: 'minimal',
        input,
        outputSha256: await outputSha256(result),
        cacheKey: result.cacheKey,
      },
    ],
  };
}

export async function main(
  snapshotsDir: string = SNAPSHOTS_DIR_DEFAULT,
  adapterIds: ReadonlyArray<AdapterId> = ADAPTER_IDS,
): Promise<number> {
  mkdirSync(snapshotsDir, { recursive: true });
  let written = 0;
  for (const adapterId of adapterIds) {
    const snapshot = await buildSnapshotFor(adapterId);
    const path = join(snapshotsDir, `${adapterId}.json`);
    writeFileSync(path, serializeAdapterRegressionSnapshot(snapshot), 'utf8');
    written += 1;
    process.stdout.write(`wrote ${path}\n`);
  }
  process.stdout.write(`regenerate-adapter-regression-snapshots: wrote ${written} snapshots\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch((err: unknown) => {
      process.stderr.write(
        `regenerate-adapter-regression-snapshots: crashed: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    });
}
