// firebase/tests/auth-rules.test.ts
// T-262 AC #26-#30 — structural assertions on the org/auth rules.
// Full behavioural tests would require the Firestore emulator
// (firebase-rules-unit-testing + Java) which isn't bootstrapped in
// CI yet; in the meantime we pin the textual structure of the rules
// so regressions in the security boundary are caught at PR time.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rules = readFileSync(path.join(ROOT, 'firebase/firestore.rules'), 'utf8');

describe('users/{userId} (AC #26)', () => {
  it('allows read+write only when auth.uid == userId', () => {
    expect(rules).toMatch(
      /match \/users\/\{userId\}[\s\S]*allow read, write: if isAuthed\(\) && request\.auth\.uid == userId/,
    );
  });
});

describe('orgs/{orgId} (AC #27)', () => {
  it('reads gated by org membership', () => {
    const orgsBlock = rules.match(/match \/orgs\/\{orgId\}[\s\S]*?match \/orgs/m)?.[0] ?? rules;
    expect(orgsBlock).toMatch(/allow read: if isOrgMember\(orgId\) && isAtLeast\('viewer'\)/);
  });
  it('updates require admin+', () => {
    expect(rules).toMatch(/allow update: if isOrgMember\(orgId\) && isAtLeast\('admin'\)/);
  });
  it('create/delete require owner', () => {
    expect(rules).toMatch(/allow create, delete: if isOrgMember\(orgId\) && isAtLeast\('owner'\)/);
  });
});

describe('orgs/{orgId}/members/{userId} (AC #28)', () => {
  it('reads by org members; writes by admin+', () => {
    const block = rules.match(/match \/members\/\{userId\}[\s\S]*?\}/m)?.[0] ?? '';
    expect(block).toMatch(/allow read: if isOrgMember\(orgId\) && isAtLeast\('viewer'\)/);
    expect(block).toMatch(/allow write: if isOrgMember\(orgId\) && isAtLeast\('admin'\)/);
  });
});

describe('orgs/{orgId}/apiKeys/{keyId} (AC #29 — security primitive)', () => {
  const block = rules.match(/match \/apiKeys\/\{keyId\}[\s\S]*?^ {6}\}/m)?.[0] ?? '';

  it('exists', () => {
    expect(block).toBeTruthy();
  });

  it('reads gated to admin+', () => {
    expect(block).toMatch(/allow read: if isOrgMember\(orgId\) && isAtLeast\('admin'\)/);
  });

  it('writes are NEVER allowed from client SDKs (write: if false)', () => {
    expect(block).toMatch(/allow write: if false/);
  });

  it('does NOT contain a `write: if isOrgMember` rule (regression guard)', () => {
    expect(block).not.toMatch(/write:\s*if isOrgMember/);
  });
});

describe('orgs/{orgId}/documents/** (AC #30)', () => {
  it('documents reads gated to viewer+, writes to editor+', () => {
    const docMatch = rules.match(
      /match \/documents\/\{docId\} \{[\s\S]*?match \/changes\/\{changeId\}/m,
    );
    const block = docMatch?.[0] ?? '';
    expect(block).toMatch(/allow read: if isOrgMember\(orgId\) && isAtLeast\('viewer'\)/);
    expect(block).toMatch(/allow create, update: if isOrgMember\(orgId\) && isAtLeast\('editor'\)/);
  });

  it('changes subcollection requires editor+', () => {
    expect(rules).toMatch(
      /match \/changes\/\{changeId\}[\s\S]*allow read, write: if isOrgMember\(orgId\) && isAtLeast\('editor'\)/,
    );
  });
});

describe('orgs/{orgId}/invites/{token}', () => {
  const block = rules.match(/match \/invites\/\{token\}[\s\S]*?^ {6}\}/m)?.[0] ?? '';

  it('exists with admin-only read and write: false', () => {
    expect(block).toBeTruthy();
    expect(block).toMatch(/allow read: if isOrgMember\(orgId\) && isAtLeast\('admin'\)/);
    expect(block).toMatch(/allow write: if false/);
  });
});

describe('deny-by-default catch-all (AC #31, #32)', () => {
  it('still ends with a deny-by-default match', () => {
    expect(rules).toMatch(/match \/\{document=\*\*\}[\s\S]*allow read, write: if false/);
  });
});
