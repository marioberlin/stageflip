// apps/api/src/routes/audience-sessions.ts
// T-453 — REST routes for `/v1/audience/sessions/*` per ADR-009 §D1.
// Four endpoints:
//   - POST   /v1/audience/sessions             open session
//   - POST   /v1/audience/sessions/:id/close   close session (FinalSnapshot)
//   - GET    /v1/audience/sessions/:id/state   current AggregationSnapshot
//   - POST   /v1/audience/sessions/:id/join    mint voter token (anonymous)
//
// Auth posture per ADR-009 §D7:
//   - sessions / close / state: presenter-token (the existing `/v1/*`
//     `authMiddleware` runs upstream; route checks principal.org against
//     the requested tenantId).
//   - join: anonymous-OK; per-IP rate-limited via the supplied
//     `voterJoinRateLimiter` (default a TokenBucketRateLimiter at 5
//     joins/sec / 10 burst per IP — matches the conservative posture in
//     ADR-009 §D8).
//
// The route mounts under the existing `/v1/*` authMiddleware. The join
// endpoint disables the upstream auth requirement by handling its own
// 401-equivalent posture (anonymous IPs allowed; per-IP rate-cap).

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { AUDIENCE_CLIP_KINDS, type AudienceClipKind } from '@stageflip/audience-contract';
import type {
  AbuseTrackingStore,
  AudienceEventDoc,
  AudienceFeatureSettings,
  AudienceResultsStore,
  TenantSettingsStore,
} from '@stageflip/storage';

import type { AuthVariables } from '../auth/middleware.js';
import type { Principal } from '../auth/verify.js';
import { encodeAudienceEventsCsv } from './audience-export-csv.js';
import { emitAudienceLossFlag } from './audience-loss-flags.js';
import {
  IpJoinRateLimiter,
  TenantRateLimiter,
  type VoterRateLimiter,
} from './audience-rate-limit.js';

// ----------------------------------------------------------------------------
// Export endpoint constants (T-459)
// ----------------------------------------------------------------------------

/** Paging window used by `GET /:id/export` when reading from `listEvents`. */
const EXPORT_PAGE_SIZE = 10000;

/** Accepted values for the `?format=` query string. */
const EXPORT_FORMATS = ['json', 'csv'] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number];
type AudienceEventSlice = AudienceEventDoc;

function isExportFormat(s: string): s is ExportFormat {
  return (EXPORT_FORMATS as readonly string[]).includes(s);
}

// ----------------------------------------------------------------------------
// Defaults (ADR-009 §D3 / §D5)
// ----------------------------------------------------------------------------

/**
 * Defaults the API layer materialises when a tenant's
 * `TenantSettings.features.audience` is absent. Matches the ADR-009 §D3
 * + §D5 specified defaults verbatim.
 */
export const DEFAULT_AUDIENCE_FEATURE_SETTINGS: AudienceFeatureSettings = {
  enabled: false, // default-deny per T-411a posture
  motionNativeEnabled: false,
  maxIngestRateHz: 100,
  maxConcurrentVotersPerSession: 1000,
  retentionDays: 90,
};

const MOTION_NATIVE_CLIP_KINDS = new Set<AudienceClipKind>([
  'heatmap',
  'reaction-stream',
  'audience-ai-prompt',
]);

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ORPHAN_TTL_MS = 24 * 60 * 60 * 1000; // 24h per ADR-009 §D5

// ----------------------------------------------------------------------------
// Request body schemas
// ----------------------------------------------------------------------------

const openSessionBodySchema = z
  .object({
    tenantId: z.string().min(1),
    projectId: z.string().min(1),
    sessionId: z.string().min(1),
    clipKind: z.enum(AUDIENCE_CLIP_KINDS),
  })
  .strict();

// ----------------------------------------------------------------------------
// Dependency injection shape
// ----------------------------------------------------------------------------

/**
 * Configurable deps for the audience-sessions sub-router. All optional
 * pieces are injectable so tests can drive a deterministic clock + ID
 * source. Production wiring uses `Date.now` + `crypto.randomUUID`.
 */
