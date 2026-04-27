// packages/collab/src/changeset.test.ts
// ChangeSet builder + diffText tests. The debounce semantics covered by
// AC #27 are exercised in commands.test.ts where the command layer wires
// the debounce; this file pins the building blocks.

import { describe, expect, it } from 'vitest';
import {
  buildChangeSet,
  diffText,
  setChangeSetIdProvider,
  setChangeSetNowProvider,
} from './changeset.js';

describe('buildChangeSet', () => {
  it('uses the injected id and timestamp providers', () => {
    const restoreId = setChangeSetIdProvider(() => 'cs-fixed');
    const restoreNow = setChangeSetNowProvider(() => '2026-04-27T00:00:00.000Z');
    try {
      const cs = buildChangeSet({
        docId: 'd1',
        parentVersion: 0,
        ops: [{ op: 'add', path: '/foo', value: 1 }],
        actor: 'u1',
      });
      expect(cs.id).toBe('cs-fixed');
      expect(cs.createdAt).toBe('2026-04-27T00:00:00.000Z');
      expect(cs.docId).toBe('d1');
      expect(cs.parentVersion).toBe(0);
      expect(cs.actor).toBe('u1');
      expect(cs.ops).toHaveLength(1);
    } finally {
      setChangeSetIdProvider(restoreId);
      setChangeSetNowProvider(restoreNow);
    }
  });
});

describe('diffText (AC #26 building block)', () => {
  it('returns empty when strings match', () => {
    expect(diffText('abc', 'abc')).toEqual([]);
  });

  it('single-char insertion in middle yields one insert, zero deletes', () => {
    const prev = 'a'.repeat(500) + 'b'.repeat(500);
    const next = `${'a'.repeat(500)}X${'b'.repeat(500)}`;
    const edits = diffText(prev, next);
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ op: 'insert', index: 500, value: 'X' });
  });

  it('single-char deletion yields one delete, zero inserts', () => {
    const prev = 'abcdef';
    const next = 'abdef';
    const edits = diffText(prev, next);
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ op: 'delete', index: 2, length: 1 });
  });

  it('replacement yields delete + insert at the same index', () => {
    const edits = diffText('abXdef', 'abYdef');
    expect(edits).toHaveLength(2);
    expect(edits[0]).toMatchObject({ op: 'delete', index: 2, length: 1 });
    expect(edits[1]).toMatchObject({ op: 'insert', index: 2, value: 'Y' });
  });

  it('append-only edits yield a single insert at the end', () => {
    const edits = diffText('abc', 'abcdef');
    expect(edits).toEqual([{ op: 'insert', index: 3, value: 'def' }]);
  });

  it('prepend-only edits yield a single insert at index 0', () => {
    const edits = diffText('abc', 'XYabc');
    expect(edits).toEqual([{ op: 'insert', index: 0, value: 'XY' }]);
  });
});
