// apps/api/src/server.ts
// T-231 — composed Hono application entry. Wires the T-229
// building blocks (auth middleware + MCP session mint) into a real
// server + port listener. Cloud Run invokes this module as the
// container entrypoint.

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';

import {
  type AbuseTrackingStore,
  type AudienceResultsStore,
  InMemoryAbuseTrackingStore,
  InMemoryAudienceResultsStore,
  InMemoryTenantSettingsStore,
  type TenantSettingsStore,
} from '@stageflip/storage';

import { createFirebaseVerifier } from './auth/firebase.js';
import { type AuthVariables, authMiddleware } from './auth/middleware.js';
import { createPrincipalVerifier } from './auth/verify.js';
import {
  InMemoryTenantPackInventoryStore,
  type TenantPackInventoryStore,
  createAdminPackInventoryRoute,
} from './routes/admin-pack-inventory.js';
import { QuizStateManager } from './routes/audience-quiz-state.js';
import { VoterRateLimiter } from './routes/audience-rate-limit.js';
import { createAudienceSessionsRoute } from './routes/audience-sessions.js';
import {
  type AudienceWebSocketServer,
  type LiveQuizConfig,
  createAudienceWebSocketServer,
} from './routes/audience-ws.js';
import { type PrincipalResolution, createMcpSessionRoute } from './routes/mcp-session.js';
import { createTenantSettingsRoute } from './routes/tenant-settings.js';

export interface ServerConfig {
  readonly mcpSecret: string;
  readonly port: number;
  /**
   * Called by the mint endpoint once the Google id-token has been
   * Firebase-verified. Production callers resolve the StageFlip
   * user + org + role from Firestore; tests inject a stub.
   */
  resolvePrincipal(args: { firebaseUid: string; email?: string }): Promise<PrincipalResolution>;
  /** Override the Firebase ID-token verifier (tests). */
  verifyFirebaseIdToken?: (token: string) => Promise<{ uid: string; email?: string }>;
  /**
   * T-411b — concrete TenantSettingsStore. Defaults to a process-local
   * in-memory store (consistent with the TODO-stub `resolvePrincipal`
   * default in `bin.ts`); production deployments inject the
   * Postgres / Firebase store factory.
   */
  tenantSettingsStore?: TenantSettingsStore;
  /**
   * T-453 — concrete AudienceResultsStore. Defaults to a process-local
   * in-memory store; production deployments inject the Firestore-backed
   * impl from `@stageflip/storage-firebase` (T-474).
   */
  audienceResultsStore?: AudienceResultsStore;
  /**
   * T-453 — pepper for voter-token SHA-256 hashing per ADR-009 §D5.
   * Production wiring reads from the `AUDIENCE_TOKEN_PEPPER` env var; the
   * default value here is for tests + dev only.
   */
  audienceTokenPepper?: string;
  /**
   * T-458 — concrete AbuseTrackingStore. Defaults to a process-local
   * in-memory store; production deployments inject the Firestore-backed
   * impl from `@stageflip/storage-firebase` when T-474 lands.
   */
  abuseTrackingStore?: AbuseTrackingStore;
  /**
   * T-473 — per-session live-quiz config resolver. Optional; required
   * for the live-quiz scoring path. The resolver pulls the question
   * array + per-question timer + `questionStartedAtMs` for the
   * supplied `sessionId`. The default in-memory binding here is a
   * no-op (`undefined`) — live-quiz votes fall through to the generic
   * vote acceptor. Production wiring binds it to the document store
   * (where the LiveQuizClipElement lives) once T-474 + downstream
   * presenter-side wiring lands.
   */
  resolveLiveQuizConfig?: (sessionId: string) => Promise<LiveQuizConfig | undefined>;
  /**
   * T-542 — concrete TenantPackInventoryStore powering the admin
   * pack-inventory route (`GET /admin/tenants/:tenantId/packs`).
   * Defaults to a process-local in-memory store; production deployments
   * inject a Firestore-backed adapter (deferred to T-550). The route is
   * read-only at v1 — mutation (revoke / force-uninstall) lands in a
   * future task.
   */
  tenantPackInventoryStore?: TenantPackInventoryStore;
}

/**
 * Build the fully-wired Hono app. Exported separately from `startServer`
 * so integration tests can drive it via `app.request(...)` without
 * opening a real socket.
 */
