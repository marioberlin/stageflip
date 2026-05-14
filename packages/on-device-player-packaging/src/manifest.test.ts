// packages/on-device-player-packaging/src/manifest.test.ts
// Tests for the on-device binary manifest schema + atomic read/write.

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ENABLED_CLIP_FAMILIES,
  type OnDeviceBinaryManifest,
  OnDeviceBinaryManifestParseError,
  onDeviceBinaryManifestSchema,
  readManifest,
  writeManifest,
} from './manifest.js';

function makeManifest(overrides: Partial<OnDeviceBinaryManifest> = {}): OnDeviceBinaryManifest {
  return {
    manifestVersion: 1,
    binaryVersion: '1.2.3',
    tenantId: 'tenant-alpha',
    deviceId: 'device-001',
    enabledPackIds: ['pack-news-pro'],
    enabledClipFamilies: ['shader', 'voice'],
    updateChannel: {
      channel: 'stable',
      endpoint: 'https://updates.example.com/on-device-player',
      publisherKeyId: 'stageflip-prod-2026',
      pollIntervalSec: 3600,
    },
    codeSigningPolicy: {
      enforce: 'strict',
      trustedPublisherKeyIds: ['stageflip-prod-2026'],
      signatureAlgorithm: 'ed25519',
      signatureUri: 'https://updates.example.com/on-device-player.sig',
    },
    health: { probeIntervalSec: 60 },
    ...overrides,
  };
}

describe('onDeviceBinaryManifestSchema — happy path', () => {
  it('accepts a complete valid record', () => {
    const result = onDeviceBinaryManifestSchema.safeParse(makeManifest());
    expect(result.success).toBe(true);
  });

  it('rejects extra top-level keys (.strict())', () => {
    const result = onDeviceBinaryManifestSchema.safeParse({
      ...makeManifest(),
      unknownField: 'oops',
    });
    expect(result.success).toBe(false);
  });
});

describe('binaryVersion regex', () => {
  it('accepts 1.0.0', () => {
    const r = onDeviceBinaryManifestSchema.safeParse(makeManifest({ binaryVersion: '1.0.0' }));
    expect(r.success).toBe(true);
  });
  it('accepts 1.2.3-rc.4', () => {
    const r = onDeviceBinaryManifestSchema.safeParse(makeManifest({ binaryVersion: '1.2.3-rc.4' }));
    expect(r.success).toBe(true);
  });
  it('rejects 1.0 (incomplete)', () => {
    const r = onDeviceBinaryManifestSchema.safeParse(makeManifest({ binaryVersion: '1.0' }));
    expect(r.success).toBe(false);
  });
  it('rejects 1.0.0.0 (too many components)', () => {
    const r = onDeviceBinaryManifestSchema.safeParse(makeManifest({ binaryVersion: '1.0.0.0' }));
    expect(r.success).toBe(false);
  });
  it('rejects 1.0.0-rc (missing rc number)', () => {
    const r = onDeviceBinaryManifestSchema.safeParse(makeManifest({ binaryVersion: '1.0.0-rc' }));
    expect(r.success).toBe(false);
  });
  it('rejects "latest"', () => {
    const r = onDeviceBinaryManifestSchema.safeParse(makeManifest({ binaryVersion: 'latest' }));
    expect(r.success).toBe(false);
  });
});

describe('enabledClipFamilies', () => {
  it('accepts each of the 7 families individually', () => {
    for (const family of ENABLED_CLIP_FAMILIES) {
      const r = onDeviceBinaryManifestSchema.safeParse(
        makeManifest({ enabledClipFamilies: [family] }),
      );
      expect(r.success, `family ${family}`).toBe(true);
    }
  });

  it('rejects unknown family', () => {
    const r = onDeviceBinaryManifestSchema.safeParse(
      // biome-ignore lint/suspicious/noExplicitAny: deliberate bad input for schema test
      makeManifest({ enabledClipFamilies: ['quantum-render' as any] }),
    );
    expect(r.success).toBe(false);
  });
});

describe('enabledPackIds', () => {
  it('accepts empty array', () => {
    const r = onDeviceBinaryManifestSchema.safeParse(makeManifest({ enabledPackIds: [] }));
    expect(r.success).toBe(true);
  });
});

describe('updateChannel.channel', () => {
  it('accepts stable / beta / canary', () => {
    for (const channel of ['stable', 'beta', 'canary'] as const) {
      const m = makeManifest();
      const r = onDeviceBinaryManifestSchema.safeParse({
        ...m,
        updateChannel: { ...m.updateChannel, channel },
      });
      expect(r.success, channel).toBe(true);
    }
  });

  it('rejects other channels', () => {
    const m = makeManifest();
    const r = onDeviceBinaryManifestSchema.safeParse({
      ...m,
      // biome-ignore lint/suspicious/noExplicitAny: deliberate bad input
      updateChannel: { ...m.updateChannel, channel: 'nightly' as any },
    });
    expect(r.success).toBe(false);
  });
});

