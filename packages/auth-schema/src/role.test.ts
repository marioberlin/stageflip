// packages/auth-schema/src/role.test.ts
// T-262 AC #5–#6 — role hierarchy + checkRoleAtLeast.
//
// AC #6 is the security primitive: every middleware decision flows through
// `checkRoleAtLeast`. We pin all 16 (have, need) pairs explicitly rather
// than spot-checking — getting this wrong silently widens or narrows the
// permission gate everywhere.

import { describe, expect, it } from 'vitest';
import { ROLE_RANK, type Role, checkRoleAtLeast, roleSchema } from './role.js';

describe('roleSchema', () => {
  it('is an enum of [viewer, editor, admin, owner] in hierarchy order', () => {
    expect(roleSchema.options).toEqual(['viewer', 'editor', 'admin', 'owner']);
  });

  it('rejects an unknown role value', () => {
    expect(() => roleSchema.parse('superuser')).toThrow();
  });

  it.each(['viewer', 'editor', 'admin', 'owner'] as const)('accepts %s', (role) => {
    expect(roleSchema.parse(role)).toBe(role);
  });
});

describe('ROLE_RANK', () => {
  it('mirrors roleSchema option order with viewer=0', () => {
    expect(ROLE_RANK).toEqual({ viewer: 0, editor: 1, admin: 2, owner: 3 });
  });
});

// AC #6 — exhaustive 16-row pin. Format: [have, need, expected].
const PAIRS: ReadonlyArray<readonly [Role, Role, boolean]> = [
  ['viewer', 'viewer', true],
  ['viewer', 'editor', false],
  ['viewer', 'admin', false],
  ['viewer', 'owner', false],
  ['editor', 'viewer', true],
  ['editor', 'editor', true],
  ['editor', 'admin', false],
  ['editor', 'owner', false],
  ['admin', 'viewer', true],
  ['admin', 'editor', true],
  ['admin', 'admin', true],
  ['admin', 'owner', false],
  ['owner', 'viewer', true],
  ['owner', 'editor', true],
  ['owner', 'admin', true],
  ['owner', 'owner', true],
];

describe('checkRoleAtLeast — exhaustive 4×4 pin (AC #6)', () => {
  for (const [have, need, expected] of PAIRS) {
    it(`have=${have}, need=${need} → ${expected}`, () => {
      expect(checkRoleAtLeast(have, need)).toBe(expected);
    });
  }

  it('covers all 16 pairs (no row skipped)', () => {
    expect(PAIRS).toHaveLength(16);
    const seen = new Set(PAIRS.map(([h, n]) => `${h}/${n}`));
    expect(seen.size).toBe(16);
  });
});
