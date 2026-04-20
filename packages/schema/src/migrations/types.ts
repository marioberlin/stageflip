// packages/schema/src/migrations/types.ts
// Framework types for schema version migrations. Every breaking change to the
// canonical document shape bumps SCHEMA_VERSION (see ../document.ts) and
// ships a migration in ./registry.ts. Migrations can be chained (v1 -> v2 ->
// v3) so old documents in storage always have a path to the current shape.

/**
 * A migration transforms a document from one schema version to the next.
 * Never skip a version. Always leave the input document untouched — return
 * a new value.
 */
export interface Migration {
  /** Version the migration reads. Document.meta.schemaVersion must equal this. */
  from: number;
  /** Version the migration writes. Always from + 1. */
  to: number;
  /** Short imperative description for the ChangeLog + commit message. */
  description: string;
  /**
   * Whether the migration is reversible. When true, a `down` function must
   * also exist (currently deferred; add alongside the first reversible
   * migration).
   */
  reversible: boolean;
  /** Forward transform. */
  up(input: unknown): unknown;
}

/** Result of migrating a document to a target version. */
export interface MigrationRunResult {
  document: unknown;
  fromVersion: number;
  toVersion: number;
  applied: Array<{ from: number; to: number; description: string }>;
}

export class MigrationError extends Error {
  constructor(
    public readonly fromVersion: number,
    public readonly toVersion: number,
    message: string,
  ) {
    super(`migration ${fromVersion} -> ${toVersion}: ${message}`);
    this.name = 'MigrationError';
  }
}
