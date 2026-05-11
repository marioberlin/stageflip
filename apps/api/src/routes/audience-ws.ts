// apps/api/src/routes/audience-ws.ts
// T-453 — WebSocket multiplexer at `/v1/audience/ws/:sessionId` per
// ADR-009 §D1 / §D6. Handshake validates voter-token (subprotocol
// header) OR presenter-token (`Authorization` header); subsequent
// frames route by `type` (`vote` / `snapshot` / `admin-command` /
// `error`).
//
// The module is split into a pure message-dispatch layer
// (`dispatchAudienceMessage`) — exercised by tests without a real
// socket — and the I/O layer (`createAudienceWebSocketServer`) that
// adapts the pure layer to the `ws` library and mounts on the same
// HTTP server `@hono/node-server`'s `serve()` returns.
//
// Close codes per ADR-009 §D6:
//   4000 session-closed       (graceful close on server)
//   4001 unauthorized         (bad token at handshake or mid-session)
//   4002 rate-cap             (voter exceeded reconnect budget)
//   4003 server-shutdown      (graceful shutdown drains)

import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

import { type VotePayload, votePayloadSchema } from '@stageflip/audience-contract';
import type { AudienceResultsStore, AudienceSessionDoc } from '@stageflip/storage';
import { WebSocket, WebSocketServer } from 'ws';

import { type ServerAudienceLossFlagCode, emitAudienceLossFlag } from './audience-loss-flags.js';
import { VoterRateLimiter } from './audience-rate-limit.js';

// ----------------------------------------------------------------------------
// Wire-format message types
// ----------------------------------------------------------------------------

/** Frame sent voter to server to cast one vote event. */
export interface VoteFrame {
  readonly type: 'vote';
  readonly clientTimestamp: string;
  readonly payload: VotePayload;
}

/** Frame sent server to presenter on each aggregation snapshot. */
export interface SnapshotFrame {
  readonly type: 'snapshot';
  readonly serverTimestamp: string;
  readonly aggregation: unknown;
  readonly voterCount: number;
}

/** Frame sent presenter to server to drive admin commands. */
export interface AdminCommandFrame {
  readonly type: 'admin-command';
  readonly command: 'open' | 'close' | 'advance' | 'lock';
  readonly questionId?: string;
}

/** Server to client error frame. Mirrors the loss-flag code structure. */
export interface ErrorFrame {
  readonly type: 'error';
  readonly code: ServerAudienceLossFlagCode | 'BAD-FRAME' | 'UNAUTHORIZED';
  readonly message: string;
}

export type ServerInboundFrame = VoteFrame | AdminCommandFrame;
export type ServerOutboundFrame = SnapshotFrame | ErrorFrame;

// ----------------------------------------------------------------------------
// Principal model
// ----------------------------------------------------------------------------

/**
 * Resolved principal after handshake. Either a voter (anonymous-OK) or
 * a presenter (carries the same MCP-session role envelope as the REST
 * routes — see `auth/verify.ts`).
 */
export type WsPrincipal =
  | { readonly kind: 'voter'; readonly voterToken: string }
  | {
      readonly kind: 'presenter';
      readonly principalId: string;
      readonly org: string;
    };

// ----------------------------------------------------------------------------
// Dispatcher (pure)
// ----------------------------------------------------------------------------

export interface DispatchDeps {
  readonly sessionId: string;
  readonly principal: WsPrincipal;
  readonly audienceResultsStore: AudienceResultsStore;
  readonly voterRateLimiter: VoterRateLimiter;
  /** ISO timestamp source. */
  now(): string;
  /** ID source for new event docs. */
  mintEventId(): string;
  /** Send one outbound frame to the connected client. */
  send(frame: ServerOutboundFrame): void;
  /**
   * Request a close with the given ADR-009 §D6 code and reason. Returns
   * void; the I/O layer wires this to the underlying socket.
   */
  closeWith(code: 4000 | 4001 | 4002 | 4003, reason: string): void;
}

/**
 * Pure message-dispatch entry. Parses one inbound JSON frame, runs the
 * routing rules (auth, rate-limit, store), emits the appropriate
 * outbound frame or close, and returns. Throws nothing — every error
 * surfaces as an `error` frame to keep the WS layer simple.
 */
