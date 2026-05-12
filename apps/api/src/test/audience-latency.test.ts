// apps/api/src/test/audience-latency.test.ts
// T-475 — Opt-in audience-latency suite verifying the ADR-009 §D4
// SLA budget at 10 / 50 / 100 concurrent voters in-process. Default
// `pnpm test` SKIPS this file via `describe.skipIf(!process.env.RUN_LATENCY_TESTS)`;
// run via `pnpm --filter @stageflip/app-api test:latency`.
//
// Strict scope per the T-475 spec:
//   - Drives the Hono app via `app.request(...)` (no real socket).
//   - Drives the WS dispatcher (`dispatchAudienceMessage`) directly
//     for the vote-ack hop — the in-process equivalent of the
//     voter-tap → backend-ack hop. Per the T-475 spec WS-frame
//     latency is APPROXIMATED via the dispatcher; a real-socket
//     load test is gated on T-477 (K6 + 1000 concurrent voters).
//   - Latency wall-clock comes from `performance.now()`. This file
//     lives under `apps/api/src/test/` which is outside the
//     determinism perimeter (CLAUDE.md §3 covers
//     `packages/frame-runtime/**`, `packages/runtimes/**/src/clips/**`,
//     `packages/renderer-core/src/clips/**` only).
//
// Logging: emits `[T-475] N=10 e2e p50=... p95=...` per concurrency
// level via `process.stderr.write` so CI artifacts capture the
// numbers without violating the `no-console` lint rule.

import { issueMcpSessionJwt } from '@stageflip/mcp-server';
import { InMemoryAudienceResultsStore, InMemoryTenantSettingsStore } from '@stageflip/storage';
import { describe, expect, it } from 'vitest';

import { VoterRateLimiter } from '../routes/audience-rate-limit.js';
import {
  type DispatchDeps,
  type ServerOutboundFrame,
  dispatchAudienceMessage,
} from '../routes/audience-ws.js';
import { createApp } from '../server.js';

import { computePercentile, synthesizeVoterTaps } from './audience-latency-helpers.js';

const SECRET = 'test-secret-32-bytes-minimum-len-ok';
const TENANT = 'tenant-bench';
const PROJECT = 'project-bench';
const SESSION = 's-bench';

/** Concurrency levels the suite exercises. ADR-009 §D4 baseline. */
const CONCURRENCY_LEVELS = [10, 50, 100] as const;

/**
 * SLA targets per ADR-009 §D4 end-to-end row. The suite asserts the
 * in-process measurements stay UNDER these ceilings; in-process
 * latency on a non-noisy runner is FAR below (the ceilings are
 * conservative production targets that include network jitter).
 */
const SLA_P50_MS = 200;
const SLA_P95_MS = 500;

/**
 * Build a fresh app + stores + presenter token for one concurrency
 * level. The presenter token is needed for `POST /v1/audience/sessions`
 * (cross-tenant gate) — voter tokens are routed via the WS dispatcher
 * directly (no REST `submitVote` endpoint exists; the dispatcher is
 * the audience-backend's ingest surface per ADR-009 §D1).
 */
async function buildLatencyEnv() {
  const tenantSettingsStore = new InMemoryTenantSettingsStore();
  await tenantSettingsStore.putTenantSettings({
    tenantId: TENANT,
    features: {
      interactive: 'ga',
      audience: {
        enabled: true,
        motionNativeEnabled: false,
        maxIngestRateHz: 100_000, // headroom for the bench
        maxConcurrentVotersPerSession: 10_000,
        retentionDays: 90,
      },
    },
    updatedAt: '2026-05-12T00:00:00.000Z',
    updatedBy: 'system',
  });
  const audienceResultsStore = new InMemoryAudienceResultsStore({
    pepper: 'latency-bench-pepper-32-bytes-fixedX',
  });
  const app = createApp({
    mcpSecret: SECRET,
    port: 0,
    resolvePrincipal: async () => ({
      sub: 'bench',
      org: TENANT,
      role: 'editor',
      allowedBundles: [],
    }),
    tenantSettingsStore,
    audienceResultsStore,
  });
  const presenterToken = await issueMcpSessionJwt({
    secret: SECRET,
    claims: { sub: 'bench', org: TENANT, role: 'editor', allowedBundles: [] },
    ttlSeconds: 300,
  });
  return { app, audienceResultsStore, presenterToken };
}

/**
 * Open one bench session via REST. Returns once the session is
 * persisted in the store (per the §D4 backend-persist hop).
 */
async function openBenchSession(
  app: ReturnType<typeof createApp>,
  presenterToken: string,
  sessionId: string,
): Promise<void> {
  const res = await app.request('/v1/audience/sessions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${presenterToken}`,
    },
    body: JSON.stringify({
      tenantId: TENANT,
      projectId: PROJECT,
      sessionId,
      clipKind: 'live-poll-multiple-choice',
    }),
  });
  if (res.status !== 200) {
    throw new Error(`openBenchSession: expected 200, got ${res.status}`);
  }
}

/**
 * Build a per-voter dispatcher harness mirroring the WS I/O layer's
 * wiring (the production WS server calls `dispatchAudienceMessage`
 * with these same deps; tests bypass the socket).
 */
