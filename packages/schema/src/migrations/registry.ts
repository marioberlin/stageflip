// packages/schema/src/migrations/registry.ts
// Ordered registry of migrations and the runner that applies them.

import { SCHEMA_VERSION } from '../document.js';
import { type Migration, MigrationError, type MigrationRunResult } from './types.js';

/**
 * Migration from v0 (pre-ratification snapshot) to v1 (this release). Identity
 * transform — at the moment of cutover no shape changes are needed. The entry
 * exists so the framework's chain walking is exercised end-to-end and so
 * imports that arrive carrying meta.schemaVersion=0 have a path forward.
 */
const v0ToV1: Migration = {
  from: 0,
  to: 1,
  description: 'Initial schema release: normalize schemaVersion to 1 (no shape change).',
  reversible: true,
  up(input) {
    if (typeof input !== 'object' || input === null) return input;
    const doc = input as Record<string, unknown>;
    const meta = (doc.meta as Record<string, unknown> | undefined) ?? {};
    return { ...doc, meta: { ...meta, schemaVersion: 1 } };
  },
};

/**
 * Registered migrations, ordered by `from`. New migrations are inserted here
 * (and tested in ../migrations.test.ts) when SCHEMA_VERSION is bumped.
 */
export const MIGRATIONS: readonly Migration[] = [v0ToV1];

/** Look up a migration from one version. Returns undefined when none exists. */
export function findMigration(fromVersion: number): Migration | undefined {
  return MIGRATIONS.find((m) => m.from === fromVersion);
}

/**
 * Apply migrations in sequence from the document's declared schemaVersion up
 * to `target` (defaults to the current SCHEMA_VERSION). Throws if no chain
 * connects the two.
 */
export function migrate(document: unknown, target: number = SCHEMA_VERSION): MigrationRunResult {
  if (typeof document !== 'object' || document === null) {
    throw new MigrationError(-1, target, 'document must be a non-null object');
  }
  const meta = (document as { meta?: { schemaVersion?: unknown } }).meta;
  const declared = (meta as { schemaVersion?: unknown } | undefined)?.schemaVersion;
  const fromVersion =
    typeof declared === 'number' && Number.isInteger(declared) && declared >= 0 ? declared : 0;

  if (fromVersion === target) {
    return { document, fromVersion, toVersion: target, applied: [] };
  }
  if (fromVersion > target) {
    throw new MigrationError(
      fromVersion,
      target,
      'downgrades require explicit reversibleMigrate() — not yet implemented',
    );
  }

  let cur: unknown = document;
  let curVersion = fromVersion;
  const applied: MigrationRunResult['applied'] = [];

  while (curVersion < target) {
    const step = findMigration(curVersion);
    if (!step) {
      throw new MigrationError(
        curVersion,
        target,
        `no migration registered from version ${curVersion}`,
      );
    }
    cur = step.up(cur);
    applied.push({ from: step.from, to: step.to, description: step.description });
    curVersion = step.to;
  }

  return { document: cur, fromVersion, toVersion: curVersion, applied };
}

/** Is a document already at the target version? */
export function isCurrent(document: unknown, target: number = SCHEMA_VERSION): boolean {
  if (typeof document !== 'object' || document === null) return false;
  const meta = (document as { meta?: { schemaVersion?: unknown } }).meta;
  return (meta as { schemaVersion?: unknown } | undefined)?.schemaVersion === target;
}
