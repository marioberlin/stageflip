// packages/marketplace-registry/src/handler.test.ts
// T-536 — Tests for the composed top-level handler: routing, method
// dispatch, 404 / 405 / 500 fall-throughs, and the convenience
// constructor.

import { describe, expect, it } from 'vitest';

import { composeHandler, createInMemoryRegistry } from './handler.js';
import type { RouteHandler, RouteRequest } from './routes/types.js';
import { makeRegistryDeps, makeSignedPack } from './test-helpers.js';

function req(method: string, path: string, opts: Partial<RouteRequest> = {}): RouteRequest {
  return {
    method,
    path,
    headers: opts.headers ?? {},
    body: opts.body,
    query: opts.query ?? {},
  };
}

describe('composeHandler', () => {
  it('returns 404 on unknown route', async () => {
    const deps = makeRegistryDeps({ tokens: [{ token: 'tok', publisherId: 'p' }] });
    const handler = composeHandler(deps);
    const res = await handler(req('GET', '/no/such/route'));
    expect(res.status).toBe(404);
  });

  it('returns 405 on method-not-allowed for /api/v1/packs', async () => {
    const deps = makeRegistryDeps({ tokens: [{ token: 'tok', publisherId: 'p' }] });
    const handler = composeHandler(deps);
    const res = await handler(req('DELETE', '/api/v1/packs'));
    expect(res.status).toBe(405);
  });

  it('returns 405 on method-not-allowed for download path', async () => {
    const deps = makeRegistryDeps({ tokens: [{ token: 'tok', publisherId: 'p' }] });
    const handler = composeHandler(deps);
    const res = await handler(req('POST', '/api/v1/packs/p/i/1.0.0'));
    expect(res.status).toBe(405);
  });

  it('routes POST /api/v1/packs to publish', async () => {
    const deps = makeRegistryDeps({ tokens: [{ token: 'tok', publisherId: 'stageflip' }] });
    const handler = composeHandler(deps);
    const pack = makeSignedPack({ publisherId: 'stageflip' });
    const res = await handler(
      req('POST', '/api/v1/packs', {
        headers: { authorization: 'Bearer tok' },
        body: JSON.stringify({
          packId: 'demo',
          version: '1.0.0',
          manifest: pack.manifest,
          archiveBase64: pack.archiveBase64,
          signatureBase64: pack.signatureBase64,
          publisherPublicKeyPem: pack.publicKeyPem,
        }),
      }),
    );
    expect(res.status).toBe(201);
  });

  it('routes GET /api/v1/packs to list', async () => {
    const deps = makeRegistryDeps({ tokens: [{ token: 'tok', publisherId: 'p' }] });
    const handler = composeHandler(deps);
    const res = await handler(
      req('GET', '/api/v1/packs', { headers: { authorization: 'Bearer tok' } }),
    );
    expect(res.status).toBe(200);
  });

  it('routes GET /api/v1/packs/:p/:i/:v to download', async () => {
    const deps = makeRegistryDeps({ tokens: [{ token: 'tok', publisherId: 'p' }] });
    const handler = composeHandler(deps);
    const res = await handler(
      req('GET', '/api/v1/packs/p/i/1.0.0', { headers: { authorization: 'Bearer tok' } }),
    );
    // 404 since nothing is published, but the route IS dispatched
    // (a non-matching path would return 404 with reason "no-such-route").
    expect(res.status).toBe(404);
    const body = JSON.parse(res.body as string) as { reason?: string };
    expect(body.reason).toContain('pack-or-version-missing');
  });

  it('returns 500 when a route handler throws', async () => {
    // Inject a storage adapter whose getManifest throws to force the
    // 500 fall-through.
    const deps = makeRegistryDeps({ tokens: [{ token: 'tok', publisherId: 'p' }] });
    const throwingStorage = {
      putArchive: deps.storage.putArchive,
      getArchive: deps.storage.getArchive,
      putManifest: deps.storage.putManifest,
      listKeys: deps.storage.listKeys,
      signedUrl: deps.storage.signedUrl,
      getManifest: async (_key: string): Promise<string | null> => {
        throw new Error('boom');
      },
    };
    const handler: RouteHandler = composeHandler({ ...deps, storage: throwingStorage });
    const res = await handler(
      req('GET', '/api/v1/packs/p/i/1.0.0', { headers: { authorization: 'Bearer tok' } }),
    );
    expect(res.status).toBe(500);
    expect((res.body as string).includes('handler-threw')).toBe(true);
  });

  it('createInMemoryRegistry wires all three in-memory stores', async () => {
    const deps = createInMemoryRegistry({ tokens: [{ token: 'tok', publisherId: 'p' }] });
    const handler = composeHandler(deps);
    const res = await handler(
      req('GET', '/api/v1/packs', { headers: { authorization: 'Bearer tok' } }),
    );
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body as string) as { packs: unknown[] };
    expect(body.packs).toEqual([]);
  });

  it('protected route returns 401 when authorization header is missing', async () => {
    const deps = createInMemoryRegistry({ tokens: [{ token: 'tok', publisherId: 'p' }] });
    const handler = composeHandler(deps);
    const res = await handler(req('GET', '/api/v1/packs'));
    expect(res.status).toBe(401);
  });
});
