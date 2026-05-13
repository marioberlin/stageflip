// packages/marketplace-registry/src/routes/publish.ts
// T-536 — `POST /api/v1/packs` handler: accepts a publish payload
// from a publisher, verifies the Ed25519 signature against the
// publisher's TOFU-bound key, parses the manifest, and persists the
// archive + signature + manifest into the storage adapter.
//
// Wire format (JSON body):
// {
//   "packId":   "<manifest.id>",
//   "version":  "<manifest.version>",
//   "manifest": { ...manifest.json... },
//   "archiveBase64":           "<base64 archive bytes>",
//   "signatureBase64":         "<base64 detached signature>",
//   "publisherPublicKeyPem":   "<PEM-encoded Ed25519 public key>"
// }
//
// Determinism perimeter: outside (server-side).

import {
  ED25519_SIGNATURE_LENGTH,
  parsePackManifest,
  verifyPackArchive,
} from '@stageflip/pack-format';

import { STORAGE_KEYS } from '../storage/storage.js';
import {
  type ErrorBody,
  type RegistryDeps,
  type RouteHandler,
  extractBearer,
  jsonResponse,
} from './types.js';

interface PublishWirePayload {
  readonly packId?: unknown;
  readonly version?: unknown;
  readonly manifest?: unknown;
  readonly archiveBase64?: unknown;
  readonly signatureBase64?: unknown;
  readonly publisherPublicKeyPem?: unknown;
}

/** Build the publish-route handler bound to the supplied `deps`. */
export function createPublishHandler(deps: RegistryDeps): RouteHandler {
  return async (req) => {
    // Auth — bearer token validation.
    const bearer = extractBearer(req.headers);
    if (bearer === null) {
      const body: ErrorBody = { error: 'unauthorized', reason: 'missing-bearer' };
      return jsonResponse(401, body);
    }
    const auth = await deps.tokens.validate(bearer);
    if (!auth.ok || auth.publisherId === undefined) {
      const body: ErrorBody = { error: 'unauthorized', reason: 'invalid-token' };
      return jsonResponse(401, body);
    }
    const authPublisherId = auth.publisherId;

    // Body parse.
    if (req.body === undefined) {
      const body: ErrorBody = { error: 'bad-request', reason: 'missing-body' };
      return jsonResponse(400, body);
    }
    let payload: PublishWirePayload;
    try {
      const text =
        typeof req.body === 'string' ? req.body : new TextDecoder('utf-8').decode(req.body);
      payload = JSON.parse(text) as PublishWirePayload;
      if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        throw new Error('payload must be a JSON object');
      }
    } catch (err) {
      const body: ErrorBody = {
        error: 'bad-request',
        reason: `malformed-json: ${(err as Error).message}`,
      };
      return jsonResponse(400, body);
    }

    // Validate top-level fields.
    if (
      typeof payload.archiveBase64 !== 'string' ||
      typeof payload.signatureBase64 !== 'string' ||
      typeof payload.publisherPublicKeyPem !== 'string'
    ) {
      const body: ErrorBody = {
        error: 'bad-request',
        reason: 'missing-required-fields',
      };
      return jsonResponse(400, body);
    }

    // Parse the manifest strictly (the publish-cli forwards a parsed
    // manifest, but we re-validate against the Zod schema as the
    // single source of truth).
    let manifestParsed: ReturnType<typeof parsePackManifest>;
    try {
      manifestParsed = parsePackManifest(payload.manifest);
    } catch (err) {
      const body: ErrorBody = {
        error: 'bad-request',
        reason: `malformed-manifest: ${(err as Error).message}`,
      };
      return jsonResponse(400, body);
    }

    // Cross-check: declared packId / version match manifest.
    if (
      typeof payload.packId !== 'string' ||
      typeof payload.version !== 'string' ||
      payload.packId !== manifestParsed.id ||
      payload.version !== manifestParsed.version
    ) {
      const body: ErrorBody = {
        error: 'bad-request',
        reason: 'packId-or-version-mismatch',
      };
      return jsonResponse(400, body);
    }

    // The manifest's publisher id MUST match the bearer-bound publisher
    // id — a token can only publish for its bound publisher.
    if (manifestParsed.publisher.id !== authPublisherId) {
      const body: ErrorBody = {
        error: 'forbidden',
        reason: 'publisher-mismatch',
      };
      return jsonResponse(403, body);
    }

    // Decode archive + signature.
    let archiveBytes: Uint8Array;
    let signature: Uint8Array;
    try {
      archiveBytes = Buffer.from(payload.archiveBase64, 'base64');
      signature = Buffer.from(payload.signatureBase64, 'base64');
    } catch (err) {
      const body: ErrorBody = {
        error: 'bad-request',
        reason: `malformed-base64: ${(err as Error).message}`,
      };
      return jsonResponse(400, body);
    }
    if (signature.length !== ED25519_SIGNATURE_LENGTH) {
      const body: ErrorBody = {
        error: 'bad-request',
        reason: `signature-length: ${signature.length} (expected ${ED25519_SIGNATURE_LENGTH})`,
      };
      return jsonResponse(400, body);
    }

    // TOFU: record-or-verify the publisher's public key. On first
    // publish this binds the key; on subsequent calls it rejects on
    // mismatch.
    const tofu = await deps.publishers.recordOrVerify(
      authPublisherId,
      payload.publisherPublicKeyPem,
    );
    if (!tofu.ok) {
      const body: ErrorBody = {
        error: 'forbidden',
        reason: `publisher-key-${tofu.reason ?? 'rejected'}`,
      };
      return jsonResponse(403, body);
    }

    // Verify signature against the (now-bound) public key.
    let sigOk: boolean;
    try {
      sigOk = verifyPackArchive(archiveBytes, signature, payload.publisherPublicKeyPem);
    } catch (err) {
      const body: ErrorBody = {
        error: 'bad-request',
        reason: `signature-verify-threw: ${(err as Error).message}`,
      };
      return jsonResponse(400, body);
    }
    if (!sigOk) {
      const body: ErrorBody = { error: 'bad-request', reason: 'signature-invalid' };
      return jsonResponse(400, body);
    }

    // Duplicate-version detection — a publisher MAY NOT republish an
    // existing version. The CDN URL conventions in ADR-014 §D3 rely
    // on version immutability.
    const manifestKey = STORAGE_KEYS.manifest(
      authPublisherId,
      manifestParsed.id,
      manifestParsed.version,
    );
    const existing = await deps.storage.getManifest(manifestKey);
    if (existing !== null) {
      const body: ErrorBody = {
        error: 'conflict',
        reason: 'version-already-published',
      };
      return jsonResponse(409, body);
    }

    // Persist.
    const archiveKey = STORAGE_KEYS.archive(
      authPublisherId,
      manifestParsed.id,
      manifestParsed.version,
    );
    const signatureKey = STORAGE_KEYS.signature(
      authPublisherId,
      manifestParsed.id,
      manifestParsed.version,
    );
    await deps.storage.putArchive(archiveKey, archiveBytes);
    await deps.storage.putArchive(signatureKey, signature);
    await deps.storage.putManifest(manifestKey, JSON.stringify(manifestParsed));

    return jsonResponse(201, {
      publisherId: authPublisherId,
      packId: manifestParsed.id,
      version: manifestParsed.version,
      manifestKey,
      archiveKey,
      signatureKey,
    });
  };
}