export interface AudienceSessionsRouteDeps {
  readonly tenantSettingsStore: TenantSettingsStore;
  readonly audienceResultsStore: AudienceResultsStore;
  /** Returns the current wall-clock millis; default `Date.now`. */
  now?(): number;
  /** Mint a fresh voter token (ULID-shaped). Default uses `crypto.randomUUID`. */
  mintVoterToken?(): string;
  /** Adapter descriptor recorded on every opened session. */
  adapterDescriptor?: { readonly id: string; readonly license: string };
  /**
   * Optional pre-built per-tenant rate limiter. Default is built fresh
   * with a default rate of 100 Hz (matches the default tenant ceiling).
   * Used here to admit `openSession` calls per-tenant; per-voter votes
   * use a separate limiter in `audience-ws.ts`.
   */
  tenantRateLimiter?: TenantRateLimiter;
  voterRateLimiter?: VoterRateLimiter;
  /**
   * Per-IP rate-limiter for `POST /:id/join`. Default 5 joins/sec / 10
   * burst (T-458 wraps in `IpJoinRateLimiter` so the IP axis consults
   * the abuse store on the same path as the voter / tenant axes).
   */
  voterJoinRateLimiter?: IpJoinRateLimiter;
  /**
   * Optional abuse store wired into the default tenant + per-IP join
   * limiters. T-458. Production wiring uses the in-memory impl;
   * `T-474` will swap in the Firestore-backed adapter.
   */
  abuseTrackingStore?: AbuseTrackingStore;
  /** In-memory tracker for per-session voter counts (cap check). */
  voterCounts?: Map<string, Set<string>>;
}

// ----------------------------------------------------------------------------
// Subrouter
// ----------------------------------------------------------------------------

/**
 * Build the `/v1/audience/sessions/*` Hono subrouter. Caller mounts it
 * on the root app under `/v1/audience/sessions`.
 *
 * Note: the `join` endpoint operates under the same auth middleware as
 * the rest of `/v1/*`, but accepts ANY principal (including the
 * service-account principal the voter landing page presents) — the
 * rate-cap is per-IP, not per-principal.
 */
