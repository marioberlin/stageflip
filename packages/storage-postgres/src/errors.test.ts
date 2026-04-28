// packages/storage-postgres/src/errors.test.ts
// Pin the SQLSTATE → application-error mapping per AC #16.

import { describe, expect, it } from 'vitest';

import { StorageVersionMismatchError } from '@stageflip/storage';

import { StorageConnectionError, StorageContentionError, isPgError, mapPgError } from './errors.js';

describe('isPgError', () => {
  it('accepts shapes with a string message', () => {
    expect(isPgError({ message: 'oops', code: '23505' })).toBe(true);
  });
  it('rejects null and primitives', () => {
    expect(isPgError(null)).toBe(false);
    expect(isPgError('boom')).toBe(false);
    expect(isPgError(42)).toBe(false);
  });
  it('rejects objects without message', () => {
    expect(isPgError({ code: '23505' })).toBe(false);
  });
});

describe('mapPgError', () => {
  it('23505 with expected/actual versions becomes StorageVersionMismatchError', () => {
    const out = mapPgError(
      { code: '23505', message: 'unique violation' },
      { docId: 'd1', op: 'putSnapshot', expectedVersion: 2, actualVersion: 1 },
    );
    expect(out).toBeInstanceOf(StorageVersionMismatchError);
    if (out instanceof StorageVersionMismatchError) {
      expect(out.docId).toBe('d1');
      expect(out.expected).toBe(2);
      expect(out.actual).toBe(1);
    }
  });

  it('23505 without version context surfaces as a readable Error', () => {
    const out = mapPgError(
      { code: '23505', message: 'unique violation', detail: 'Key (id)=…' },
      { docId: 'd1', op: 'applyPatch' },
    );
    expect(out).not.toBeInstanceOf(StorageVersionMismatchError);
    expect(out.message).toMatch(/unique violation/);
    expect(out.message).toMatch(/d1/);
  });

  it('40001 (serialization_failure) becomes StorageContentionError', () => {
    const out = mapPgError(
      { code: '40001', message: 'could not serialize' },
      { docId: 'd1', op: 'applyPatch' },
    );
    expect(out).toBeInstanceOf(StorageContentionError);
  });

  it('40P01 (deadlock_detected) becomes StorageContentionError', () => {
    const out = mapPgError(
      { code: '40P01', message: 'deadlock detected' },
      { docId: 'd1', op: 'applyPatch' },
    );
    expect(out).toBeInstanceOf(StorageContentionError);
  });

  it('08006 (connection_failure) becomes StorageConnectionError', () => {
    const out = mapPgError(
      { code: '08006', message: 'connection terminated' },
      { docId: 'd1', op: 'getSnapshot' },
    );
    expect(out).toBeInstanceOf(StorageConnectionError);
  });

  it('08000 (any 08* family) becomes StorageConnectionError', () => {
    const out = mapPgError(
      { code: '08000', message: 'connection_exception' },
      { docId: 'd1', op: 'applyUpdate' },
    );
    expect(out).toBeInstanceOf(StorageConnectionError);
  });

  it('unknown SQLSTATE re-throws original Error', () => {
    const orig = new Error('weird');
    const out = mapPgError(orig, { docId: 'd1', op: 'getHistory' });
    expect(out).toBe(orig);
  });

  it('non-PG plain Error is returned as-is', () => {
    const orig = new TypeError('not pg');
    const out = mapPgError(orig, { docId: 'd1', op: 'putSnapshot' });
    expect(out).toBe(orig);
  });

  it('non-Error throwables become Error', () => {
    const out = mapPgError('string thrown', { docId: 'd1', op: 'putSnapshot' });
    expect(out).toBeInstanceOf(Error);
    expect(out.message).toBe('string thrown');
  });
});
