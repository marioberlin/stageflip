// apps/api/src/auth/can-set-interactive.test.ts
// T-411b — authorization predicate tests. Covers every (role × same-tenant ×
// current → next) cell of the D-T411b-2 matrix plus cross-tenant denials.

import { describe, expect, it } from 'vitest';

import {
  type AuthorizationActor,
  type InteractiveValue,
  canSetInteractive,
} from './can-set-interactive.js';

const VALUES: readonly InteractiveValue[] = ['disabled', 'preview', 'ga'];

function actor(role: AuthorizationActor['role'], org = 'tenant-a'): AuthorizationActor {
  return { role, org };
}

describe('canSetInteractive — superadmin', () => {
  for (const current of VALUES) {
    for (const next of VALUES) {
      it(`allows superadmin: same-tenant ${current} → ${next}`, () => {
        const dec = canSetInteractive(actor('superadmin'), 'tenant-a', current, next);
        expect(dec.allowed).toBe(true);
      });
      it(`allows superadmin: cross-tenant ${current} → ${next}`, () => {
        const dec = canSetInteractive(actor('superadmin', 'org-x'), 'tenant-a', current, next);
        expect(dec.allowed).toBe(true);
      });
    }
  }
});

describe('canSetInteractive — admin / owner (tenant_admin equivalents)', () => {
  for (const role of ['admin', 'owner'] as const) {
    it(`${role} allows disabled → preview on own tenant`, () => {
      const dec = canSetInteractive(actor(role), 'tenant-a', 'disabled', 'preview');
      expect(dec.allowed).toBe(true);
    });
    it(`${role} allows preview → disabled on own tenant`, () => {
      const dec = canSetInteractive(actor(role), 'tenant-a', 'preview', 'disabled');
      expect(dec.allowed).toBe(true);
    });
    it(`${role} allows disabled → disabled (no-op) on own tenant`, () => {
      const dec = canSetInteractive(actor(role), 'tenant-a', 'disabled', 'disabled');
      expect(dec.allowed).toBe(true);
    });
    it(`${role} allows preview → preview (no-op) on own tenant`, () => {
      const dec = canSetInteractive(actor(role), 'tenant-a', 'preview', 'preview');
      expect(dec.allowed).toBe(true);
    });
    it(`${role} DENIES disabled → ga on own tenant`, () => {
      const dec = canSetInteractive(actor(role), 'tenant-a', 'disabled', 'ga');
      expect(dec.allowed).toBe(false);
      if (!dec.allowed) {
        expect(dec.reason).toMatch(/superadmin/i);
      }
    });
    it(`${role} DENIES preview → ga on own tenant`, () => {
      const dec = canSetInteractive(actor(role), 'tenant-a', 'preview', 'ga');
      expect(dec.allowed).toBe(false);
    });
    it(`${role} DENIES ga → preview on own tenant`, () => {
      // Once at GA, only superadmin can move it.
      const dec = canSetInteractive(actor(role), 'tenant-a', 'ga', 'preview');
      expect(dec.allowed).toBe(false);
    });
    it(`${role} DENIES ga → disabled on own tenant`, () => {
      const dec = canSetInteractive(actor(role), 'tenant-a', 'ga', 'disabled');
      expect(dec.allowed).toBe(false);
    });
    it(`${role} DENIES cross-tenant (org tenant-b → request tenant-a)`, () => {
      const dec = canSetInteractive(actor(role, 'tenant-b'), 'tenant-a', 'disabled', 'preview');
      expect(dec.allowed).toBe(false);
      if (!dec.allowed) {
        expect(dec.reason).toMatch(/cross-tenant/i);
      }
    });
  }
});

describe('canSetInteractive — viewer / editor (no write permission)', () => {
  for (const role of ['viewer', 'editor'] as const) {
    for (const current of VALUES) {
      for (const next of VALUES) {
        it(`${role} DENIES same-tenant ${current} → ${next}`, () => {
          const dec = canSetInteractive(actor(role), 'tenant-a', current, next);
          expect(dec.allowed).toBe(false);
        });
        it(`${role} DENIES cross-tenant ${current} → ${next}`, () => {
          const dec = canSetInteractive(actor(role, 'tenant-b'), 'tenant-a', current, next);
          expect(dec.allowed).toBe(false);
        });
      }
    }
  }
});

describe('canSetInteractive — purity', () => {
  it('returns the same decision for identical inputs', () => {
    const a = canSetInteractive(actor('admin'), 'tenant-a', 'disabled', 'preview');
    const b = canSetInteractive(actor('admin'), 'tenant-a', 'disabled', 'preview');
    expect(a).toEqual(b);
  });

  it('does not mutate the actor input', () => {
    const a = actor('admin');
    const snapshot = { ...a };
    canSetInteractive(a, 'tenant-a', 'disabled', 'preview');
    expect(a).toEqual(snapshot);
  });
});
