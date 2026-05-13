// packages/marketplace-registry/src/routes/publish.test.ts
// T-536 — Tests for `POST /api/v1/packs`.

import { describe, expect, it } from 'vitest';

import { STORAGE_KEYS } from '../storage/storage.js';
import { makeKeyPair, makeRegistryDeps, makeSignedPack } from '../test-helpers.js';
import { createPublishHandler } from './publish.js';
import type { RouteRequest } from './types.js';

function publishRequest(payload: unknown, bearer: string | undefined): RouteRequest {
  return {
    method: 'POST',
    path: '/api/v1/packs',
    headers:
      bearer === undefined
        ? { 'content-type': 'application/json' }
        : { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    query: {},
  };
}

describe('publish handler', () => {
  it('full publish flow: signs, records publisher, stores artifacts', async () => {
    const deps = makeRegistryDeps({
      tokens: [{ token: 'tok-1', publisherId: 'stageflip' }],
    });
    const handler = createPublishHandler(deps);
    const pack = makeSignedPack({ publisherId: 'stageflip' });

    const res = await handler(
      publishRequest(
        {
          packId: 'demo',
          version: '1.0.0',
          manifest: pack.manifest,
          archiveBase64: pack.archiveBase64,
          signatureBase64: pack.signatureBase64,
          publisherPublicKeyPem: pack.publicKeyPem,
        },
        'tok-1',
      ),
    );

    expect(res.status).toBe(201);
    // Publisher key recorded
    const bound = await deps.publishers.getPublicKey('stageflip');
    expect(bound).not.toBeNull();
    // Storage artifacts present
    const manifestKey = STORAGE_KEYS.manifest('stageflip', 'demo', '1.0.0');
    const archiveKey = STORAGE_KEYS.archive('stageflip', 'demo', '1.0.0');
    const signatureKey = STORAGE_KEYS.signature('stageflip', 'demo', '1.0.0');
    expect(await deps.storage.getManifest(manifestKey)).not.toBeNull();
    expect(await deps.storage.getArchive(archiveKey)).not.toBeNull();
    expect(await deps.storage.getArchive(signatureKey)).not.toBeNull();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const deps = makeRegistryDeps();
    const handler = createPublishHandler(deps);
    const pack = makeSignedPack();
    const res = await handler(
      publishRequest(
        {
          packId: 'demo',
          version: '1.0.0',
          manifest: pack.manifest,
          archiveBase64: pack.archiveBase64,
          signatureBase64: pack.signatureBase64,
          publisherPublicKeyPem: pack.publicKeyPem,
        },
        undefined,
      ),
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 on invalid bearer token', async () => {
    const deps = makeRegistryDeps({
      tokens: [{ token: 'correct', publisherId: 'stageflip' }],
    });
    const handler = createPublishHandler(deps);
    const pack = makeSignedPack({ publisherId: 'stageflip' });
    const res = await handler(
      publishRequest(
        {
          packId: 'demo',
          version: '1.0.0',
          manifest: pack.manifest,
          archiveBase64: pack.archiveBase64,
          signatureBase64: pack.signatureBase64,
          publisherPublicKeyPem: pack.publicKeyPem,
        },
        'wrong-token',
      ),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 on malformed JSON body', async () => {
    const deps = makeRegistryDeps({
      tokens: [{ token: 'tok', publisherId: 'stageflip' }],
    });
    const handler = createPublishHandler(deps);
    const res = await handler(publishRequest('{ not json', 'tok'));
    expect(res.status).toBe(400);
    expect((res.body as string).includes('malformed-json')).toBe(true);
  });

  it('returns 400 on malformed manifest', async () => {
    const deps = makeRegistryDeps({
      tokens: [{ token: 'tok', publisherId: 'stageflip' }],
    });
    const handler = createPublishHandler(deps);
    const pack = makeSignedPack({ publisherId: 'stageflip' });
    const res = await handler(
      publishRequest(
        {
          packId: 'demo',
          version: '1.0.0',
          manifest: { invalid: 'shape' },
          archiveBase64: pack.archiveBase64,
          signatureBase64: pack.signatureBase64,
          publisherPublicKeyPem: pack.publicKeyPem,
        },
        'tok',
      ),
    );
    expect(res.status).toBe(400);
    expect((res.body as string).includes('malformed-manifest')).toBe(true);
  });

  it('returns 400 on signature length mismatch', async () => {
    const deps = makeRegistryDeps({
      tokens: [{ token: 'tok', publisherId: 'stageflip' }],
    });
    const handler = createPublishHandler(deps);
    const pack = makeSignedPack({ publisherId: 'stageflip' });
    const res = await handler(
      publishRequest(
        {
          packId: 'demo',
          version: '1.0.0',
          manifest: pack.manifest,
          archiveBase64: pack.archiveBase64,
          signatureBase64: Buffer.from(new Uint8Array([1, 2, 3])).toString('base64'),
          publisherPublicKeyPem: pack.publicKeyPem,
        },
        'tok',
      ),
    );
    expect(res.status).toBe(400);
    expect((res.body as string).includes('signature-length')).toBe(true);
  });

  it('returns 400 when signature does not verify (key mismatch on first publish would be 400 not TOFU since key is fresh — but cryptographic verify must still fail)', async () => {
    const deps = makeRegistryDeps({
      tokens: [{ token: 'tok', publisherId: 'stageflip' }],
    });
    const handler = createPublishHandler(deps);
    const pack = makeSignedPack({ publisherId: 'stageflip' });
    // Replace the public key with an unrelated fresh keypair
    const other = makeKeyPair();
    const res = await handler(
      publishRequest(
        {
          packId: 'demo',
          version: '1.0.0',
          manifest: pack.manifest,
          archiveBase64: pack.archiveBase64,
          signatureBase64: pack.signatureBase64,
          publisherPublicKeyPem: other.publicKeyPem,
        },
        'tok',
      ),
    );
    expect(res.status).toBe(400);
    expect((res.body as string).includes('signature-invalid')).toBe(true);
  });

  it('returns 403 on TOFU mismatch (second publish with different key)', async () => {
    const deps = makeRegistryDeps({
      tokens: [{ token: 'tok', publisherId: 'stageflip' }],
    });
    const handler = createPublishHandler(deps);

    // First publish — binds key A
    const packA = makeSignedPack({ publisherId: 'stageflip', version: '1.0.0' });
    const res1 = await handler(
      publishRequest(
        {
          packId: 'demo',
          version: '1.0.0',
          manifest: packA.manifest,
          archiveBase64: packA.archiveBase64,
          signatureBase64: packA.signatureBase64,
          publisherPublicKeyPem: packA.publicKeyPem,
        },
        'tok',
      ),
    );
    expect(res1.status).toBe(201);

    // Second publish at a new version — but with a different key
    const packB = makeSignedPack({ publisherId: 'stageflip', version: '1.1.0' });
    const res2 = await handler(
      publishRequest(
        {
          packId: 'demo',
          version: '1.1.0',
          manifest: packB.manifest,
          archiveBase64: packB.archiveBase64,
          signatureBase64: packB.signatureBase64,
          publisherPublicKeyPem: packB.publicKeyPem,
        },
        'tok',
      ),
    );
    expect(res2.status).toBe(403);
    expect((res2.body as string).includes('publisher-key')).toBe(true);
  });

  it('returns 403 when manifest publisher id does not match bearer publisher', async () => {
    const deps = makeRegistryDeps({
      tokens: [{ token: 'tok', publisherId: 'real-publisher' }],
    });
    const handler = createPublishHandler(deps);
    const pack = makeSignedPack({ publisherId: 'imposter' });
    const res = await handler(
      publishRequest(
        {
          packId: 'demo',
          version: '1.0.0',
          manifest: pack.manifest,
          archiveBase64: pack.archiveBase64,
          signatureBase64: pack.signatureBase64,
          publisherPublicKeyPem: pack.publicKeyPem,
        },
        'tok',
      ),
    );
    expect(res.status).toBe(403);
    expect((res.body as string).includes('publisher-mismatch')).toBe(true);
  });

  it('returns 409 on duplicate version', async () => {
    const deps = makeRegistryDeps({
      tokens: [{ token: 'tok', publisherId: 'stageflip' }],
    });
    const handler = createPublishHandler(deps);

    // First publish — we need to reuse the same keypair for the
    // second publish to pass TOFU; rebuild the second pack from the
    // same private key.
    const first = makeSignedPack({ publisherId: 'stageflip', version: '1.0.0' });
    const res1 = await handler(
      publishRequest(
        {
          packId: 'demo',
          version: '1.0.0',
          manifest: first.manifest,
          archiveBase64: first.archiveBase64,
          signatureBase64: first.signatureBase64,
          publisherPublicKeyPem: first.publicKeyPem,
        },
        'tok',
      ),
    );
    expect(res1.status).toBe(201);

    // Replay the same publish — version 1.0.0 already present.
    const res2 = await handler(
      publishRequest(
        {
          packId: 'demo',
          version: '1.0.0',
          manifest: first.manifest,
          archiveBase64: first.archiveBase64,
          signatureBase64: first.signatureBase64,
          publisherPublicKeyPem: first.publicKeyPem,
        },
        'tok',
      ),
    );
    expect(res2.status).toBe(409);
    expect((res2.body as string).includes('version-already-published')).toBe(true);
  });

  it('returns 400 when packId / version do not match manifest', async () => {
    const deps = makeRegistryDeps({
      tokens: [{ token: 'tok', publisherId: 'stageflip' }],
    });
    const handler = createPublishHandler(deps);
    const pack = makeSignedPack({ publisherId: 'stageflip', version: '1.0.0' });
    const res = await handler(
      publishRequest(
        {
          packId: 'demo',
          version: '9.9.9', // mismatch
          manifest: pack.manifest,
          archiveBase64: pack.archiveBase64,
          signatureBase64: pack.signatureBase64,
          publisherPublicKeyPem: pack.publicKeyPem,
        },
        'tok',
      ),
    );
    expect(res.status).toBe(400);
    expect((res.body as string).includes('packId-or-version-mismatch')).toBe(true);
  });
});
