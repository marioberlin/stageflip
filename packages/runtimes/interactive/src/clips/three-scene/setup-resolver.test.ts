// packages/runtimes/interactive/src/clips/three-scene/setup-resolver.test.ts
// T-384 AC #10 — setupRef dynamic-import + named symbol resolution.

import { describe, expect, it } from 'vitest';

import { resolveSetupRef } from './setup-resolver.js';

describe('resolveSetupRef (T-384 D-T384-3)', () => {
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
