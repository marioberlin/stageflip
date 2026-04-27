// firebase/tests/firebase-config.test.ts
// T-230 — shape assertions for firebase.json / .firebaserc /
// firestore.rules / storage.rules. Full rule behaviour requires the
// Firestore emulator (Java dep) and lives in a Phase-12 follow-up;
// this suite catches config typos + deny-by-default regressions.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson<T>(relative: string): T {
  return JSON.parse(readFileSync(path.join(ROOT, relative), 'utf8')) as T;
}

function readText(relative: string): string {
  return readFileSync(path.join(ROOT, relative), 'utf8');
}

interface HostingEntry {
  readonly target: string;
  readonly public: string;
  readonly cleanUrls?: boolean;
  readonly rewrites?: unknown[];
}

interface FirestoreDbEntry {
  readonly database: string;
  readonly rules: string;
  readonly indexes: string;
}

describe('firebase.json', () => {
  const cfg = readJson<{
    hosting: HostingEntry[];
    firestore: FirestoreDbEntry[];
    storage: { rules: string };
  }>('firebase.json');

  it('declares all four site targets', () => {
    const targets = cfg.hosting.map((h) => h.target).sort();
    expect(targets).toEqual(['display', 'docs', 'slide', 'video']);
  });

  it('routes docs target at the Astro dist output', () => {
    const docs = cfg.hosting.find((h) => h.target === 'docs');
    expect(docs?.public).toBe('apps/docs/dist');
  });

  it('wires slide/video/display targets through Cloud Run rewrites', () => {
    for (const name of ['slide', 'video', 'display']) {
      const entry = cfg.hosting.find((h) => h.target === name);
      expect(entry).toBeDefined();
      const rewrites = (entry?.rewrites ?? []) as Array<{ run?: { serviceId: string } }>;
      expect(rewrites.length).toBeGreaterThan(0);
      expect(rewrites[0]?.run?.serviceId).toBe(`stageflip-${name}`);
    }
  });

  it('points the (default) Firestore at firebase/firestore.rules', () => {
    const def = cfg.firestore.find((f) => f.database === '(default)');
    expect(def?.rules).toBe('firebase/firestore.rules');
    expect(def?.indexes).toBe('firebase/firestore.indexes.json');
  });

  it('declares the eu-west database with its own rules file (T-271)', () => {
    const eu = cfg.firestore.find((f) => f.database === 'eu-west');
    expect(eu?.rules).toBe('firebase/firestore-eu.rules');
    expect(eu?.indexes).toBe('firebase/firestore.indexes.json');
  });

  it('points storage rules at the firebase/ directory', () => {
    expect(cfg.storage.rules).toBe('firebase/storage.rules');
  });
});

describe('.firebaserc', () => {
  const rc = readJson<{
    projects: { default: string };
    targets: Record<string, { hosting: Record<string, string[]> }>;
  }>('.firebaserc');

  it('declares a default project', () => {
    expect(rc.projects.default).toMatch(/^stageflip-/);
  });

  it('maps every hosting target to a unique site id', () => {
    const hosting = rc.targets['stageflip-prod']?.hosting ?? {};
    const sites = Object.values(hosting).flat();
    expect(new Set(sites).size).toBe(sites.length);
    for (const target of ['docs', 'slide', 'video', 'display']) {
      expect(hosting[target]).toBeDefined();
    }
  });
});

describe('firestore.rules', () => {
  const rules = readText('firebase/firestore.rules');

  it('declares rules_version 2 (latest stable)', () => {
    expect(rules).toContain("rules_version = '2'");
  });

  it('has an explicit deny-by-default fall-through at the bottom', () => {
    expect(rules).toMatch(/match \/\{document=\*\*\}[\s\S]*allow read, write: if false/);
  });

  it('exposes role-aware helpers (viewer/editor/admin/owner)', () => {
    for (const role of ['viewer', 'editor', 'admin', 'owner']) {
      expect(rules).toContain(`'${role}'`);
    }
  });

  it('scopes org collections via isOrgMember', () => {
    expect(rules).toContain('isOrgMember');
    expect(rules).toContain('match /orgs/{orgId}');
  });

  it('gates /users/{userId} by request.auth.uid', () => {
    expect(rules).toMatch(/match \/users\/\{userId\}[\s\S]*request\.auth\.uid == userId/);
  });
});

describe('storage.rules', () => {
  const rules = readText('firebase/storage.rules');

  it('enforces a per-upload size cap', () => {
    expect(rules).toMatch(/request\.resource\.size < \d+ \* 1024 \* 1024/);
  });

  it('has a deny-by-default fall-through', () => {
    expect(rules).toMatch(/match \/\{allPaths=\*\*\}[\s\S]*allow read, write: if false/);
  });

  it('scopes asset writes to org members with at least editor role', () => {
    expect(rules).toMatch(/match \/orgs\/\{orgId\}\/assets/);
    expect(rules).toMatch(/isAtLeast\('editor'\)/);
  });
});
