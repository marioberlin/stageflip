// scripts/loadtest/audience-sla.k6.ts
// T-477 — K6 load-test script driving 1000 concurrent voters against a
// deployed audience-backend per ADR-009 §D4 SLA target.
//
// IMPORTANT: This script runs INSIDE K6's Goja runtime (not Node /
// vitest). The `import 'k6/...'` modules are K6 built-ins; they are
// type-shimmed by `@types/k6` for editor support but resolved at
// runtime by the K6 binary. The script cannot be imported by vitest.
// Pure helpers used here live in `./audience-sla.ts` and have separate
// unit coverage; the K6 script itself is `k6 inspect`-validated at PR
// review time.
//
// Per-VU iteration:
//   1. POST /v1/audience/sessions/<sessionId>/join — mint a voter token.
//   2. WebSocket connect to /v1/audience/ws/<sessionId>.
//   3. Submit one vote every 2 s (0.5 Hz per ADR-009 §D3) for 60 s.
//      Each vote is timestamped on send; the matching server ack
//      (`type: 'snapshot'` frame) is timestamped on receipt, and the
//      difference fed into the `vote_ack_latency` Trend.
//   4. Close the socket.
//
// Scenario `audience_sla`: ramping-vus 0 → 1000 over 5 min, hold for
// 30 min, ramp down to 0 over 5 min. 40-min total wall clock.
//
// Thresholds gate the SLA contract:
//   - `vote_ack_latency: p(95) < 500ms, p(50) < 200ms`
//   - `http_req_duration{name:join}: p(95) < 250ms`
//
// Environment:
//   - BACKEND_URL  (required) — full https URL to the deployed backend,
//     e.g. `https://audience-staging.example.com`.
//   - SESSION_ID   (default `load-test-session`) — the pre-opened
//     session ID the VUs join. Must exist with `closedAt: null` at
//     test start; see `audience-sla-README.md` for prep.
//
// Determinism note: `tests/load/**` and `scripts/loadtest/**` are OUT
// of the workspace determinism scan (`check-determinism.ts` only
// covers `packages/`). `Date.now()` is permitted here.

import { check } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';
import ws from 'k6/ws';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BACKEND_URL = (__ENV.BACKEND_URL ?? '').replace(/\/+$/, '');
const SESSION_ID = __ENV.SESSION_ID ?? 'load-test-session';
const VU_TARGET = Number.parseInt(__ENV.VU_TARGET ?? '1000', 10);

if (BACKEND_URL === '') {
  // K6's setup() reports config issues uniformly. Throwing at import
  // would bypass that path — instead `setup()` below short-circuits.
}

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

/** End-to-end voter-tap → server-ack latency (ms). Gated by the SLA threshold. */
const voteAckLatency = new Trend('vote_ack_latency', true);

/** Count of votes successfully ack'd. */
const voteAckCount = new Counter('vote_ack_count');

/** Rate of vote-ack timeouts (no ack within 5 s of send). */
const voteAckTimeoutRate = new Rate('vote_ack_timeout_rate');

// ---------------------------------------------------------------------------
// Scenario + thresholds (ADR-009 §D4)
// ---------------------------------------------------------------------------

export const options = {
  scenarios: {
    audience_sla: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: VU_TARGET },
        { duration: '30m', target: VU_TARGET },
        { duration: '5m', target: 0 },
      ],
      gracefulStop: '10s',
    },
  },
  thresholds: {
    'http_req_duration{name:join}': ['p(95)<250'],
    vote_ack_latency: ['p(95)<500', 'p(50)<200'],
    vote_ack_timeout_rate: ['rate<0.01'],
  },
};

// ---------------------------------------------------------------------------
// Setup — fail fast if backend not configured
// ---------------------------------------------------------------------------

export function setup(): { backendUrl: string; sessionId: string } {
  if (BACKEND_URL === '') {
    throw new Error(
      'BACKEND_URL is required (e.g. BACKEND_URL=https://audience-staging.example.com k6 run ...)',
    );
  }
  return { backendUrl: BACKEND_URL, sessionId: SESSION_ID };
}

// ---------------------------------------------------------------------------
// Per-VU iteration
// ---------------------------------------------------------------------------