export function createApp(config: ServerConfig): Hono<{ Variables: AuthVariables }> {
  const verifyFirebaseIdToken = config.verifyFirebaseIdToken ?? createFirebaseVerifier();

  const verify = createPrincipalVerifier({
    mcpSecret: config.mcpSecret,
    verifyFirebaseIdToken,
  });

  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', logger());

  // Cloud Run liveness probe.
  app.get('/healthz', (c) => c.json({ ok: true }));

  // Auth: mint an MCP session JWT from a verified Google id-token.
  app.route(
    '/auth/mcp-session',
    createMcpSessionRoute({
      mcpSecret: config.mcpSecret,
      verifyFirebaseIdToken,
      resolvePrincipal: config.resolvePrincipal,
    }),
  );

  // Protected API surface — placeholder for subsequent tasks.
  app.use('/v1/*', authMiddleware({ verify }));
  app.get('/v1/whoami', (c) => c.json({ principal: c.var.principal }));

  // T-411b — TenantSettings procedures (get / setInteractive / list). Mounted
  // behind the existing /v1/* authMiddleware. Default store is in-memory;
  // production callers inject a Postgres / Firebase store.
  const tenantSettingsStore = config.tenantSettingsStore ?? new InMemoryTenantSettingsStore();
  app.route('/v1/tenant-settings', createTenantSettingsRoute({ store: tenantSettingsStore }));

  // T-453 — Audience-session REST routes (open / close / state / join).
  // Mounted behind the same /v1/* authMiddleware; cross-tenant guard
  // enforced per-handler. The /join endpoint accepts any authenticated
  // principal but enforces per-IP rate-cap (anonymous-OK posture lands
  // when T-456 ships the voter landing page).
  const audienceResultsStore =
    config.audienceResultsStore ??
    new InMemoryAudienceResultsStore({
      pepper: config.audienceTokenPepper ?? 'in-memory-default-pepper-DO-NOT-USE-PROD',
    });
  // T-458 — abuse store wired into the per-tenant + per-IP join limiters.
  const abuseTrackingStore = config.abuseTrackingStore ?? new InMemoryAbuseTrackingStore();
  app.route(
    '/v1/audience/sessions',
    createAudienceSessionsRoute({
      tenantSettingsStore,
      audienceResultsStore,
      abuseTrackingStore,
    }),
  );

  // T-542 — Admin pack-inventory surface (read-only). Sits behind the
  // same Bearer-token auth as `/v1/*`; the route handler enforces the
  // admin-role check inline. Default store is in-memory; production
  // wiring (T-550) injects the Firestore-backed adapter.
  const tenantPackInventoryStore =
    config.tenantPackInventoryStore ?? new InMemoryTenantPackInventoryStore();
  app.use('/admin/*', authMiddleware({ verify }));
  app.route('/admin', createAdminPackInventoryRoute({ store: tenantPackInventoryStore }));

  return app;
}

export interface StartServerOptions extends ServerConfig {
  /** Override for tests. Defaults to `@hono/node-server`'s `serve`. */
  readonly serveFn?: typeof serve;
  /**
   * T-453 — when `true`, mount the audience WebSocket multiplexer on
   * the HTTP server returned by `serve()`. Default `true` in production;
   * test harnesses that drive the app via `app.request(...)` can set
   * `false` to avoid binding a socket.
   */
  readonly mountAudienceWebSocket?: boolean;
}

export function startServer(options: StartServerOptions): { close: () => Promise<void> } {
  const app = createApp(options);
  const serveImpl = options.serveFn ?? serve;
  const server = serveImpl({
    fetch: app.fetch,
    port: options.port,
  });

  // T-453 — Mount the WebSocket multiplexer on the same HTTP server.
  // The audienceResultsStore lookup mirrors createApp; we re-resolve here
  // because the WS layer needs the same instance the REST routes use,
  // and the in-memory default constructed inside createApp is private to
  // the closure. Production wiring passes both via config.
  let audienceWs: AudienceWebSocketServer | undefined;
  if (options.mountAudienceWebSocket !== false) {
    const audienceResultsStore =
      options.audienceResultsStore ??
      new InMemoryAudienceResultsStore({
        pepper: options.audienceTokenPepper ?? 'in-memory-default-pepper-DO-NOT-USE-PROD',
      });
    // T-458 — wire the abuse store into the WS-side voter limiter +
    // register the reaction-stream override.
    const abuseTrackingStore = options.abuseTrackingStore ?? new InMemoryAbuseTrackingStore();
    const voterRateLimiter = new VoterRateLimiter({ abuseStore: abuseTrackingStore });
    voterRateLimiter.setClipKindOverride('reaction-stream', 10);
    // T-473 — quiz state machine scopes live-quiz vote scoring.
    const quizStateManager = new QuizStateManager({
      audienceResultsStore,
      now: () => Date.now(),
    });
    audienceWs = createAudienceWebSocketServer({
      httpServer: server as unknown as import('node:http').Server,
      audienceResultsStore,
      voterRateLimiter,
      quizStateManager,
      ...(options.resolveLiveQuizConfig !== undefined
        ? { resolveLiveQuizConfig: options.resolveLiveQuizConfig }
        : {}),
      verifyPresenterToken: async (token) => {
        // Bridge to the existing principal verifier; on success the
        // presenter's org is the source of cross-tenant gating.
        const verify = createPrincipalVerifier({
          mcpSecret: options.mcpSecret,
          verifyFirebaseIdToken: options.verifyFirebaseIdToken ?? createFirebaseVerifier(),
        });
        const principal = await verify(`Bearer ${token}`);
        const org = principal.kind === 'mcp-session' ? principal.org : '';
        return { principalId: principal.sub, org };
      },
      verifyVoterToken: async (token) => ({ ok: token.length > 0 }),
    });
  }

  return {
    close: async () => {
      if (audienceWs) await audienceWs.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
