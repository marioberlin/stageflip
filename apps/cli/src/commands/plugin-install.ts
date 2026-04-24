// apps/cli/src/commands/plugin-install.ts
// T-225 — `stageflip plugin install [dest]`. Uses T-224's
// `writePluginBundle` to produce the Claude-plugin directory
// layout. Defaults to `./stageflip-plugin`; reads the skills tree
// from `$STAGEFLIP_SKILLS_DIR` or `<cwd>/skills/stageflip`.

import path from 'node:path';

import { writePluginBundle } from '@stageflip/plugin';

import type { CliRunContext } from '../types.js';

const PACKAGE_VERSION = '0.1.0';

export async function runPluginInstall(ctx: CliRunContext): Promise<number> {
  const [destArg] = ctx.args;
  const destination = destArg ?? path.join(ctx.env.cwd, 'stageflip-plugin');
  const skillsSource =
    ctx.env.env.STAGEFLIP_SKILLS_DIR ?? path.join(ctx.env.cwd, 'skills', 'stageflip');
  const mcpUrl = ctx.env.env.STAGEFLIP_MCP_URL ?? 'https://mcp.stageflip.dev/mcp';

  try {
    const result = await writePluginBundle({
      destination,
      skillsSource,
      manifest: {
        name: 'stageflip',
        version: PACKAGE_VERSION,
        description: 'AI-native motion platform — slides, video, display.',
        author: { name: 'StageFlip' },
      },
      mcp: { serverUrl: mcpUrl },
    });
    ctx.env.log(`plugin bundled at ${destination}`);
    ctx.env.log(`  skills bundled: ${result.filesCopied}`);
    ctx.env.log(`  content hash:   ${result.contentHash}`);
    ctx.env.log(`  mcp url:        ${mcpUrl}`);
    return 0;
  } catch (err) {
    ctx.env.error(`plugin install failed: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}
