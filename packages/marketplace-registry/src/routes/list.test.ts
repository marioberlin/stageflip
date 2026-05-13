// packages/marketplace-registry/src/routes/list.test.ts
// T-536 — Tests for `GET /api/v1/packs`.

import { describe, expect, it } from 'vitest';

import { makeRegistryDeps, makeSignedPack } from '../test-helpers.js';
import { createListHandler } from './list.js';
import { createPublishHandler } from './publish.js';
import type { RouteRequest } from './types.js';

function listRequest(bearer: string | undefined, query: Record<string, string> = {}): RouteRequest {
  return {
    method: 'GET',
    path: '/api/v1/packs',
    headers: bearer === undefined ? {} : { authorization: `Bearer ${bearer}` },
    body: undefined,
    query,
  };
}

async function publish(
  deps: ReturnType<typeof makeRegistryDeps>,
  bearer: string,
  publisherId: string,
  packId: string,
  version: string,
  reusePrivateKeyPem?: string,
): Promise<void> {
  const handler = createPublishHandler(deps);
  let pack = makeSignedPack({ id: packId, version, publisherId });
  if (reusePrivateKeyPem) {
    // Re-sign with the supplied key so the TOFU check passes for
    // subsequent publishes for the same publisher.
    const { signPackArchive } = await import('@stageflip/pack-format');
    const { createPublicKey } = await import('node:crypto');
    const signatureBytes = signPackArchive(pack.archiveBytes, reusePrivateKeyPem);
    const publicKeyPem = createPublicKey(reusePrivateKeyPem)
      .export({ type: 'spki', format: 'pem' })
      .toString();
    pack = {
      ...pack,
      privateKeyPem: reusePrivateKeyPem,
      publicKeyPem,
      signatureBytes,
      signatureBase64: Buffer.from(signatureBytes).toString('base64'),
    };
  }
  const res = await handler({
    method: 'POST',
    path: '/api/v1/packs',
    headers: { authorization: `Bearer ${bearer}` },
    body: JSON.stringify({
      packId,
      version,
      manifest: pack.manifest,
      archiveBase64: pack.archiveBase64,
      signatureBase64: pack.signatureBase64,
      publisherPublicKeyPem: pack.publicKeyPem,
    }),
    query: {},
  });
  if (res.status !== 201) {
    throw new Error(`publish failed: ${res.status} ${res.body as string}`);
  }
}

describe('list handler', () => {
  it('returns 200 + empty array on empty registry', async () => {
    const deps = makeRegistryDeps({
      tokens: [{ token: 'tok', publisherId: 'stageflip' }],
    });
    const handler = createListHandler(deps);
    const res = await handler(listRequest('tok'));
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body as string) as { packs: unknown[] };
    expect(body.packs).toEqual([]);
  });

  it('returns 401 on missing bearer', async () => {
    const deps = makeRegistryDeps({ tokens: [{ token: 'tok', publisherId: 'p' }] });
    const handler = createListHandler(deps);
    const res = await handler(listRequest(undefined));
    expect(res.status).toBe(401);
  });

  it('lists multiple packs', async () => {
    const deps = makeRegistryDeps({
      tokens: [{ token: 'tok', publisherId: 'stageflip' }],
    });
    // Publish three packs from the same publisher; reuse the first
    // pack's keypair so TOFU passes on the later publishes.
    const handler = createPublishHandler(deps);
    const first = makeSignedPack({ publisherId: 'stageflip', id: 'pack-a', version: '1.0.0' });
    const r1 = await handler({
      method: 'POST',
      path: '/api/v1/packs',
      headers: { authorization: 'Bearer tok' },
      body: JSON.stringify({
        packId: 'pack-a',
        version: '1.0.0',
        manifest: first.manifest,
        archiveBase64: first.archiveBase64,
        signatureBase64: first.signatureBase64,
        publisherPublicKeyPem: first.publicKeyPem,
      }),
      query: {},
    });
    expect(r1.status).toBe(201);
    await publish(deps, 'tok', 'stageflip', 'pack-a', '1.1.0', first.privateKeyPem);
    await publish(deps, 'tok', 'stageflip', 'pack-b', '2.0.0', first.privateKeyPem);

    const list = await createListHandler(deps)(listRequest('tok'));
    expect(list.status).toBe(200);
    const body = JSON.parse(list.body as string) as {
      packs: { publisherId: string; packId: string; version: string }[];
    };
    expect(body.packs.length).toBe(3);
    // Sorted ascending
    expect(body.packs.map((p) => `${p.packId}@${p.version}`)).toEqual([
      'pack-a@1.0.0',
      'pack-a@1.1.0',
      'pack-b@2.0.0',
    ]);
  });

  it('filters by ?publisher=<id>', async () => {
    const deps = makeRegistryDeps({
      tokens: [
        { token: 'tok-a', publisherId: 'publisher-a' },
        { token: 'tok-b', publisherId: 'publisher-b' },
      ],
    });
    // Two publishers, one pack each
    const packA = makeSignedPack({ publisherId: 'publisher-a', id: 'pack-x', version: '1.0.0' });
    const packB = makeSignedPack({ publisherId: 'publisher-b', id: 'pack-y', version: '1.0.0' });
    const pub = createPublishHandler(deps);
    expect(
      (
        await pub({
          method: 'POST',
          path: '/api/v1/packs',
          headers: { authorization: 'Bearer tok-a' },
          body: JSON.stringify({
            packId: 'pack-x',
            version: '1.0.0',
            manifest: packA.manifest,
            archiveBase64: packA.archiveBase64,
            signatureBase64: packA.signatureBase64,
            publisherPublicKeyPem: packA.publicKeyPem,
          }),
          query: {},
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await pub({
          method: 'POST',
          path: '/api/v1/packs',
          headers: { authorization: 'Bearer tok-b' },
          body: JSON.stringify({
            packId: 'pack-y',
            version: '1.0.0',
            manifest: packB.manifest,
            archiveBase64: packB.archiveBase64,
            signatureBase64: packB.signatureBase64,
            publisherPublicKeyPem: packB.publicKeyPem,
          }),
          query: {},
        })
      ).status,
    ).toBe(201);

    const handler = createListHandler(deps);
    const onlyA = await handler(listRequest('tok-a', { publisher: 'publisher-a' }));
    const bodyA = JSON.parse(onlyA.body as string) as {
      packs: { publisherId: string }[];
    };
    expect(bodyA.packs.length).toBe(1);
    expect(bodyA.packs[0]?.publisherId).toBe('publisher-a');

    const all = await handler(listRequest('tok-a'));
    const bodyAll = JSON.parse(all.body as string) as { packs: unknown[] };
    expect(bodyAll.packs.length).toBe(2);
  });
});