export async function dispatchAudienceMessage(raw: string, deps: DispatchDeps): Promise<void> {
  let frame: unknown;
  try {
    frame = JSON.parse(raw);
  } catch {
    deps.send({ type: 'error', code: 'BAD-FRAME', message: 'invalid JSON' });
    return;
  }
  if (typeof frame !== 'object' || frame === null || !('type' in frame)) {
    deps.send({ type: 'error', code: 'BAD-FRAME', message: 'missing type discriminator' });
    return;
  }
  const type = (frame as { type: unknown }).type;
  if (type === 'vote') {
    await handleVote(frame as VoteFrame, deps);
    return;
  }
  if (type === 'admin-command') {
    await handleAdminCommand(frame as AdminCommandFrame, deps);
    return;
  }
  deps.send({
    type: 'error',
    code: 'BAD-FRAME',
    message: `unsupported frame type "${String(type)}"`,
  });
}

async function handleVote(frame: VoteFrame, deps: DispatchDeps): Promise<void> {
  if (deps.principal.kind !== 'voter') {
    deps.send({
      type: 'error',
      code: 'UNAUTHORIZED',
      message: 'vote frames require a voter principal',
    });
    deps.closeWith(4001, 'presenter principal sent vote frame');
    return;
  }
  const parsed = votePayloadSchema.safeParse(frame.payload);
  if (!parsed.success) {
    deps.send({ type: 'error', code: 'BAD-FRAME', message: 'invalid vote payload' });
    return;
  }
  const session = await deps.audienceResultsStore.readSnapshot(deps.sessionId);
  if (!session) {
    deps.send({
      type: 'error',
      code: 'LF-AUDIENCE-SNAPSHOT-MISSING',
      message: `session ${deps.sessionId} not found`,
    });
    return;
  }
  if (session.closedAt !== null) {
    emitAudienceLossFlag({
      code: 'LF-AUDIENCE-SESSION-CLOSED',
      message: `vote on closed session ${deps.sessionId}`,
      location: { slideId: deps.sessionId },
    });
    deps.send({
      type: 'error',
      code: 'LF-AUDIENCE-SESSION-CLOSED',
      message: 'session is closed',
    });
    deps.closeWith(4000, 'session-closed');
    return;
  }
  const decision = deps.voterRateLimiter.tryConsume(deps.principal.voterToken);
  if (!decision.accepted) {
    emitAudienceLossFlag({
      code: 'LF-AUDIENCE-VOTER-RATE-LIMITED',
      message: `voter ${deps.principal.voterToken.slice(0, 6)} rate-limited`,
      location: { slideId: deps.sessionId },
    });
    deps.send({
      type: 'error',
      code: 'LF-AUDIENCE-VOTER-RATE-LIMITED',
      message: 'voter rate cap exceeded',
    });
    return;
  }
  await deps.audienceResultsStore.appendEvent({
    sessionId: deps.sessionId,
    eventId: deps.mintEventId(),
    voterToken: deps.principal.voterToken,
    serverTimestamp: deps.now(),
    clientTimestamp: frame.clientTimestamp,
    payload: parsed.data,
    accepted: true,
  });
}

async function handleAdminCommand(frame: AdminCommandFrame, deps: DispatchDeps): Promise<void> {
  void frame;
  if (deps.principal.kind !== 'presenter') {
    deps.send({
      type: 'error',
      code: 'UNAUTHORIZED',
      message: 'admin-command requires a presenter principal',
    });
    deps.closeWith(4001, 'voter principal sent admin-command');
    return;
  }
  const session = await deps.audienceResultsStore.readSnapshot(deps.sessionId);
  if (!session) {
    deps.send({
      type: 'error',
      code: 'LF-AUDIENCE-SNAPSHOT-MISSING',
      message: `session ${deps.sessionId} not found`,
    });
    return;
  }
  // T-453 ships the routing substrate; per-command semantics
  // (open / close / advance / lock) for live-quiz arbitration land in
  // T-473. The current implementation acknowledges the command via a
  // single snapshot frame echoing the current state.
  const snapshot: SnapshotFrame = buildSnapshotFrame(session, deps.now());
  deps.send(snapshot);
}

/**
 * Translate the current `AudienceSessionDoc` into the wire-format
 * `SnapshotFrame` the presenter UI consumes.
 */
