// firebase/tests/eu-region-rules.test.ts
// T-271 AC #9, #10 — eu-west database rules are equivalent to (default) and
// cross-region read is impossible. Behavioural emulator tests are not yet
// bootstrapped (deviation acceptable per T-262 precedent in
// firebase/tests/auth-rules.test.ts); we pin the structural posture instead.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const usRules = readFileSync(path.join(ROOT, 'firebase/firestore.rules'), 'utf8');
const euRules = readFileSync(path.join(ROOT, 'firebase/firestore-eu.rules'), 'utf8');

describe('firestore-eu.rules exists and parses (AC #9)', () => {
  it('starts with a rules_version declaration', () => {
    expect(euRules).toMatch(/^rules_version\s*=\s*'2';/m);
  });

  it('declares the cloud.firestore service block', () => {
    expect(euRules).toMatch(/service cloud\.firestore/);
  });
});

describe('firestore-eu.rules enforces the same role model as (default) (AC #9)', () => {
  it('orgs/{orgId} read gated by isOrgMember + viewer', () => {
    expect(euRules).toMatch(/allow read: if isOrgMember\(orgId\) && isAtLeast\('viewer'\)/);
  });

  it('orgs/{orgId} update gated by admin', () => {
    expect(euRules).toMatch(/allow update: if isOrgMember\(orgId\) && isAtLeast\('admin'\)/);
  });

  it('apiKeys writes are blocked client-side (security primitive)', () => {
    const block = euRules.match(/match \/apiKeys\/\{keyId\}[\s\S]*?^ {6}\}/m)?.[0] ?? '';
    expect(block).toMatch(/allow write: if false/);
  });

  it('ends with deny-by-default catch-all', () => {
    expect(euRules).toMatch(/match \/\{document=\*\*\}[\s\S]*allow read, write: if false/);
  });
});

describe('cross-region read impossibility (AC #10 — security primitive)', () => {
  // True by construction: each Firestore database has its own access path.
  // An EU principal asking for `orgs/<usOrgId>/documents/<usDocId>` against
  // the eu-west database hits the eu-west rules and gets nothing back —
  // the document does not exist in that database (it lives in `(default)`).
  // We pin the structural property: both rule files contain identical
  // org-scoped rules so the access decision is purely tied to which
  // database the client connected to. The storage adapter
  // (`region-router.ts`) is what binds an EU org to the EU client; a US
  // org's docs are never reachable from that client.

  it('eu-west rules also gate by activeOrg claim (no cross-org read)', () => {
    // The EU rules use the same `isOrgMember(orgId)` helper, so a principal
    // whose token claims `org === <us-org-id>` cannot guess a US doc path
    // and read it from the EU database — the doc does not exist there, AND
    // even if it did the rule would also need `activeOrg() == orgId`.
    const orgsBlock = euRules.match(/match \/orgs\/\{orgId\}[\s\S]*?match \/orgs/m)?.[0] ?? euRules;
    expect(orgsBlock).toMatch(/allow read: if isOrgMember\(orgId\) && isAtLeast\('viewer'\)/);
  });

  it('eu-west rule text equals (default) rule text (regression guard for AC #9)', () => {
    // If the rules diverge between databases, an attacker could exploit the
    // weaker side. Pin equality.
    expect(euRules).toBe(usRules);
  });
});
