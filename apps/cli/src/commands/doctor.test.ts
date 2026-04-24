// apps/cli/src/commands/doctor.test.ts

import { promises as fs, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CliEnv } from '../types.js';
import { runDoctor } from './doctor.js';

let workDir: string;
let logs: string[];
let errors: string[];

function envFor(overrides: Record<string, string | undefined> = {}): CliEnv {
  logs = [];
  errors = [];
  return {
    cwd: workDir,
    env: { HOME: workDir, ...overrides },
    log: (line) => logs.push(line),
    error: (line) => errors.push(line),
    exit: (code) => {
      throw new Error(`exit(${code})`);
    },
  };
}

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'stageflip-doctor-'));
});
afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

describe('doctor', () => {
  it('reports node version, api url, mcp url, and token-store presence', async () => {
    const env = envFor();
    const code = await runDoctor({ env, args: [], flags: {} });
    expect(code).toBe(0);
    expect(logs.join('\n')).toContain('node-version');
    expect(logs.join('\n')).toContain('api-url');
    expect(logs.join('\n')).toContain('mcp-url');
    expect(logs.join('\n')).toContain('token-store');
  });

  it('warns when no token store is present', async () => {
    const env = envFor();
    await runDoctor({ env, args: [], flags: {} });
    expect(logs.some((l) => l.includes('WARN') && l.includes('token-store'))).toBe(true);
  });

  it('reports OK when the token store exists', async () => {
    const tokenPath = path.join(workDir, '.config', 'stageflip', 'auth.json');
    await fs.mkdir(path.dirname(tokenPath), { recursive: true });
    await fs.writeFile(tokenPath, '{}');
    const env = envFor();
    await runDoctor({ env, args: [], flags: {} });
    expect(logs.some((l) => l.includes('OK') && l.includes('token-store'))).toBe(true);
  });

  it('exits non-zero when the mcp url is not https', async () => {
    const env = envFor({ STAGEFLIP_MCP_URL: 'http://mcp.dev/mcp' });
    const code = await runDoctor({ env, args: [], flags: {} });
    expect(code).toBe(1);
    expect(errors.length).toBeGreaterThan(0);
  });
});