export function buildSnapshotFrame(
  session: AudienceSessionDoc,
  serverTimestamp: string,
): SnapshotFrame {
  return {
    type: 'snapshot',
    serverTimestamp,
    aggregation: {
      // T-453 ships the envelope; per-clip-kind aggregation shapes land
      // in T-461..T-471 (the clip families) + T-454 (audience runtime).
      kind: session.clipKind,
      sessionId: session.sessionId,
      snapshotFrame: session.snapshotFrame ?? 0,
    },
    voterCount: session.voterCount,
  };
}

// ----------------------------------------------------------------------------
// Reconnect-budget tracker
// ----------------------------------------------------------------------------

/**
 * Per-voter reconnect-attempt counter. Per ADR-009 §D6: 6 attempts max;
 * thereafter the server closes any new connection with code 4002.
 */
export class ReconnectBudget {
  private readonly attempts = new Map<string, number>();

  /**
   * Note a fresh handshake. Returns `false` if the voter has already
   * exceeded the budget (and the caller should close 4002); `true`
   * otherwise.
   */
  admitOrRefuse(voterToken: string): boolean {
    const prior = this.attempts.get(voterToken) ?? 0;
    if (prior >= 6) return false;
    this.attempts.set(voterToken, prior + 1);
    return true;
  }

  /**
   * Reset a voter's counter on a clean disconnect (the client closed
   * the socket normally; subsequent reconnects start fresh).
   */
  resetOnCleanClose(voterToken: string): void {
    this.attempts.delete(voterToken);
  }

  /** Test-only: read the current attempt count. */
  peek(voterToken: string): number {
    return this.attempts.get(voterToken) ?? 0;
  }

  /** Test-only: clear all tracked voters. */
  reset(): void {
    this.attempts.clear();
  }
}

// ----------------------------------------------------------------------------
// Handshake / authentication
// ----------------------------------------------------------------------------

export interface HandshakeDeps {
  /**
   * Verify a presenter `Authorization: Bearer ...` token. Resolves to
   * `{ principalId, org }` on success; throws on failure.
   */
  verifyPresenterToken(token: string): Promise<{ principalId: string; org: string }>;
  /**
   * Verify a voter-side opaque subprotocol token. The default impl
   * trusts any non-empty token (tests inject a strict verifier); the
   * production implementation cross-checks against the voter-token
   * mint registry (out-of-scope for this PR; T-456 owns mint tracking).
   */
  verifyVoterToken(token: string): Promise<{ ok: boolean }>;
}

export interface HandshakeOutcome {
  readonly ok: boolean;
  readonly principal?: WsPrincipal;
  readonly closeCode?: 4001 | 4002;
  readonly reason?: string;
}

/**
 * Validate a connection's auth posture. Voter token flows via the
 * `sec-websocket-protocol` header (per ADR-009 §D8 transport rule);
 * presenter token flows via `authorization`. Returns the principal +
 * `ok: true` on success; an `ok: false` outcome carries the ADR-009
 * §D6 close code the caller should send.
 */
export async function authenticateHandshake(
  headers: { readonly authorization?: string; readonly subprotocol?: string },
  deps: HandshakeDeps,
  reconnectBudget: ReconnectBudget,
): Promise<HandshakeOutcome> {
  const auth = headers.authorization;
  if (auth) {
    const match = /^Bearer\s+(.+)$/i.exec(auth);
    if (!match || !match[1]) {
      return { ok: false, closeCode: 4001, reason: 'malformed authorization header' };
    }
    try {
      const { principalId, org } = await deps.verifyPresenterToken(match[1]);
      return {
        ok: true,
        principal: { kind: 'presenter', principalId, org },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, closeCode: 4001, reason: `presenter auth failed: ${msg}` };
    }
  }
  const sub = headers.subprotocol;
  if (sub) {
    const voterToken = sub.trim();
    if (voterToken.length === 0) {
      return { ok: false, closeCode: 4001, reason: 'empty voter subprotocol' };
    }
    const verdict = await deps.verifyVoterToken(voterToken);
    if (!verdict.ok) {
      return { ok: false, closeCode: 4001, reason: 'voter token rejected' };
    }
    if (!reconnectBudget.admitOrRefuse(voterToken)) {
      return { ok: false, closeCode: 4002, reason: 'reconnect budget exhausted' };
    }
    return { ok: true, principal: { kind: 'voter', voterToken } };
  }
  return { ok: false, closeCode: 4001, reason: 'no auth header' };
}