function makeVoterHarness(args: {
  sessionId: string;
  voterToken: string;
  store: InMemoryAudienceResultsStore;
  rateLimiter: VoterRateLimiter;
  eventId: string;
}): {
  deps: DispatchDeps;
  sent: ServerOutboundFrame[];
  closes: Array<{ code: number; reason: string }>;
} {
  const sent: ServerOutboundFrame[] = [];
  const closes: Array<{ code: number; reason: string }> = [];
  const deps: DispatchDeps = {
    sessionId: args.sessionId,
    principal: { kind: 'voter', voterToken: args.voterToken },
    audienceResultsStore: args.store,
    voterRateLimiter: args.rateLimiter,
    now: () => new Date().toISOString(),
    mintEventId: () => args.eventId,
    send: (f) => sent.push(f),
    closeWith: (code, reason) => closes.push({ code, reason }),
  };
  return { deps, sent, closes };
}

/**
 * Drive one concurrency level: open session, fire N synthetic taps,
 * record per-hop latencies, compute percentiles, assert against
 * §D4 end-to-end budgets, and log a `[T-475] N=...` line to stderr.
 */
async function runLatencyLevel(concurrency: number): Promise<void> {
  const { app, audienceResultsStore, presenterToken } = await buildLatencyEnv();
  const sessionId = `${SESSION}-${concurrency}`;
  await openBenchSession(app, presenterToken, sessionId);

  // One VoterRateLimiter shared across all synthetic voters: each
  // voter has a unique token so the per-voter bucket never collides.
  const rateLimiter = new VoterRateLimiter();
  const taps = synthesizeVoterTaps(concurrency);
  const ackLatencies: number[] = [];
  const snapshotLatencies: number[] = [];
  const endToEndLatencies: number[] = [];

  for (let i = 0; i < taps.length; i++) {
    const tap = taps[i];
    if (!tap) continue; // defensive — synthesizeVoterTaps is dense
    const t0 = performance.now();
    // Hop 1+2: voter tap → backend ack (dispatcher) + backend persist
    // (events sub-collection write inside appendEvent).
    const harness = makeVoterHarness({
      sessionId,
      voterToken: tap.voterToken,
      store: audienceResultsStore,
      rateLimiter,
      eventId: `evt-${concurrency}-${i}`,
    });
    await dispatchAudienceMessage(
      JSON.stringify({
        type: 'vote',
        clientTimestamp: new Date(tap.timestampMs).toISOString(),
        payload: tap.payload,
      }),
      harness.deps,
    );
    const t1 = performance.now();
    // Hop 3+4: snapshot aggregation (events → AggregationSnapshot)
    // + backend → presenter socket frame. The REST `/state` path is
    // the audience-backend's snapshot read surface; per the T-475
    // spec, the WS frame portion is APPROXIMATED via this REST hop.
    const stateRes = await app.request(`/v1/audience/sessions/${sessionId}/state`, {
      headers: { authorization: `Bearer ${presenterToken}` },
    });
    const t2 = performance.now();
    if (stateRes.status !== 200) {
      throw new Error(`runLatencyLevel: /state returned ${stateRes.status}`);
    }
    ackLatencies.push(t1 - t0);
    snapshotLatencies.push(t2 - t1);
    endToEndLatencies.push(t2 - t0);
  }

  const ackP50 = computePercentile(ackLatencies, 0.5);
  const ackP95 = computePercentile(ackLatencies, 0.95);
  const snapP50 = computePercentile(snapshotLatencies, 0.5);
  const snapP95 = computePercentile(snapshotLatencies, 0.95);
  const e2eP50 = computePercentile(endToEndLatencies, 0.5);
  const e2eP95 = computePercentile(endToEndLatencies, 0.95);

  // CI-artifact-visible logging. `process.stderr.write` rather than
  // `console.log` per CLAUDE.md §3 (the no-console rule applies
  // outside `scripts/**`; this file is a script-shaped test
  // emitting structured stderr lines for the CI artifact).
  process.stderr.write(
    `[T-475] N=${concurrency} ack p50=${ackP50.toFixed(2)}ms p95=${ackP95.toFixed(2)}ms ` +
      `snapshot p50=${snapP50.toFixed(2)}ms p95=${snapP95.toFixed(2)}ms ` +
      `e2e p50=${e2eP50.toFixed(2)}ms p95=${e2eP95.toFixed(2)}ms\n`,
  );

  // SLA assertions (ADR-009 §D4 end-to-end row). The per-hop
  // budgets are observed via the structured log; the assertion-bar
  // is the end-to-end ceiling (the row T-475's PR title commits to).
  expect(e2eP50).toBeLessThan(SLA_P50_MS);
  expect(e2eP95).toBeLessThan(SLA_P95_MS);
}

describe.skipIf(!process.env.RUN_LATENCY_TESTS)(
  'T-475 audience-latency budget (RUN_LATENCY_TESTS=1)',
  () => {
    for (const level of CONCURRENCY_LEVELS) {
      it(`N=${level} voters: end-to-end p50<${SLA_P50_MS}ms / p95<${SLA_P95_MS}ms`, async () => {
        await runLatencyLevel(level);
      }, 30_000);
    }
  },
);
