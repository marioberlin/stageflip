// packages/marketplace-registry/src/handler.ts
// T-536 — `composeHandler(deps)` assembles the route table into a
// single `RouteHandler` matching the express-like contract. Routing
// is method + path-prefix; the dispatcher delegates to per-route
// handlers from `routes/*`. Exceptions inside a route handler are
// caught + surface as a 500 with `{ error: 'internal', reason }`.
//
// Determinism perimeter: outside (server-side).

import { InMemoryTokenStore } from './auth/tokens.js';
import { InMemoryPublisherKeyRegistry } from './publishers/registry.js';
import { createDownloadHandler } from './routes/download.js';
import { createListHandler } from './routes/list.js';
import { createPublishHandler } from './routes/publish.js';
import {
  type ErrorBody,
  type RegistryDeps,
  type RouteHandler,
  jsonResponse,
} from './routes/types.js';
import { InMemoryStorageAdapter } from './storage/in-memory.js';

const LIST_AND_PUBLISH_PATH = '/api/v1/packs';
const DOWNLOAD_PATH_PREFIX = '/api/v1/packs/';

/**
 * Build the full registry handler. The returned `RouteHandler` is the
 * single entry-point the production HTTP adapter (T-550) wires into
 * its server.
 */
export function composeHandler(deps: RegistryDeps): RouteHandler {
  const publish = createPublishHandler(deps);
  const list = createListHandler(deps);
  const download = createDownloadHandler(deps);

  return async (req) => {
    try {
      // The two collection-level routes share `/api/v1/packs`.
      if (req.path === LIST_AND_PUBLISH_PATH) {
        if (req.method === 'POST') {
          return await publish(req);
        }
        if (req.method === 'GET') {
          return await list(req);
        }
        const body: ErrorBody = {
          error: 'method-not-allowed',
          reason: `${req.method} ${req.path}`,
        };
        return jsonResponse(405, body);
      }

      // Download paths are scoped under the same prefix but carry
      // sub-segments. Restrict to GET — the only verb the spec
      // defines for these.
      if (req.path.startsWith(DOWNLOAD_PATH_PREFIX)) {
        if (req.method === 'GET') {
          return await download(req);
        }
        const body: ErrorBody = {
          error: 'method-not-allowed',
          reason: `${req.method} ${req.path}`,
        };
        return jsonResponse(405, body);
      }

      const body: ErrorBody = { error: 'not-found', reason: `no-such-route ${req.path}` };
      return jsonResponse(404, body);
    } catch (err) {
      const body: ErrorBody = {
        error: 'internal',
        reason: `handler-threw: ${(err as Error).message}`,
      };
      return jsonResponse(500, body);
    }
  };
}

/**
 * Convenience constructor for tests + dev: build a complete
 * `RegistryDeps` backed by in-memory shims. Optionally seed bearer
 * tokens.
 */
export function createInMemoryRegistry(opts?: {
  tokens?: readonly { token: string; publisherId: string }[];
}): RegistryDeps {
  return {
    storage: new InMemoryStorageAdapter(),
    publishers: new InMemoryPublisherKeyRegistry(),
    tokens: new InMemoryTokenStore(opts?.tokens),
  };
}
