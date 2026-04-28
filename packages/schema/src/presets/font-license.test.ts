// packages/schema/src/presets/font-license.test.ts
// AC #1–#8 — vocabulary + composite-expression parser. Security primitive: the
// parser is the gate between free-form on-disk strings and the typed registry.

import { describe, expect, it } from 'vitest';

import {
  FONT_LICENSE_ATOMS,
  type FontLicenseAtom,
  fontLicenseAtomSchema,
  parseFontLicenseExpression,
} from './font-license.js';

describe('font-license vocabulary (AC #1)', () => {
  it('accepts every documented atom', () => {
    const atoms: FontLicenseAtom[] = [
      'ofl',
      'apache-2.0',
      'mit',
      'public-domain',
      'cc0-1.0',
      'proprietary-byo',
      'commercial-byo',
      'platform-byo',
      'license-cleared',
      'license-mixed',
      'ofl-equivalent',
      'na',
    ];
    for (const a of atoms) {
      expect(fontLicenseAtomSchema.parse(a)).toBe(a);
    }
  });

  it('rejects an unknown atom', () => {
    expect(() => fontLicenseAtomSchema.parse('foo')).toThrow();
    expect(() => fontLicenseAtomSchema.parse('GPL-3.0')).toThrow();
  });

  it('exports the FONT_LICENSE_ATOMS readonly tuple', () => {
    expect(FONT_LICENSE_ATOMS).toContain('ofl');
    expect(FONT_LICENSE_ATOMS.length).toBe(12);
  });
});

describe('parseFontLicenseExpression — atomic forms (AC #2, #6, #8)', () => {
  it('parses a single atom (AC #2)', () => {
    expect(parseFontLicenseExpression('ofl')).toEqual({
      atoms: ['ofl'],
      composition: 'atom',
    });
    expect(parseFontLicenseExpression('proprietary-byo')).toEqual({
      atoms: ['proprietary-byo'],
      composition: 'atom',
    });
  });

  it('rejects an unknown atom with a clear message (AC #6)', () => {
    expect(() => parseFontLicenseExpression('foo')).toThrow(/unknown.*foo/i);
  });

  it('rejects an empty string (AC #8)', () => {
    expect(() => parseFontLicenseExpression('')).toThrow(/empty/i);
    expect(() => parseFontLicenseExpression('   ')).toThrow(/empty/i);
  });
});

describe('parseFontLicenseExpression — AND composite (AC #3, #7)', () => {
  it("parses 'apache-2.0 + ofl' (AC #3)", () => {
    expect(parseFontLicenseExpression('apache-2.0 + ofl')).toEqual({
      atoms: ['apache-2.0', 'ofl'],
      composition: 'all',
    });
  });

  it("parses 'ofl + proprietary-byo'", () => {
    expect(parseFontLicenseExpression('ofl + proprietary-byo')).toEqual({
      atoms: ['ofl', 'proprietary-byo'],
      composition: 'all',
    });
  });

  it('tolerates whitespace and stray spaces (AC #7)', () => {
    expect(parseFontLicenseExpression(' ofl + apache-2.0 ').atoms).toEqual(['ofl', 'apache-2.0']);
    expect(parseFontLicenseExpression('ofl+apache-2.0').atoms).toEqual(['ofl', 'apache-2.0']);
  });
});

describe('parseFontLicenseExpression — OR composite (AC #4)', () => {
  it("parses 'apache-2.0 / ofl / commercial-byo'", () => {
    expect(parseFontLicenseExpression('apache-2.0 / ofl / commercial-byo')).toEqual({
      atoms: ['apache-2.0', 'ofl', 'commercial-byo'],
      composition: 'union',
    });
  });

  it("parses 'apache-2.0/ofl' (no spaces)", () => {
    expect(parseFontLicenseExpression('apache-2.0/ofl').composition).toBe('union');
  });
});

describe('parseFontLicenseExpression — mixed +/ rejection (AC #5)', () => {
  it("rejects 'apache-2.0 + ofl / mit' as mixed-composition", () => {
    expect(() => parseFontLicenseExpression('apache-2.0 + ofl / mit')).toThrow(
      /mixes.*'\+'.*'\/'/i,
    );
  });

  it("rejects 'ofl / apache-2.0 + mit'", () => {
    expect(() => parseFontLicenseExpression('ofl / apache-2.0 + mit')).toThrow(/mixes/i);
  });
});

describe('parseFontLicenseExpression — annotation tolerance', () => {
  // The on-disk stub `weather/twc-retrocast-8bit.md` uses
  // `license: ofl-equivalent (custom)`. The annotation in parens is
  // informational and stripped during parsing — mirrors check-licenses.ts's
  // existing behaviour for SPDX expressions.
  it("accepts 'ofl-equivalent (custom)' as 'ofl-equivalent'", () => {
    expect(parseFontLicenseExpression('ofl-equivalent (custom)')).toEqual({
      atoms: ['ofl-equivalent'],
      composition: 'atom',
    });
  });
});

describe('parseFontLicenseExpression — single-atom guard with separator', () => {
  it("rejects a trailing '+' as malformed", () => {
    expect(() => parseFontLicenseExpression('ofl +')).toThrow();
  });

  it("rejects a leading '+' as malformed", () => {
    expect(() => parseFontLicenseExpression('+ ofl')).toThrow();
  });

  it("rejects a stray '+' between known atoms followed by unknown", () => {
    expect(() => parseFontLicenseExpression('ofl + foo')).toThrow(/unknown.*foo/i);
  });

  it('returns ReadonlyArray semantics in atoms', () => {
    const parsed = parseFontLicenseExpression('ofl + apache-2.0');
    // TypeScript-level: atoms is ReadonlyArray. Runtime: it is a plain array.
    expect(Array.isArray(parsed.atoms)).toBe(true);
    expect(parsed.atoms).toHaveLength(2);
  });
});
