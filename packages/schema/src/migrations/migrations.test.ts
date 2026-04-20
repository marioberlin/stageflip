// packages/schema/src/migrations/migrations.test.ts
// Unit tests for the migration runner + v0->v1 identity migration.

import { describe, expect, it } from 'vitest';

import { SCHEMA_VERSION } from '../document.js';
import { MIGRATIONS, isCurrent, migrate } from './registry.js';
import { MigrationError } from './types.js';

const NOW = '2026-04-20T12:00:00.000Z';

const V0_DOC = {
  meta: { id: 'd1', version: 0, createdAt: NOW, updatedAt: NOW, schemaVersion: 0 },
  theme: { tokens: {} },
  variables: {},
  components: {},
  content: { mode: 'slide', slides: [{ id: 's', elements: [] }] },
};

describe('migrations registry', () => {
  it('MIGRATIONS is ordered by from', () => {
    for (let i = 1; i < MIGRATIONS.length; i++) {
      const prev = MIGRATIONS[i - 1];
      const cur = MIGRATIONS[i];
      expect(prev && cur && prev.from < cur.from).toBe(true);
    }
  });

  it('migrations form a continuous chain to SCHEMA_VERSION', () => {
    let expectedFrom = 0;
    for (const m of MIGRATIONS) {
      expect(m.from).toBe(expectedFrom);
      expect(m.to).toBe(expectedFrom + 1);
      expectedFrom = m.to;
    }
    expect(expectedFrom).toBe(SCHEMA_VERSION);
  });
});

describe('migrate()', () => {
  it('is a no-op when already at target', () => {
    const atCurrent = {
      ...V0_DOC,
      meta: { ...V0_DOC.meta, schemaVersion: SCHEMA_VERSION },
    };
    const result = migrate(atCurrent);
    expect(result.applied).toEqual([]);
    expect(result.fromVersion).toBe(SCHEMA_VERSION);
    expect(result.toVersion).toBe(SCHEMA_VERSION);
  });

  it('walks the chain from v0 to current', () => {
    const result = migrate(V0_DOC);
    expect(result.fromVersion).toBe(0);
    expect(result.toVersion).toBe(SCHEMA_VERSION);
    expect(result.applied.length).toBe(SCHEMA_VERSION);
    // v0->v1 is an identity migration that sets meta.schemaVersion.
    const out = result.document as { meta: { schemaVersion: number } };
    expect(out.meta.schemaVersion).toBe(1);
  });

  it('treats missing meta.schemaVersion as 0', () => {
    // Omit schemaVersion via destructure rather than `delete`.
    const { schemaVersion: _omit, ...metaWithoutVersion } = V0_DOC.meta;
    void _omit;
    const noVersion = { ...V0_DOC, meta: metaWithoutVersion };
    const result = migrate(noVersion);
    expect(result.fromVersion).toBe(0);
    expect(result.applied.length).toBeGreaterThan(0);
  });

  it('rejects a non-object document', () => {
    expect(() => migrate(null)).toThrow(MigrationError);
    expect(() => migrate('hello' as unknown as object)).toThrow(MigrationError);
  });

  it('rejects downgrade until reversibleMigrate lands', () => {
    const future = { ...V0_DOC, meta: { ...V0_DOC.meta, schemaVersion: 99 } };
    expect(() => migrate(future)).toThrow(/downgrades require/);
  });

  it('rejects a target with no registered migration', () => {
    // Target higher than any registered `to`.
    expect(() => migrate(V0_DOC, SCHEMA_VERSION + 10)).toThrow(/no migration registered/);
  });
});

describe('isCurrent()', () => {
  it('true when meta.schemaVersion equals current', () => {
    expect(isCurrent({ ...V0_DOC, meta: { ...V0_DOC.meta, schemaVersion: SCHEMA_VERSION } })).toBe(
      true,
    );
  });
  it('false when lower', () => {
    expect(isCurrent(V0_DOC)).toBe(false);
  });
  it('false for non-objects', () => {
    expect(isCurrent(null)).toBe(false);
    expect(isCurrent(undefined)).toBe(false);
  });
});
