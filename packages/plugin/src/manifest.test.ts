// packages/plugin/src/manifest.test.ts
// T-224 — unit coverage for the plugin manifest + .mcp.json builders.

import { describe, expect, it } from 'vitest';

import { buildMcpConfig, buildPluginManifest } from './manifest.js';

describe('buildPluginManifest', () => {
  it('emits the minimum Claude-plugin fields the registry requires', () => {
    const manifest = buildPluginManifest({
      name: 'stageflip',
      version: '0.1.0',
      description: 'Motion platform.',
      author: { name: 'StageFlip' },
    });
    expect(manifest).toEqual({
      name: 'stageflip',
      version: '0.1.0',
      description: 'Motion platform.',
      author: { name: 'StageFlip' },
    });
  });

  it('rejects a missing version (SemVer required)', () => {
    expect(() =>
      buildPluginManifest({
        name: 'stageflip',
        version: 'not-a-version',
        description: 'x',
        author: { name: 'y' },
      }),
    ).toThrow(/semver|version/i);
  });

  it('rejects a non-kebab-case name', () => {
    expect(() =>
      buildPluginManifest({
        name: 'StageFlip',
        version: '0.1.0',
        description: 'x',
        author: { name: 'y' },
      }),
    ).toThrow(/kebab|name/i);
  });

  it('surfaces an optional homepage field when provided', () => {
    const manifest = buildPluginManifest({
      name: 'stageflip',
      version: '0.1.0',
      description: 'x',
      author: { name: 'y' },
      homepage: 'https://stageflip.dev',
    });
    expect(manifest.homepage).toBe('https://stageflip.dev');
  });
});

describe('buildMcpConfig', () => {
  it('wires a single http MCP server entry keyed "stageflip"', () => {
    const cfg = buildMcpConfig({ serverUrl: 'https://mcp.stageflip.dev/mcp' });
    expect(cfg).toEqual({
      mcpServers: {
        stageflip: { type: 'http', url: 'https://mcp.stageflip.dev/mcp' },
      },
    });
  });

  it('rejects a non-HTTPS URL — MCP sessions must terminate over TLS', () => {
    expect(() => buildMcpConfig({ serverUrl: 'http://mcp.stageflip.dev/mcp' })).toThrow(/https/i);
  });

  it('rejects a malformed URL', () => {
    expect(() => buildMcpConfig({ serverUrl: 'not-a-url' })).toThrow(/url/i);
  });

  it('honours an optional custom server name (multi-deployment use)', () => {
    const cfg = buildMcpConfig({
      serverUrl: 'https://mcp.stageflip.dev/mcp',
      serverName: 'stageflip-eu',
    });
    expect(cfg.mcpServers['stageflip-eu']).toBeDefined();
    expect(cfg.mcpServers.stageflip).toBeUndefined();
  });
});
