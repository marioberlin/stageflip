// packages/schema/src/presets/errors.test.ts
// Tests for the three preset error classes (T-304 AC #27–#29).

import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { PresetParseError, PresetRegistryLoadError, PresetValidationError } from './errors.js';

describe('PresetValidationError', () => {
  it('extends Error and exposes filePath, field, zodIssues', () => {
    const zerr = new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['id'],
        message: 'Expected string',
      },
    ]);
    const err = new PresetValidationError('skills/foo/bar.md', zerr.issues, 'id');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('PresetValidationError');
    expect(err.filePath).toBe('skills/foo/bar.md');
    expect(err.field).toBe('id');
    expect(err.zodIssues).toEqual(zerr.issues);
    expect(err.message).toContain('skills/foo/bar.md');
    expect(err.message).toContain('id: Expected string');
  });

  it('renders <root> when the issue path is empty', () => {
    const err = new PresetValidationError('a.md', [
      { code: 'custom', path: [], message: 'top-level oops' },
    ] as never);
    expect(err.message).toContain('<root>: top-level oops');
  });

  it('omits field when not supplied', () => {
    const err = new PresetValidationError('a.md', []);
    expect(err.field).toBeUndefined();
  });
});

describe('PresetParseError', () => {
  it('extends Error and exposes filePath + cause', () => {
    const cause = new Error('YAMLException: bad indent');
    const err = new PresetParseError('skills/foo/bar.md', cause);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('PresetParseError');
    expect(err.filePath).toBe('skills/foo/bar.md');
    expect(err.cause).toBe(cause);
    expect(err.message).toContain('skills/foo/bar.md');
    expect(err.message).toContain('YAMLException: bad indent');
  });

  it('stringifies non-Error causes', () => {
    const err = new PresetParseError('a.md', 'string-cause');
    expect(err.message).toContain('string-cause');
  });
});

describe('PresetRegistryLoadError', () => {
  it('extends Error and exposes issues array', () => {
    const issues = [
      { filePath: 'a.md', error: new Error('one') },
      { filePath: 'b.md', error: new Error('two') },
    ];
    const err = new PresetRegistryLoadError(issues);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('PresetRegistryLoadError');
    expect(err.issues).toEqual(issues);
    expect(err.message).toContain('2 issue(s)');
    expect(err.message).toContain('a.md: one');
    expect(err.message).toContain('b.md: two');
  });
});
