// infra/tests/dockerfile.test.ts
// T-231 — lightweight Dockerfile shape assertions. Full `docker build`
// runs in the deploy workflow (needs daemon access); this suite
// catches structural regressions (missing runtime stage, missing
// CMD, running as root) without that heavy dep.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readDockerfile(relative: string): string {
  return readFileSync(path.join(ROOT, relative), 'utf8');
}

function assertBaseShape(dockerfile: string): void {
  expect(dockerfile).toMatch(/FROM\s+node:22-alpine\s+AS\s+builder/);
  expect(dockerfile).toMatch(/FROM\s+node:22-alpine\s+AS\s+runner/);
  expect(dockerfile).toMatch(/WORKDIR\s+\/app/);
  expect(dockerfile).toMatch(/USER\s+app/);
  expect(dockerfile).toMatch(/CMD\s+\[/);
}

describe('apps/api/Dockerfile', () => {
  const df = readDockerfile('apps/api/Dockerfile');

  it('has a multi-stage builder + runner layout', () => {
    assertBaseShape(df);
  });

  it('runs the API bin', () => {
    expect(df).toContain('dist/bin.js');
  });

  it('builds the MCP-server workspace dep before the app', () => {
    expect(df).toMatch(/pnpm --filter "@stageflip\/mcp-server\.\.\." run build/);
  });

  it('exposes the Cloud Run default PORT', () => {
    expect(df).toMatch(/ENV PORT=8080/);
    expect(df).toMatch(/EXPOSE 8080/);
  });

  it('drops root via addgroup/adduser', () => {
    expect(df).toContain('addgroup -S app');
    expect(df).toContain('adduser -S app -G app');
  });
});

describe('apps/render-worker/Dockerfile', () => {
  const df = readDockerfile('apps/render-worker/Dockerfile');

  it('has a multi-stage builder + runner layout', () => {
    assertBaseShape(df);
  });

  it('runs the worker bin', () => {
    expect(df).toContain('dist/bin.js');
  });

  it('does not EXPOSE a port (Cloud Run Jobs do not listen)', () => {
    expect(df).not.toContain('EXPOSE');
  });

  it('deploys the render-worker workspace via pnpm deploy --prod', () => {
    expect(df).toMatch(/pnpm --filter "@stageflip\/app-render-worker" deploy --prod/);
  });
});
