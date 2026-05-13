// packages/marketplace-registry/src/routes/download.test.ts
// T-536 — Tests for the download routes.

import { describe, expect, it } from 'vitest';

import { makeRegistryDeps, makeSignedPack } from '../test-helpers.js';
import { createDownloadHandler } from './download.js';
import { createPublishHandler } from './publish.js';
import type { RouteRequest } from './types.js';

async function seedPack(deps: ReturnType<typeof makeRegistryDeps>, bearer: string): Promise<void> {
  const pack = makeSignedPack({ publisherId: 'stageflip', id: 'demo', version: '1.0.0' });
  const handler = createPublishHandler(deps);
  const res = await handler({
    method: 'POST',
    path: '/api/v1/packs',
    headers: { authorization: `Bearer ${bearer}` },
    body: JSON.stringify({
      packId: 'demo',
      version: '1.0.0',
      manifest: pack.manifest,
      archiveBase64: pack.archiveBase64,
      signatureBase64: pack.signatureBase64,
      publisherPublicKeyPem: pack.publicKeyPem,
    }),
    query: {},
  });
  if (res.status !== 201) {
    throw new Error(`seed publish failed: ${res.status} ${res.body as string}`);
  }
}

function downloadRequest(path: string, bearer: string | undefined): RouteRequest {
  return {
    method: 'GET',
    path,
    headers: bearer === undefined ? {} : { authorization: `Bearer ${bearer}` },
    body: undefined,
    query: {},
  };
}

describe('download handler', () => {
  it('returns 200 + manifest + signed URL grant on happy path', async () => {
    const deps = makeRegistryDeps({
      tokens: [{ token: 'tok', publisherId: 'stageflip' }],
    });
    await seedPack(deps, 'tok');
    const handler = createDownloadHandler(deps);

    const res = await handler(downloadRequest('/api/v1/packs/stageflip/demo/1.0.0', 'tok'));
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body as string) as {
      manifest: { id: string };
      archiveUrl: string;
      archiveUrlTtlSeconds: number;
    };
    expect(body.manifest.id).toBe('demo');
    expect(body.archiveUrl).toContain('archives/stageflip/demo/1.0.0/');
    expect(body.archiveUrlTtlSeconds).toBe(300);
  });

  it('returns 302 redirect on /archive subpath', async () => {
    const deps = makeRegistryDeps({
      tokens: [{ token: 'tok', publisherId: 'stageflip' }],
    });
    await seedPack(deps, 'tok');
    const handler = createDownloadHandler(deps);
    const res = await handler(downloadRequest('/api/v1/packs/stageflip/demo/1.0.0/archive', 'tok'));
    expect(res.status).toBe(302);
    expect(res.headers?.location).toContain('archives/stageflip/demo/1.0.0/');
  });

  it('returns 404 on missing pack', async () => {
    const deps = makeRegistryDeps({ tokens: [{ token: 'tok', publisherId: 'stageflip' }] });
    const handler = createDownloadHandler(deps);
    const res = await handler(downloadRequest('/api/v1/packs/stageflip/no-such/1.0.0', 'tok'));
    expect(res.status).toBe(404);
  });

  it('returns 400 on malformed version', async () => {
    const deps = makeRegistryDeps({ tokens: [{ token: 'tok', publisherId: 'stageflip' }] });
    const handler = createDownloadHandler(deps);
    const res = await handler(downloadRequest('/api/v1/packs/stageflip/demo/not-semver', 'tok'));
    expect(res.status).toBe(400);
    expect((res.body as string).includes('malformed-version')).toBe(true);
  });

  it('returns 401 on missing bearer', async () => {
    const deps = makeRegistryDeps({ tokens: [{ token: 'tok', publisherId: 'stageflip' }] });
    const handler = createDownloadHandler(deps);
    const res = await handler(downloadRequest('/api/v1/packs/stageflip/demo/1.0.0', undefined));
    expect(res.status).toBe(401);
  });

  it('returns 401 on invalid bearer', async () => {
    const deps = makeRegistryDeps({ tokens: [{ token: 'tok', publisherId: 'stageflip' }] });
    await seedPack(deps, 'tok');
    const handler = createDownloadHandler(deps);
    const res = await handler(downloadRequest('/api/v1/packs/stageflip/demo/1.0.0', 'wrong-token'));
    expect(res.status).toBe(401);
  });
});
