// packages/plugin/src/index.ts
// @stageflip/plugin — produces the Claude-plugin directory that
// `claude plugin install stageflip` consumes. Packages:
//   - the repo's skills tree as bundled content,
//   - a `.claude-plugin/plugin.json` top-level manifest,
//   - a `.mcp.json` wiring the StageFlip MCP server,
//   - a Google OIDC AuthProvider (T-223 seam) for the install-time
//     OAuth round-trip.

export {
  buildMcpConfig,
  buildPluginManifest,
  type McpConfig,
  type McpConfigInput,
  type McpServerEntry,
  type PluginManifest,
  type PluginManifestInput,
} from './manifest.js';

export {
  bundleSkillsTree,
  hashPluginBundle,
  writePluginBundle,
  type BundleSkillsTreeArgs,
  type BundleSkillsTreeResult,
  type WritePluginBundleArgs,
  type WritePluginBundleResult,
} from './bundle.js';

export {
  createGoogleAuthProvider,
  type GoogleAuthProviderConfig,
} from './google-auth.js';
