// packages/runtimes/interactive/src/clips/three-scene/setup-resolver.test.ts
// T-384 AC #10 — setupRef dynamic-import + named symbol resolution.
// R-4 (security review §5 R-4) — trustedPublisherKeyIds allowlist closure
// (PO decision; mirrors T-404 R-1 LiveData SSRF allowlist convention).

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SETUP_REF_TRUSTED_MODULE_PREFIXES,
  __resetTrustedModulePrefixesForTests,
  extendTrustedModulePrefixes,
  resolveSetupRef,
} from './setup-resolver.js';

describe('resolveSetupRef (T-384 D-T384-3)', () => {
  // Seed the allowlist so the legacy happy-path tests (which use
  // `@author/scene#MySetup`) continue to permit the importer call.
  // Mirrors `live-data-props.test.ts` and the T-404 R-2 pattern in
  // `scripts/check-preset-integrity.test.ts`.
  beforeEach(() => {
    __resetTrustedModulePrefixesForTests();
    extendTrustedModulePrefixes(['@author/', '@stageflip/']);
  });

  it('throws when the ref does not contain a # separator', async () => {
    await expect(resolveSetupRef({ module: 'just-a-string' })).rejects.toThrow();
  });

  it('throws when the package cannot be dynamically imported', async () => {
    await expect(
      resolveSetupRef({ module: '@author/this-package-does-not-exist#MySetup' }),
    ).rejects.toThrow();
  });

  it('resolves a named export via an injected importer', async () => {
    const fakeModule = {
      MySetup: () => ({ render: () => undefined, dispose: () => undefined }),
    };
    const fn = await resolveSetupRef(
      { module: '@author/scene#MySetup' },
      { importer: async () => fakeModule },
    );
    expect(typeof fn).toBe('function');
  });

  it('throws when the named symbol is not present on the module', async () => {
    const fakeModule = { Other: () => undefined };
    await expect(
      resolveSetupRef({ module: '@author/scene#MySetup' }, { importer: async () => fakeModule }),
    ).rejects.toThrow(/MySetup/);
  });

  it('throws when the resolved symbol is not a function', async () => {
    const fakeModule = { MySetup: 42 };
    await expect(
      resolveSetupRef({ module: '@author/scene#MySetup' }, { importer: async () => fakeModule }),
    ).rejects.toThrow(/function/);
  });
});

describe('resolveSetupRef — trustedPublisherKeyIds allowlist (R-4)', () => {
  beforeEach(() => {
    __resetTrustedModulePrefixesForTests();
  });

  it('R-4 — empty allowlist rejects any modulePath (deny-all default)', async () => {
    await expect(
      resolveSetupRef(
        { module: '@stageflip/pack-frontier-fx#MySetup' },
        { importer: async () => ({ MySetup: () => undefined }) },
      ),
    ).rejects.toThrow(/trustedPublisherKeyIds allowlist \(security review R-4\)/);
    await expect(
      resolveSetupRef(
        { module: '@author/scene#MySetup' },
        { importer: async () => ({ MySetup: () => undefined }) },
      ),
    ).rejects.toThrow(/trustedPublisherKeyIds allowlist \(security review R-4\)/);
  });

  it('R-4 — extendTrustedModulePrefixes permits prefix-matching module path', async () => {
    extendTrustedModulePrefixes(['@stageflip/']);
    const fn = await resolveSetupRef(
      { module: '@stageflip/pack-frontier-fx#MySetup' },
      { importer: async () => ({ MySetup: () => undefined }) },
    );
    expect(typeof fn).toBe('function');
  });

  it('R-4 — module path outside seeded prefix is rejected', async () => {
    extendTrustedModulePrefixes(['@stageflip/']);
    await expect(
      resolveSetupRef(
        { module: '@notallowed/pack-foo#MySetup' },
        { importer: async () => ({ MySetup: () => undefined }) },
      ),
    ).rejects.toThrow(/trustedPublisherKeyIds allowlist \(security review R-4\)/);
  });

  it('R-4 — multiple extendTrustedModulePrefixes calls merge (no replace semantics)', async () => {
    extendTrustedModulePrefixes(['@stageflip/']);
    extendTrustedModulePrefixes(['@partner/']);
    // First extension still effective.
    const fnA = await resolveSetupRef(
      { module: '@stageflip/pack-x#A' },
      { importer: async () => ({ A: () => undefined }) },
    );
    expect(typeof fnA).toBe('function');
    // Second extension also effective.
    const fnB = await resolveSetupRef(
      { module: '@partner/pack-y#B' },
      { importer: async () => ({ B: () => undefined }) },
    );
    expect(typeof fnB).toBe('function');
    expect(SETUP_REF_TRUSTED_MODULE_PREFIXES()).toEqual(['@stageflip/', '@partner/']);
  });

  it('R-4 — duplicate prefixes are deduplicated on merge', () => {
    extendTrustedModulePrefixes(['@stageflip/']);
    extendTrustedModulePrefixes(['@stageflip/']);
    expect(SETUP_REF_TRUSTED_MODULE_PREFIXES()).toHaveLength(1);
  });

  it('R-4 — __resetTrustedModulePrefixesForTests clears the allowlist back to deny-all', async () => {
    extendTrustedModulePrefixes(['@stageflip/']);
    // First confirm the prefix permits.
    const fn = await resolveSetupRef(
      { module: '@stageflip/x#S' },
      { importer: async () => ({ S: () => undefined }) },
    );
    expect(typeof fn).toBe('function');
    __resetTrustedModulePrefixesForTests();
    expect(SETUP_REF_TRUSTED_MODULE_PREFIXES()).toHaveLength(0);
    await expect(
      resolveSetupRef(
        { module: '@stageflip/x#S' },
        { importer: async () => ({ S: () => undefined }) },
      ),
    ).rejects.toThrow(/trustedPublisherKeyIds allowlist \(security review R-4\)/);
  });

  it('R-4 — allowlist gate runs BEFORE the importer call (importer never invoked when rejected)', async () => {
    // No seed → deny-all. A stub importer that throws on call would
    // poison the test if invoked; instead we use a spy that asserts
    // zero calls AFTER the rejection.
    const importer = vi.fn(async (_path: string) => {
      throw new Error('importer should NOT have been called');
    });
    await expect(resolveSetupRef({ module: '@anything/at-all#Sym' }, { importer })).rejects.toThrow(
      /trustedPublisherKeyIds allowlist \(security review R-4\)/,
    );
    expect(importer).not.toHaveBeenCalled();
  });

  it('R-4 — SETUP_REF_TRUSTED_MODULE_PREFIXES returns a fresh snapshot (mutating result does not affect state)', async () => {
    extendTrustedModulePrefixes(['@stageflip/']);
    const snapshot = SETUP_REF_TRUSTED_MODULE_PREFIXES() as string[];
    snapshot.length = 0;
    // Underlying state still permits.
    const fn = await resolveSetupRef(
      { module: '@stageflip/x#S' },
      { importer: async () => ({ S: () => undefined }) },
    );
    expect(typeof fn).toBe('function');
  });
});
