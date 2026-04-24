// apps/cli/src/registry.test.ts
// T-225 — command-registry shape + T-226 bridge. Every command in
// user-manual.md §4 has an entry; the `run` functions are mocked
// out by per-command tests elsewhere.

import { describe, expect, it } from 'vitest';

import { CLI_COMMAND_REGISTRY, commandRegistryAsCliReferencePkg } from './registry.js';

describe('CLI_COMMAND_REGISTRY', () => {
  it('has a stageflip binary name', () => {
    expect(CLI_COMMAND_REGISTRY.binaryName).toBe('stageflip');
  });

  it('covers every command named in user-manual.md §4', () => {
    const names = CLI_COMMAND_REGISTRY.commands.map((c) => c.name).sort();
    // Spot-check the most load-bearing names — full list is long.
    expect(names).toContain('new');
    expect(names).toContain('list');
    expect(names).toContain('render');
    expect(names).toContain('export');
    expect(names).toContain('lint');
    expect(names).toContain('validate');
    expect(names).toContain('login');
    expect(names).toContain('logout');
    expect(names).toContain('whoami');
    expect(names).toContain('doctor');
    expect(names).toContain('plugin install');
  });

  it('every command has a non-empty summary', () => {
    for (const c of CLI_COMMAND_REGISTRY.commands) {
      expect(c.summary.length).toBeGreaterThan(0);
    }
  });

  it('every command has a `run` function', () => {
    for (const c of CLI_COMMAND_REGISTRY.commands) {
      expect(typeof c.run).toBe('function');
    }
  });

  it('status flags only permit "shipped" or "stub"', () => {
    for (const c of CLI_COMMAND_REGISTRY.commands) {
      expect(['shipped', 'stub']).toContain(c.status);
    }
  });

  it('shipped commands include login/logout/whoami/doctor/render/export/plugin install', () => {
    const shipped = CLI_COMMAND_REGISTRY.commands
      .filter((c) => c.status === 'shipped')
      .map((c) => c.name);
    expect(shipped).toContain('login');
    expect(shipped).toContain('logout');
    expect(shipped).toContain('whoami');
    expect(shipped).toContain('doctor');
    expect(shipped).toContain('render');
    expect(shipped).toContain('export');
    expect(shipped).toContain('plugin install');
  });
});

describe('commandRegistryAsCliReferencePkg — T-226 bridge', () => {
  it('projects into the CliReferencePkg shape the skills-sync generator expects', () => {
    const pkg = commandRegistryAsCliReferencePkg();
    expect(pkg.binaryName).toBe('stageflip');
    expect(pkg.commands.length).toBe(CLI_COMMAND_REGISTRY.commands.length);
    // CliReferencePkg does not carry the `run` or `status` fields.
    expect(pkg.commands[0]).not.toHaveProperty('run');
    expect(pkg.commands[0]).toHaveProperty('name');
    expect(pkg.commands[0]).toHaveProperty('summary');
    expect(pkg.commands[0]).toHaveProperty('args');
    expect(pkg.commands[0]).toHaveProperty('flags');
  });

  it('is idempotent — same registry → same projection twice', () => {
    const a = commandRegistryAsCliReferencePkg();
    const b = commandRegistryAsCliReferencePkg();
    expect(a).toEqual(b);
  });
});
