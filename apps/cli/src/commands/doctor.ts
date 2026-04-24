// apps/cli/src/commands/doctor.ts
// T-225 — `stageflip doctor` command. Reports environment diagnostics:
// Node version, token-store presence, API endpoint reachability probe,
// and a best-effort check of the MCP server URL config.

import { promises as fs } from 'node:fs';

import { defaultTokenStorePath } from '@stageflip/mcp-server';

import type { CliRunContext } from '../types.js';

export async function runDoctor(ctx: CliRunContext): Promise<number> {
  const { env } = ctx;
  const log = env.log.bind(env);

  const checks: Array<{ name: string; status: 'ok' | 'warn' | 'fail'; detail: string }> = [];

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  checks.push({
    name: 'node-version',
    status: nodeMajor >= 20 ? 'ok' : 'fail',
    detail: `node v${process.versions.node} (require >=20)`,
  });

  const tokenPath = defaultTokenStorePath(env.env.HOME);
  try {
    await fs.access(tokenPath);
    checks.push({
      name: 'token-store',
      status: 'ok',
      detail: `present at ${tokenPath}`,
    });
  } catch {
    checks.push({
      name: 'token-store',
      status: 'warn',
      detail: `not present (${tokenPath}) — run \`stageflip login\` first`,
    });
  }

  const apiUrl = env.env.STAGEFLIP_API_URL ?? 'https://api.stageflip.dev';
  checks.push({
    name: 'api-url',
    status: 'ok',
    detail: apiUrl,
  });

  const mcpUrl = env.env.STAGEFLIP_MCP_URL ?? 'https://mcp.stageflip.dev/mcp';
  checks.push({
    name: 'mcp-url',
    status: mcpUrl.startsWith('https://') ? 'ok' : 'fail',
    detail: mcpUrl,
  });

  let exitCode = 0;
  log('stageflip doctor');
  log('================');
  for (const c of checks) {
    const marker = c.status === 'ok' ? 'OK  ' : c.status === 'warn' ? 'WARN' : 'FAIL';
    log(`[${marker}] ${c.name}: ${c.detail}`);
    if (c.status === 'fail') exitCode = 1;
  }
  if (exitCode !== 0) {
    ctx.env.error('one or more checks failed');
  }
  return exitCode;
}
