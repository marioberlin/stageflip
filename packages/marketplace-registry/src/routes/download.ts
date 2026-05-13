// packages/marketplace-registry/src/routes/download.ts
// T-536 — Two handlers serving the per-pack download surface:
//   GET /api/v1/packs/:publisher/:pack/:version
//     Returns the manifest + a signed-URL grant (JSON).
//   GET /api/v1/packs/:publisher/:pack/:version/archive
//     302-redirect to the signed CDN URL.
//
// Per ADR-014 §D1 the registry never streams archive bytes directly —
// the CDN serves the binary, the registry hands out short-TTL signed
// URLs.
//
// Determinism perimeter: outside (server-side).

import { STORAGE_KEYS } from '../storage/storage.js';
import {
  type ErrorBody,
  type RegistryDeps,
  type RouteHandler,
  type RouteResponse,
  extractBearer,
  jsonResponse,
} from './types.js';

/** TTL for signed-URL grants, per ADR-014 §D1 "short-TTL". */
export const SIGNED_URL_TTL_SECONDS = 300;

const PATH_RE = /^\/api\/v1\/packs\/([^/]+)\/([^/]+)\/([^/]+)(?:\/archive)?$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?(?:\+[a-z0-9.-]+)?$/i;

/** Result of parsing a download-route path. */
interface ParsedPath {
  readonly publisherId: string;
  readonly packId: string;
  readonly version: string;
  readonly isArchiveSubPath: boolean;
}

function parsePath(path: string): ParsedPath | null {
  const matched = PATH_RE.exec(path);
  if (!matched) return null;
  return {
    publisherId: matched[1] as string,
    packId: matched[2] as string,
    version: matched[3] as string,
    isArchiveSubPath: path.endsWith('/archive'),
  };
}

/** Build the download-route handler bound to the supplied `deps`. */
export function createDownloadHandler(deps: RegistryDeps): RouteHandler {
  return async (req) => {
    const bearer = extractBearer(req.headers);
    if (bearer === null) {
      const body: ErrorBody = { error: 'unauthorized', reason: 'missing-bearer' };
      return jsonResponse(401, body);
    }
    const auth = await deps.tokens.validate(bearer);
    if (!auth.ok) {
      const body: ErrorBody = { error: 'unauthorized', reason: 'invalid-token' };
      return jsonResponse(401, body);
    }

    const parsed = parsePath(req.path);
    if (parsed === null) {
      const body: ErrorBody = { error: 'bad-request', reason: 'malformed-path' };
      return jsonResponse(400, body);
    }
    if (!SEMVER_RE.test(parsed.version)) {
      const body: ErrorBody = { error: 'bad-request', reason: 'malformed-version' };
      return jsonResponse(400, body);
    }

    const manifestKey = STORAGE_KEYS.manifest(parsed.publisherId, parsed.packId, parsed.version);
    const manifestJson = await deps.storage.getManifest(manifestKey);
    if (manifestJson === null) {
      const body: ErrorBody = { error: 'not-found', reason: 'pack-or-version-missing' };
      return jsonResponse(404, body);
    }

    const archiveKey = STORAGE_KEYS.archive(parsed.publisherId, parsed.packId, parsed.version);
    const signedArchiveUrl = await deps.storage.signedUrl(archiveKey, SIGNED_URL_TTL_SECONDS);

    if (parsed.isArchiveSubPath) {
      const res: RouteResponse = {
        status: 302,
        headers: { location: signedArchiveUrl },
      };
      return res;
    }

    return jsonResponse(200, {
      publisherId: parsed.publisherId,
      packId: parsed.packId,
      version: parsed.version,
      manifest: JSON.parse(manifestJson) as unknown,
      archiveUrl: signedArchiveUrl,
      archiveUrlTtlSeconds: SIGNED_URL_TTL_SECONDS,
    });
  };
}
