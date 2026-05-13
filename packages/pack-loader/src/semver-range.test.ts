// packages/pack-loader/src/semver-range.test.ts

import { describe, expect, it } from 'vitest';

import { satisfiesRange } from './semver-range.js';

describe('satisfiesRange', () => {
  describe('caret ranges', () => {
    it('^1.2.3 admits >=1.2.3 within the same major', () => {
      expect(satisfiesRange('1.2.3', '^1.2.3')).toBe(true);
      expect(satisfiesRange('1.3.0', '^1.2.3')).toBe(true);
      expect(satisfiesRange('1.99.99', '^1.2.3')).toBe(true);
    });
    it('^1.2.3 rejects 2.0.0+', () => {
      expect(satisfiesRange('2.0.0', '^1.2.3')).toBe(false);
    });
    it('^1.2.3 rejects 1.2.2', () => {
      expect(satisfiesRange('1.2.2', '^1.2.3')).toBe(false);
    });
  });

  describe('tilde ranges', () => {
    it('~1.2.3 admits 1.2.3..1.2.x', () => {
      expect(satisfiesRange('1.2.3', '~1.2.3')).toBe(true);
      expect(satisfiesRange('1.2.99', '~1.2.3')).toBe(true);
    });
    it('~1.2.3 rejects 1.3.0', () => {
      expect(satisfiesRange('1.3.0', '~1.2.3')).toBe(false);
    });
  });

  describe('comparison ranges', () => {
    it('>=1.2.3', () => {
      expect(satisfiesRange('1.2.3', '>=1.2.3')).toBe(true);
      expect(satisfiesRange('2.0.0', '>=1.2.3')).toBe(true);
      expect(satisfiesRange('1.2.2', '>=1.2.3')).toBe(false);
    });
    it('<2.0.0', () => {
      expect(satisfiesRange('1.9.9', '<2.0.0')).toBe(true);
      expect(satisfiesRange('2.0.0', '<2.0.0')).toBe(false);
    });
  });

  describe('hyphen ranges', () => {
    it('inclusive both ends', () => {
      expect(satisfiesRange('1.2.3', '1.2.0 - 1.2.9')).toBe(true);
      expect(satisfiesRange('1.2.0', '1.2.0 - 1.2.9')).toBe(true);
      expect(satisfiesRange('1.2.9', '1.2.0 - 1.2.9')).toBe(true);
      expect(satisfiesRange('1.3.0', '1.2.0 - 1.2.9')).toBe(false);
    });
  });

  describe('wildcards + exact', () => {
    it('* admits any version', () => {
      expect(satisfiesRange('99.99.99', '*')).toBe(true);
      expect(satisfiesRange('0.0.1', '*')).toBe(true);
    });
    it('empty string admits any version', () => {
      expect(satisfiesRange('1.0.0', '')).toBe(true);
    });
    it('exact match', () => {
      expect(satisfiesRange('1.2.3', '1.2.3')).toBe(true);
      expect(satisfiesRange('1.2.4', '1.2.3')).toBe(false);
    });
  });

  describe('malformed input', () => {
    it('non-semver version returns false', () => {
      expect(satisfiesRange('v1', '^1.0.0')).toBe(false);
    });
    it('malformed range with ^ returns false', () => {
      expect(satisfiesRange('1.0.0', '^garbage')).toBe(false);
    });
  });
});
