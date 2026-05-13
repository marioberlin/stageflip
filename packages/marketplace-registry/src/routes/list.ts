// packages/marketplace-registry/src/routes/list.ts
// T-536 — `GET /api/v1/packs` handler. Lists all published packs;
// optionally filters by `?publisher=<id>` query parameter. Walks the
// `manifests/` storage prefix to enumerate `(publisher, pack, version)`
// triples.
//
// Determinism perimeter: outside (server-side).

import {
  type ErrorBody,
  type RegistryDeps,
  type RouteHandler,
  extractBearer,
  jsonResponse,
} from './types.js';

interface PackListEntry {
  readonly publisherId: string;
  readonly packId: string;
  readonly version: string;
}

interface PackListResponse {
  readonly packs: readonly PackListEntry[];
}

/** Build the list-route handler bound to the supplied `deps`. */
export function createListHandler(deps: RegistryDeps): RouteHandler {
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

    const filterPublisher =
      typeof req.query.publisher === 'string' && req.query.publisher.length > 0
        ? req.query.publisher
        : null;

    const prefix = filterPublisher !== null ? `manifests/${filterPublisher}/` : 'manifests/';
    const keys = await deps.storage.listKeys(prefix);

    const entries: PackListEntry[] = [];
    for (const key of keys) {
      // Expected shape: manifests/<publisher>/<pack>/<version>/manifest.json
      const parts = key.split('/');
      if (parts.length !== 5 || parts[0] !== 'manifests' || parts[4] !== 'manifest.json') {
        continue;
      }
      const publisherId = parts[1] as string;
      const packId = parts[2] as string;
      const version = parts[3] as string;
      entries.push({ publisherId, packId, version });
    }

    // Deterministic ordering: (publisher, pack, version) ascending.
    entries.sort((a, b) => {
      if (a.publisherId !== b.publisherId) {
        return a.publisherId < b.publisherId ? -1 : 1;
      }
      if (a.packId !== b.packId) {
        return a.packId < b.packId ? -1 : 1;
      }
      return a.version < b.version ? -1 : a.version > b.version ? 1 : 0;
    });

    const body: PackListResponse = { packs: entries };
    return jsonResponse(200, body);
  };
}
