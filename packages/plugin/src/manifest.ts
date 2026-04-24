// packages/plugin/src/manifest.ts
// T-224 — pure builders for the two JSON manifests the Claude plugin
// ships: `.claude-plugin/plugin.json` (top-level metadata) and
// `.mcp.json` (MCP server wiring). Kept side-effect-free so
// `writePluginBundle` (bundle.ts) and any future "publish" tooling
// share one source of truth + one validation pass.

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[\w.+-]+)?$/;

export interface PluginManifestInput {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: { readonly name: string; readonly url?: string };
  readonly homepage?: string;
}

export interface PluginManifest {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: { readonly name: string; readonly url?: string };
  readonly homepage?: string;
}

export function buildPluginManifest(input: PluginManifestInput): PluginManifest {
  if (!NAME_PATTERN.test(input.name)) {
    throw new Error(`plugin manifest: name must be lowercase-kebab-case (got "${input.name}")`);
  }
  if (!SEMVER_PATTERN.test(input.version)) {
    throw new Error(`plugin manifest: version must be SemVer (got "${input.version}")`);
  }
  if (input.description.trim().length === 0) {
    throw new Error('plugin manifest: description must be non-empty');
  }
  return {
    name: input.name,
    version: input.version,
    description: input.description,
    author: input.author.url
      ? { name: input.author.name, url: input.author.url }
      : { name: input.author.name },
    ...(input.homepage !== undefined ? { homepage: input.homepage } : {}),
  };
}

export interface McpConfigInput {
  readonly serverUrl: string;
  /** Defaults to `"stageflip"`. Multi-deploy installs use e.g. `"stageflip-eu"`. */
  readonly serverName?: string;
}

export interface McpServerEntry {
  readonly type: 'http';
  readonly url: string;
}

export interface McpConfig {
  readonly mcpServers: Readonly<Record<string, McpServerEntry>>;
}

export function buildMcpConfig(input: McpConfigInput): McpConfig {
  let parsed: URL;
  try {
    parsed = new URL(input.serverUrl);
  } catch {
    throw new Error(`mcp config: invalid URL "${input.serverUrl}"`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`mcp config: MCP server URL must use https:// (got "${parsed.protocol}//…")`);
  }
  const key = input.serverName ?? 'stageflip';
  if (!NAME_PATTERN.test(key)) {
    throw new Error(`mcp config: server name must be lowercase-kebab-case (got "${key}")`);
  }
  return {
    mcpServers: {
      [key]: { type: 'http', url: input.serverUrl },
    },
  };
}