describe('updateChannel.pollIntervalSec range', () => {
  it('accepts 60 (lower bound) and 86400 (upper)', () => {
    for (const pollIntervalSec of [60, 86400] as const) {
      const m = makeManifest();
      const r = onDeviceBinaryManifestSchema.safeParse({
        ...m,
        updateChannel: { ...m.updateChannel, pollIntervalSec },
      });
      expect(r.success).toBe(true);
    }
  });

  it('rejects 59 and 86401', () => {
    for (const pollIntervalSec of [59, 86401]) {
      const m = makeManifest();
      const r = onDeviceBinaryManifestSchema.safeParse({
        ...m,
        updateChannel: { ...m.updateChannel, pollIntervalSec },
      });
      expect(r.success, String(pollIntervalSec)).toBe(false);
    }
  });
});

describe('codeSigningPolicy.enforce', () => {
  it('accepts strict / warn / off', () => {
    for (const enforce of ['strict', 'warn', 'off'] as const) {
      const m = makeManifest();
      const r = onDeviceBinaryManifestSchema.safeParse({
        ...m,
        codeSigningPolicy: { ...m.codeSigningPolicy, enforce },
      });
      expect(r.success, enforce).toBe(true);
    }
  });
});

describe('codeSigningPolicy.trustedPublisherKeyIds', () => {
  it('rejects empty array', () => {
    const m = makeManifest();
    const r = onDeviceBinaryManifestSchema.safeParse({
      ...m,
      codeSigningPolicy: { ...m.codeSigningPolicy, trustedPublisherKeyIds: [] },
    });
    expect(r.success).toBe(false);
  });
});

describe('health.probeIntervalSec range', () => {
  it('accepts 15 and 3600 (bounds)', () => {
    for (const probeIntervalSec of [15, 3600] as const) {
      const r = onDeviceBinaryManifestSchema.safeParse(
        makeManifest({ health: { probeIntervalSec } }),
      );
      expect(r.success, String(probeIntervalSec)).toBe(true);
    }
  });

  it('rejects 14 and 3601', () => {
    for (const probeIntervalSec of [14, 3601]) {
      const r = onDeviceBinaryManifestSchema.safeParse(
        makeManifest({ health: { probeIntervalSec } }),
      );
      expect(r.success, String(probeIntervalSec)).toBe(false);
    }
  });
});

describe('readManifest / writeManifest round-trip', () => {
  it('round-trips a written manifest', () => {
    const dir = mkdtempSync(join(tmpdir(), 'on-device-manifest-rt-'));
    try {
      const path = join(dir, 'manifest.json');
      const original = makeManifest({
        enabledPackIds: ['pack-finance', 'pack-creator-style'],
        enabledClipFamilies: ['shader', 'three-scene', 'ai-chat'],
      });
      writeManifest(path, original);
      const reread = readManifest(path);
      expect(reread).toEqual(original);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('readManifest rejects unparseable JSON with OnDeviceBinaryManifestParseError', () => {
    const dir = mkdtempSync(join(tmpdir(), 'on-device-manifest-bad-json-'));
    try {
      const path = join(dir, 'manifest.json');
      writeFileSync(path, '{not valid json}');
      expect(() => readManifest(path)).toThrow(OnDeviceBinaryManifestParseError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('readManifest rejects schema-invalid JSON with OnDeviceBinaryManifestParseError', () => {
    const dir = mkdtempSync(join(tmpdir(), 'on-device-manifest-bad-schema-'));
    try {
      const path = join(dir, 'manifest.json');
      writeFileSync(path, JSON.stringify({ manifestVersion: 1 }));
      expect(() => readManifest(path)).toThrow(OnDeviceBinaryManifestParseError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('readManifest reports unreadable path with OnDeviceBinaryManifestParseError', () => {
    expect(() => readManifest('/no/such/file/__on_device_manifest__.json')).toThrow(
      OnDeviceBinaryManifestParseError,
    );
  });
});

describe('writeManifest atomicity', () => {
  it('leaves no .tmp* sibling behind after a successful write', () => {
    const dir = mkdtempSync(join(tmpdir(), 'on-device-manifest-atomic-'));
    try {
      const path = join(dir, 'manifest.json');
      writeManifest(path, makeManifest());
      const entries = readdirSync(dir);
      // The successful path renames temp → final, so no `.tmp.*` siblings.
      expect(entries).toContain('manifest.json');
      expect(entries.filter((e) => e.includes('.tmp.'))).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not destroy original on a failing rename target', () => {
    const dir = mkdtempSync(join(tmpdir(), 'on-device-manifest-atomic-fail-'));
    try {
      const path = join(dir, 'manifest.json');
      writeManifest(path, makeManifest());
      const before = readFileSync(path, 'utf-8');

      // Trying to write to a path whose parent does not exist throws —
      // the original file at `path` must remain intact.
      expect(() =>
        writeManifest('/no/such/dir/__on_device_manifest__.json', makeManifest()),
      ).toThrow();

      const after = readFileSync(path, 'utf-8');
      expect(after).toBe(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