// ----------------------------------------------------------------------------
// I/O server (production wiring)
// ----------------------------------------------------------------------------

export interface AudienceWebSocketServerDeps extends HandshakeDeps {
  readonly httpServer: HttpServer;
  readonly audienceResultsStore: AudienceResultsStore;
  readonly voterRateLimiter?: VoterRateLimiter;
  readonly reconnectBudget?: ReconnectBudget;
  /** Path prefix the multiplexer listens on. Default `/v1/audience/ws`. */
  readonly pathPrefix?: string;
  /** Inject for tests. */
  now?(): string;
  mintEventId?(): string;
}

export interface AudienceWebSocketServer {
  readonly wss: WebSocketServer;
  readonly reconnectBudget: ReconnectBudget;
  /** Graceful shutdown — closes every live socket with 4003. */
  close(): Promise<void>;
}

/**
 * Mount the WebSocket multiplexer on the supplied HTTP server. Returns
 * a `close()` for graceful shutdown.
 */
export function createAudienceWebSocketServer(
  deps: AudienceWebSocketServerDeps,
): AudienceWebSocketServer {
  const pathPrefix = deps.pathPrefix ?? '/v1/audience/ws';
  const reconnectBudget = deps.reconnectBudget ?? new ReconnectBudget();
  const voterRateLimiter = deps.voterRateLimiter ?? new VoterRateLimiter();
  const now = deps.now ?? (() => new Date().toISOString());
  const mintEventId = deps.mintEventId ?? defaultMintEventId;

  const wss = new WebSocketServer({ noServer: true });

  deps.httpServer.on('upgrade', (request, socket, head) => {
    void handleUpgrade(request, socket, head);
  });

  async function handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> {
    const url = request.url ?? '';
    if (!url.startsWith(`${pathPrefix}/`)) {
      socket.destroy();
      return;
    }
    const sessionId = url.slice(pathPrefix.length + 1).split('?')[0] ?? '';
    if (sessionId.length === 0) {
      socket.destroy();
      return;
    }

    const authHeader = headerString(request.headers.authorization);
    const subprotocolHeader = headerString(request.headers['sec-websocket-protocol']);
    const outcome = await authenticateHandshake(
      {
        ...(authHeader !== undefined ? { authorization: authHeader } : {}),
        ...(subprotocolHeader !== undefined ? { subprotocol: subprotocolHeader } : {}),
      },
      deps,
      reconnectBudget,
    );
    if (!outcome.ok || !outcome.principal) {
      socket.write(
        `HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\nX-Close-Code: ${outcome.closeCode ?? 4001}\r\n\r\n`,
      );
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      attachConnection(ws, sessionId, outcome.principal as WsPrincipal);
    });
  }

  function attachConnection(ws: WebSocket, sessionId: string, principal: WsPrincipal): void {
    const send = (frame: ServerOutboundFrame): void => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(frame));
      }
    };
    const closeWith = (code: 4000 | 4001 | 4002 | 4003, reason: string): void => {
      try {
        ws.close(code, reason);
      } catch {
        // Socket may already be closing; swallow.
      }
    };
    ws.on('message', (raw) => {
      void dispatchAudienceMessage(raw.toString('utf-8'), {
        sessionId,
        principal,
        audienceResultsStore: deps.audienceResultsStore,
        voterRateLimiter,
        now,
        mintEventId,
        send,
        closeWith,
      });
    });
    ws.on('close', () => {
      if (principal.kind === 'voter') {
        reconnectBudget.resetOnCleanClose(principal.voterToken);
      }
    });
  }

  async function close(): Promise<void> {
    return new Promise((resolve) => {
      for (const client of wss.clients) {
        try {
          client.close(4003, 'server-shutdown');
        } catch {
          // best-effort
        }
      }
      wss.close(() => resolve());
    });
  }

  return { wss, reconnectBudget, close };
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function headerString(v: string | string[] | undefined): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

function defaultMintEventId(): string {
  const c = (globalThis as { crypto?: { randomUUID(): string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  throw new Error('audience-ws: globalThis.crypto.randomUUID is not available');
}