interface VoteFrame {
  type: 'vote';
  payload: { kind: 'live-poll-multiple-choice'; optionIndex: number };
  /** Monotonic millisecond timestamp set by the VU before send. */
  sentAt: number;
  /** Unique vote identifier — VU + iteration + sequence. */
  voteSeq: string;
}

interface IncomingFrame {
  type?: string;
  voteSeq?: string;
}

export default function audienceSlaIteration(data: {
  backendUrl: string;
  sessionId: string;
}): void {
  // ---- 1. POST /join — mint voter token ----------------------------------
  const joinUrl = `${data.backendUrl}/v1/audience/sessions/${data.sessionId}/join`;
  const joinRes = http.post(joinUrl, null, {
    headers: { 'content-type': 'application/json' },
    tags: { name: 'join' },
  });

  const ok = check(joinRes, {
    'join status is 200': (r) => r.status === 200,
    'join returned voterToken': (r) => {
      try {
        const body = r.json() as { voterToken?: string };
        return typeof body.voterToken === 'string' && body.voterToken.length > 0;
      } catch {
        return false;
      }
    },
  });
  if (!ok) {
    return;
  }
  const voterToken = (joinRes.json() as { voterToken: string }).voterToken;

  // ---- 2. WebSocket connect ----------------------------------------------
  const wsUrl = `${data.backendUrl.replace(/^http/, 'ws')}/v1/audience/ws/${data.sessionId}`;
  const wsParams = {
    headers: { 'sec-websocket-protocol': `voter-token.${voterToken}` },
    tags: { name: 'audience_ws' },
  };

  // Track outstanding votes by voteSeq → sentAt. Acks resolve them.
  const pending = new Map<string, number>();
  // Per-VU counter for unique voteSeq.
  let seq = 0;
  // Iteration runs ~60 s; we exit on the timer below.
  const VU_RUN_MS = 60_000;
  const VOTE_INTERVAL_MS = 2_000;
  const ACK_TIMEOUT_MS = 5_000;

  ws.connect(wsUrl, wsParams, (socket) => {
    socket.setTimeout(() => {
      // Mark any unacknowledged votes as timeouts before closing.
      for (const sentAt of pending.values()) {
        voteAckTimeoutRate.add(1);
        // Floor at the timeout; we don't have a real ack to measure.
        voteAckLatency.add(Date.now() - sentAt);
      }
      socket.close();
    }, VU_RUN_MS);

    socket.setInterval(() => {
      // Sweep stale pending votes.
      const now = Date.now();
      for (const [voteSeq, sentAt] of pending) {
        if (now - sentAt > ACK_TIMEOUT_MS) {
          pending.delete(voteSeq);
          voteAckTimeoutRate.add(1);
        }
      }

      // Emit one vote.
      seq += 1;
      const voteSeq = `${__VU}-${__ITER}-${seq}`;
      const sentAt = Date.now();
      const frame: VoteFrame = {
        type: 'vote',
        payload: { kind: 'live-poll-multiple-choice', optionIndex: seq % 4 },
        sentAt,
        voteSeq,
      };
      pending.set(voteSeq, sentAt);
      socket.send(JSON.stringify(frame));
      voteAckTimeoutRate.add(0); // Count denominator increment.
    }, VOTE_INTERVAL_MS);

    socket.on('message', (raw: string) => {
      let parsed: IncomingFrame;
      try {
        parsed = JSON.parse(raw) as IncomingFrame;
      } catch {
        return;
      }
      // The backend echoes the voteSeq on its snapshot ack (per the
      // server-side contract; the K6 script does not assert on
      // snapshot shape — it only measures arrival time).
      if (typeof parsed.voteSeq === 'string') {
        const sentAt = pending.get(parsed.voteSeq);
        if (sentAt !== undefined) {
          pending.delete(parsed.voteSeq);
          voteAckLatency.add(Date.now() - sentAt);
          voteAckCount.add(1);
        }
      }
    });

    socket.on('error', () => {
      // Errors are reported by K6's built-in `ws_session_duration` and
      // `ws_connecting` failure counters; nothing to do per-VU.
    });
  });
}