export function createAudienceSessionsRoute(
  deps: AudienceSessionsRouteDeps,
): Hono<{ Variables: AuthVariables }> {
  const now = deps.now ?? (() => Date.now());
  const mintVoterToken = deps.mintVoterToken ?? defaultMintVoterToken;
  const adapterDescriptor = deps.adapterDescriptor ?? { id: 'audience-native', license: 'MIT' };
  const tenantRateLimiter =
    deps.tenantRateLimiter ??
    new TenantRateLimiter({
      maxIngestRateHz: DEFAULT_AUDIENCE_FEATURE_SETTINGS.maxIngestRateHz,
      now,
      ...(deps.abuseTrackingStore ? { abuseStore: deps.abuseTrackingStore } : {}),
    });
  const voterJoinRateLimiter =
    deps.voterJoinRateLimiter ??
    new IpJoinRateLimiter({
      now,
      ratePerSecond: 5,
      burst: 10,
      ...(deps.abuseTrackingStore ? { abuseStore: deps.abuseTrackingStore } : {}),
    });
  const voterCounts = deps.voterCounts ?? new Map<string, Set<string>>();

  const app = new Hono<{ Variables: AuthVariables }>();

  // --------------------------------------------------------------------------
  // POST /  — open session
  // --------------------------------------------------------------------------
  app.post('/', zValidator('json', openSessionBodySchema), async (c) => {
    const body = c.req.valid('json');
    const principal = c.var.principal;

    const tenantGuard = denyIfCrossTenant(principal, body.tenantId);
    if (tenantGuard) return c.json(tenantGuard.body, tenantGuard.status);

    const settings = await resolveAudienceSettings(deps.tenantSettingsStore, body.tenantId);
    if (!settings.enabled) {
      return c.json({ error: 'audience_disabled', message: 'tenant has audience disabled' }, 403);
    }
    if (MOTION_NATIVE_CLIP_KINDS.has(body.clipKind) && !settings.motionNativeEnabled) {
      return c.json(
        {
          error: 'motion_native_disabled',
          message: 'tenant has motion-native clip kinds disabled',
        },
        403,
      );
    }

    const tenantDecision = await tenantRateLimiter.tryConsume(body.tenantId);
    if (!tenantDecision.accepted) {
      const flag = emitAudienceLossFlag({
        code: 'LF-AUDIENCE-TENANT-RATE-LIMITED',
        message: `tenant ${body.tenantId} exceeded openSession rate cap`,
        location: { slideId: body.sessionId },
      });
      return c.json(
        {
          error: 'rate_limited',
          message: 'tenant-level audience rate cap exceeded',
          lossFlag: flag,
          ...(tenantDecision.flagLevel !== undefined
            ? { abuseLevel: tenantDecision.flagLevel }
            : {}),
          ...(tenantDecision.rejectReason !== undefined
            ? { rejectReason: tenantDecision.rejectReason }
            : {}),
        },
        429,
      );
    }

    // Voter-cap check: refuse openSession if the prior session for this
    // tenant has already hit `maxConcurrentVotersPerSession`. (Per
    // ADR-009 §D3 the cap is checked at open time AND at every voter
    // join; this open-time check is the first gate.)
    const existing = await deps.audienceResultsStore.readSnapshot(body.sessionId);
    if (existing !== null && existing.voterCount >= settings.maxConcurrentVotersPerSession) {
      const flag = emitAudienceLossFlag({
        code: 'LF-AUDIENCE-CAPACITY-CAP',
        message: `tenant ${body.tenantId} session ${body.sessionId} at voter cap`,
        location: { slideId: body.sessionId },
      });
      return c.json(
        {
          error: 'capacity_cap',
          message: 'session has reached maxConcurrentVotersPerSession',
          lossFlag: flag,
        },
        409,
      );
    }

    const createdAt = new Date(now()).toISOString();
    const orphanTtl = new Date(now() + ORPHAN_TTL_MS).toISOString();
    const doc = await deps.audienceResultsStore.openSession({
      tenantId: body.tenantId,
      projectId: body.projectId,
      sessionId: body.sessionId,
      clipKind: body.clipKind,
      adapterDescriptor,
      createdAt,
      ttlAt: orphanTtl,
    });

    return c.json({
      sessionId: doc.sessionId,
      joinUrl: `/v1/audience/join/${doc.sessionId}`,
      joinCode: doc.sessionId.slice(0, 6).toUpperCase(),
      session: doc,
    });
  });

  // --------------------------------------------------------------------------
  // POST /:sessionId/close — close session, return FinalSnapshot
  // --------------------------------------------------------------------------
  app.post('/:sessionId/close', async (c) => {
    const sessionId = c.req.param('sessionId');
    if (!sessionId) {
      return c.json({ error: 'invalid_request', message: 'missing sessionId' }, 400);
    }
    const existing = await deps.audienceResultsStore.readSnapshot(sessionId);
    if (!existing) {
      return c.json({ error: 'not_found', message: 'session not found' }, 404);
    }
    const principal = c.var.principal;
    const tenantGuard = denyIfCrossTenant(principal, existing.tenantId);
    if (tenantGuard) return c.json(tenantGuard.body, tenantGuard.status);

    const settings = await resolveAudienceSettings(deps.tenantSettingsStore, existing.tenantId);
    const closedAt = new Date(now()).toISOString();
    const ttlAt = new Date(now() + settings.retentionDays * MS_PER_DAY).toISOString();
    const snapshotFrame = existing.snapshotFrame ?? 0;
    const closed = await deps.audienceResultsStore.closeSession({
      sessionId,
      closedAt,
      snapshotFrame,
      ttlAt,
    });

    return c.json({
      sessionId: closed.sessionId,
      closedAt: closed.closedAt,
      snapshotFrame: closed.snapshotFrame,
      voterCountAtCapture: closed.voterCount,
      session: closed,
    });
  });

  // --------------------------------------------------------------------------
  // GET /:sessionId/state — current AggregationSnapshot
  // --------------------------------------------------------------------------
  app.get('/:sessionId/state', async (c) => {
    const sessionId = c.req.param('sessionId');
    if (!sessionId) {
      return c.json({ error: 'invalid_request', message: 'missing sessionId' }, 400);
    }
    const doc = await deps.audienceResultsStore.readSnapshot(sessionId);
    if (!doc) {
      const flag = emitAudienceLossFlag({
        code: 'LF-AUDIENCE-SNAPSHOT-MISSING',
        message: `state requested for unknown session ${sessionId}`,
        location: { slideId: sessionId },
      });
      return c.json({ error: 'not_found', message: 'session not found', lossFlag: flag }, 404);
    }
    const principal = c.var.principal;
    const tenantGuard = denyIfCrossTenant(principal, doc.tenantId);
    if (tenantGuard) return c.json(tenantGuard.body, tenantGuard.status);
    return c.json({ session: doc });
  });

  // --------------------------------------------------------------------------
  // GET /:sessionId/export — post-event analytics download (T-459)
  //
  // Presenter-authenticated; tenant-rate-limited (reuses the same
  // `TenantRateLimiter` axis as openSession). `?format=json` (default)
  // returns `{ session, events }`; `?format=csv` returns RFC 4180 CSV
  // with `Content-Disposition: attachment`. Unknown format → 400.
  //
  // The events sub-collection is paged through via `listEvents` with the
  // `EXPORT_PAGE_SIZE` window; per ADR-009 §D5 voter-token-hashing-at-rest,
  // the `voterTokenHash` column emits the stored hash directly (NEVER
  // un-hashed).
  //
  // `Vary: format` is set so HTTP caches treat `?format=csv` and
  // `?format=json` as distinct responses.
  // --------------------------------------------------------------------------
  app.get('/:sessionId/export', async (c) => {
    const sessionId = c.req.param('sessionId');
    if (!sessionId) {
      return c.json({ error: 'invalid_request', message: 'missing sessionId' }, 400);
    }
    const formatRaw = c.req.query('format');
    if (formatRaw !== undefined && !isExportFormat(formatRaw)) {
      return c.json(
        {
          error: 'invalid_format',
          message: `format must be one of: ${EXPORT_FORMATS.join(', ')}`,
        },
        400,
      );
    }
    const format: ExportFormat = (formatRaw as ExportFormat | undefined) ?? 'json';

    const doc = await deps.audienceResultsStore.readSnapshot(sessionId);
    if (!doc) {
      return c.json({ error: 'not_found', message: 'session not found' }, 404);
    }

    const principal = c.var.principal;
    const tenantGuard = denyIfCrossTenant(principal, doc.tenantId);
    if (tenantGuard) return c.json(tenantGuard.body, tenantGuard.status);

    // Tenant rate-limit the export (the call may page through a large
    // events collection; rate-cap protects upstream tenants from
    // download-storm starvation).
    const tenantDecision = await tenantRateLimiter.tryConsume(doc.tenantId);
    if (!tenantDecision.accepted) {
      const flag = emitAudienceLossFlag({
        code: 'LF-AUDIENCE-TENANT-RATE-LIMITED',
        message: `tenant ${doc.tenantId} export rate cap exceeded`,
        location: { slideId: sessionId },
      });
      return c.json(
        {
          error: 'rate_limited',
          message: 'tenant-level audience rate cap exceeded',
          lossFlag: flag,
          ...(tenantDecision.flagLevel !== undefined
            ? { abuseLevel: tenantDecision.flagLevel }
            : {}),
          ...(tenantDecision.rejectReason !== undefined
            ? { rejectReason: tenantDecision.rejectReason }
            : {}),
        },
        429,
      );
    }

    // Page through events: keep calling listEvents until a page returns
    // fewer than EXPORT_PAGE_SIZE rows (signal of exhaustion).
    const events: AudienceEventSlice[] = [];
    let cursor: string | undefined;
    // Bound the loop defensively (1000 pages × 10k = 10M rows; far past
    // the per-session cap). The break condition is the standard signal.
    for (let page = 0; page < 1000; page++) {
      const opts: { limit: number; after?: string } =
        cursor !== undefined
          ? { limit: EXPORT_PAGE_SIZE, after: cursor }
          : { limit: EXPORT_PAGE_SIZE };
      const slice = await deps.audienceResultsStore.listEvents(sessionId, opts);
      events.push(...slice);
      if (slice.length < EXPORT_PAGE_SIZE) break;
      const last = slice.at(-1);
      if (!last) break;
      cursor = last.serverTimestamp;
    }

    if (format === 'csv') {
      const csv = encodeAudienceEventsCsv(events);
      c.header('content-type', 'text/csv; charset=utf-8');
      c.header('content-disposition', `attachment; filename="audience-${sessionId}.csv"`);
      c.header('vary', 'format');
      return c.body(csv, 200);
    }

    c.header('vary', 'format');
    return c.json({ session: doc, events });
  });

  // --------------------------------------------------------------------------
  // POST /:sessionId/join — mint voter token (per-IP rate-limited)
  // --------------------------------------------------------------------------
  app.post('/:sessionId/join', async (c) => {
    const sessionId = c.req.param('sessionId');
    if (!sessionId) {
      return c.json({ error: 'invalid_request', message: 'missing sessionId' }, 400);
    }
    const doc = await deps.audienceResultsStore.readSnapshot(sessionId);
    if (!doc) {
      return c.json({ error: 'not_found', message: 'session not found' }, 404);
    }
    if (doc.closedAt !== null) {
      const flag = emitAudienceLossFlag({
        code: 'LF-AUDIENCE-SESSION-CLOSED',
        message: `join attempted on closed session ${sessionId}`,
        location: { slideId: sessionId },
      });
      return c.json({ error: 'session_closed', message: 'session is closed', lossFlag: flag }, 410);
    }
    const ip = clientIp(c.req.raw, c.req.header('x-forwarded-for'));
    const ipDecision = await voterJoinRateLimiter.tryConsume(ip);
    if (!ipDecision.accepted) {
      const flag = emitAudienceLossFlag({
        code: 'LF-AUDIENCE-VOTER-RATE-LIMITED',
        message: `join rate limit hit for IP ${ip}`,
        location: { slideId: sessionId },
      });
      return c.json(
        {
          error: 'rate_limited',
          message: 'too many joins from this IP',
          lossFlag: flag,
          ...(ipDecision.flagLevel !== undefined ? { abuseLevel: ipDecision.flagLevel } : {}),
          ...(ipDecision.rejectReason !== undefined
            ? { rejectReason: ipDecision.rejectReason }
            : {}),
        },
        429,
      );
    }
    const settings = await resolveAudienceSettings(deps.tenantSettingsStore, doc.tenantId);
    const seenSet = voterCounts.get(sessionId) ?? new Set<string>();
    if (seenSet.size >= settings.maxConcurrentVotersPerSession) {
      const flag = emitAudienceLossFlag({
        code: 'LF-AUDIENCE-CAPACITY-CAP',
        message: `voter cap reached for session ${sessionId}`,
        location: { slideId: sessionId },
      });
      return c.json(
        { error: 'capacity_cap', message: 'session at voter cap', lossFlag: flag },
        409,
      );
    }
    const voterToken = mintVoterToken();
    seenSet.add(voterToken);
    voterCounts.set(sessionId, seenSet);
    return c.json({ voterToken, sessionId });
  });

  return app;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Read a tenant's audience settings, materialising defaults when the row
 * exists but `features.audience` is absent, and falling back to the
 * default-deny posture when no row exists.
 */
async function resolveAudienceSettings(
  store: TenantSettingsStore,
  tenantId: string,
): Promise<AudienceFeatureSettings> {
  const row = await store.getTenantSettings(tenantId);
  if (!row) return DEFAULT_AUDIENCE_FEATURE_SETTINGS;
  return row.features.audience ?? DEFAULT_AUDIENCE_FEATURE_SETTINGS;
}

interface CrossTenantDenial {
  readonly status: 403;
  readonly body: { readonly error: 'forbidden'; readonly reason: string };
}

/**
 * Deny any cross-tenant request for non-superadmin principals. Mirrors
 * the read-side guard on `/v1/tenant-settings`. The `'superadmin'` role
 * is a string-equality check (the role is not in `McpSessionRole` per
 * `auth/can-set-interactive.ts`).
 */
function denyIfCrossTenant(principal: Principal, tenantId: string): CrossTenantDenial | undefined {
  if (principal.kind !== 'mcp-session') return undefined;
  if ((principal.role as string) === 'superadmin') return undefined;
  if (principal.org === tenantId) return undefined;
  return {
    status: 403,
    body: {
      error: 'forbidden',
      reason: `cross-tenant access: actor org "${principal.org}" cannot access tenant "${tenantId}"`,
    },
  };
}

/**
 * Default voter-token minter. Uses `crypto.randomUUID()` from the
 * platform; the token format is opaque (the schema accepts any
 * non-empty string).
 */
function defaultMintVoterToken(): string {
  // node:crypto's randomUUID is platform-available + cryptographically
  // secure; matches the ULID-equivalent strength documented in ADR-009 §D7.
  // Using globalThis.crypto avoids the node:crypto import in browser builds
  // (apps/api is server-only but the import structure is uniform).
  const c = (globalThis as { crypto?: { randomUUID(): string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  throw new Error('audience-sessions: globalThis.crypto.randomUUID is not available');
}

/**
 * Extract the client IP from a Fetch-API Request. Prefers the leftmost
 * value of `X-Forwarded-For` when present (Cloud Run / load balancer
 * surface); falls back to `unknown` so the rate-limiter still buckets
 * (which has the effect of treating un-attributed traffic as a single
 * bucket — conservative).
 */
function clientIp(req: Request, xff: string | undefined): string {
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first && first.length > 0) return first;
  }
  // Hono / @hono/node-server does not surface the socket address on the
  // Fetch Request directly; tests bypass this branch via x-forwarded-for.
  void req;
  return 'unknown';
}
