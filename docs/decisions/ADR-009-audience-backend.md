# ADR-009: Audience Backend

**Date**: 2026-05-11
**Ratified**: 2026-05-14 (orchestrator approval; post-Phase-16 close)
**Status**: **Accepted**
**Supersedes**: N/A
**Superseded by**: N/A

---

## Context

Phase 15 (Live Audience) ships **native interactive audience-engagement primitives** — live polls, Q&A, quizzes, word clouds, surveys, leaderboards, plus three motion-native differentiators (Heatmap, ReactionStream, AudienceAiPrompt) — for `stageflip-slide` and `stageflip-display`, with vendor adapter bridges (Slido / Mentimeter / Poll Everywhere / Vevox / Wooclap). Slido is the canonical incumbent; we render to all three products and exploit the motion + 3D + frontier stack for capabilities Slido structurally cannot reach.

ADR-007 (Provider Seam Pattern, meta) established the uniform `AdapterDescriptor` envelope every adapter shares; this ADR is the **second downstream consumer ADR** (ADR-008 was the first, for asset generation). It defines:

1. The **audience backend service architecture** — WebSocket multiplexer + Firestore `audience-results` collection — extending `apps/api`.
2. The **`AudienceBackendProvider` interface shape** — extends `AdapterDescriptor` with audience-specific call shape and capability descriptor.
3. The **real-time SLA target** — 1000 concurrent voters v1; latency budget; backpressure model.
4. The **rate-limit model** — per-tenant message rate + per-session voter cap.
5. The **WebSocket transport** — connection lifecycle, reconnection, exponential backoff.
6. The **persistence model** — Firestore `audience-results` collection, per-session document shape, aggregation snapshots.
7. The **authentication / authorization model** — tenant-scoped admin token + voter session token (separate trust domains).
8. The **vendor adapter bridge contract** — how Slido / Mentimeter / Poll Everywhere plug into the same seam (one `AudienceBackendProvider` per vendor).
9. An **`AudienceProvenance` schema preview** — full schema lands in ADR-010 (T-451); we name the slots here so T-460 has a forward-citation target.

After this ADR + ADR-010 (T-451) merge, **all** of T-452+ can dispatch: `@stageflip/audience-contract` (T-452), the audience backend service (T-453), `packages/runtimes/audience/` (T-454), the nine v1 clip families (T-461 → T-471), and the five vendor adapters (T-479 → T-483).

ADR-007 §D2 reserved ADR-009 as the consumer ADR for `AudienceBackendProvider`. This ADR fulfils that reservation.

### What this ADR is **not**

- **Not the clip family ADR.** ADR-010 (T-451) defines the nine v1 clips (LivePoll / LiveQA / LiveQuiz / LeaderboardClip / WordCloudClip / SurveyClip + three differentiators: HeatmapClip / ReactionStreamClip / AudienceAiPromptClip), their `staticFallback` snapshot semantics, and the full `AudienceProvenance` schema. ADR-009 covers the backend the clips talk to; ADR-010 covers the clips.
- **Not the runtime tier ADR.** ADR-003 already established the `interactive` runtime tier. `packages/runtimes/audience/` (T-454) extends `interactive` per ADR-003 §D1. This ADR cross-links the extension; it does not redefine the tier contract.
- **Not the live-data integration ADR.** `LiveDataClip` (Phase 13) is broadcast-shaped (one publisher → many readers). Audience is fan-in shaped (many voters → one aggregation). The two seams are distinct; no convergence is attempted.
- **Not a code or schema PR.** Pure docs ADR. The contract shapes specified here land in `@stageflip/audience-contract` (T-452), the service in T-453, the runtime in T-454.

---

## Decisions

### D1. Backend service architecture

The audience backend ships as an extension to the existing `apps/api` service. It does **not** become a separate deployment. Two surfaces:

1. **WebSocket multiplexer** (`/v1/audience/ws/:sessionId`) — per-session bidirectional channel. Voters send vote events (typed payloads per clip kind — multiple-choice index, free-text string, Likert rating, tap-coordinate, emoji-reaction kind, prompt-suggestion string); presenters receive aggregation snapshots at a server-throttled cadence (per §D3 backpressure model). Admin commands (open/close question, advance round, lock votes) flow over the same socket.
2. **Firestore `audience-results` collection** — durable persistence layer. One Firestore document per `(tenantId, projectId, sessionId)` triple; sub-collection `events/` stores append-only vote events; sub-collection `snapshots/` stores periodic aggregation snapshots the clips' `staticFallback` paths consume at export time (per ADR-005 §D2 / T-472).

```
apps/api
├── src/routes/
│   ├── v1/audience/ws/[sessionId]    ← WebSocket endpoint (T-453)
│   ├── v1/audience/sessions          ← REST: create / close / export session (T-453)
│   └── v1/audience/admin/[sessionId] ← REST: admin commands (T-453)
└── (existing auth + tenant routing — preserved)

Firestore
└── tenants/{tenantId}/projects/{projectId}/audience-sessions/{sessionId}/
    ├── (doc fields: createdAt, closedAt, clipKind, voterCount, snapshotFrame, …)
    ├── events/{eventId}     ← append-only voter events; TTL per §D5
    └── snapshots/{frameNo}  ← aggregation snapshots; consumed by staticFallback
```

**Why extend `apps/api` (not a new deployment).** Reuses the existing tenant auth, region routing, observability, and deployment topology. The audience-results data model is small (per-session document + event sub-collection); spinning up a dedicated service would multiply ops surface for a fraction of the load `apps/api` already carries. If the audience-results load profile diverges from the rest of `apps/api` (the SLA target stretches past 1000 concurrent voters per session, or session-count outpaces the multi-tenant index), T-453 can fork the deployment without changing this ADR — the route prefix `/v1/audience` is the natural boundary.

**Why Firestore (not Postgres / Redis).** The existing storage adapter for tenant settings + assets is Firebase (per `packages/storage-firebase/`). Adding a Postgres or Redis dependency would expand the ops footprint for v1; Firestore's per-document append-only `events/` sub-collection + real-time listener primitives map cleanly onto the live-aggregation problem. The persistence tier is abstracted behind the `AudienceBackendProvider` (per §D2) — a future Redis-backed adapter is a one-package add, not an ADR rewrite.

**Why WebSocket (not SSE).** Audience is **bidirectional**: voters push vote events; presenters consume aggregation snapshots; admins push commands (open/close question). SSE only carries server→client. The streaming-agent-events skill notes SSE is correct for one-way agent streams; audience is the opposite shape.

**Out of scope here.** Multi-region replication of audience-sessions (single-region per project for v1); WebSocket transport over QUIC; cross-tenant cache sharing of presenter UIs. T-453 implements the service; this ADR specifies the shape.

### D2. `AudienceBackendProvider` interface shape

`AudienceBackendProvider` extends `AdapterDescriptor` (ADR-007 §D1) with audience-specific call shape and capability descriptor. Lands in `@stageflip/audience-contract` (T-452).

```ts
// Conceptual shape — lands in @stageflip/audience-contract (T-452).

export interface AudienceBackendProvider extends ProviderBase<AudienceCapabilityDescriptor> {
  readonly modality: { kind: 'audience-backend' };

  /**
   * Open a session bound to a clip kind + tenant + project. Returns a
   * SessionHandle the clip's liveMount path uses to push vote events
   * (voter side) or subscribe to aggregation snapshots (presenter side).
   * Calling the same (tenantId, projectId, sessionId) twice MUST return a
   * handle for the existing session — `openSession` is idempotent so a
   * reconnect after a transient network failure picks up where it left off.
   */
  openSession(call: OpenSessionCall): Promise<SessionHandle>;

  /**
   * Submit one vote event. Returns once the event is acknowledged by the
   * backend (durably persisted in the events/ sub-collection). MUST NOT
   * block waiting for the next snapshot; snapshots flow over the
   * subscribe() stream.
   */
  submitVote(call: SubmitVoteCall): Promise<VoteAck>;

  /**
   * Subscribe to aggregation snapshots. Returns an AsyncIterable the
   * presenter UI consumes; snapshots flow at a server-throttled cadence
   * per §D3. Iterator closes when the session is closed (server-initiated)
   * or when the consumer unsubscribes.
   */
  subscribe(call: SubscribeCall): AsyncIterable<AggregationSnapshot>;

  /**
   * Close the session. Server stops accepting votes; final aggregation
   * snapshot is persisted as the session's authoritative result the
   * staticFallback path consumes at export time.
   */
  closeSession(call: CloseSessionCall): Promise<FinalSnapshot>;
}

export interface AudienceCapabilityDescriptor {
  /** Persistence tier the backend supports. */
  readonly persistenceTier: 'durable' | 'session-only' | 'best-effort';

  /** Maximum concurrent voters per session this adapter advertises. */
  readonly maxConcurrentVoters: number;

  /** Clip kinds this adapter can host (vendor adapters typically cover a subset). */
  readonly supportedClipKinds: readonly AudienceClipKind[];

  /** Whether the adapter supports the marquee differentiators (Heatmap / ReactionStream / AudienceAiPrompt). */
  readonly supportsMotionNative: boolean;

  /** Whether voter identity is anonymous (default) or authenticated (e.g., via SSO). */
  readonly voterIdentity: 'anonymous' | 'authenticated' | 'either';

  /** Whether the backend supports the staticFallback snapshot contract (per ADR-010). */
  readonly supportsStaticFallback: boolean;

  /** Maximum events/second per session the backend ingests before backpressure kicks in. */
  readonly maxIngestRateHz: number;

  /** Snapshot cadence the backend emits on the subscribe stream (Hz). */
  readonly snapshotCadenceHz: number;
}

export type AudienceClipKind =
  | 'live-poll-multiple-choice'
  | 'live-poll-open-text'
  | 'live-poll-rating'
  | 'live-qa'
  | 'live-quiz'
  | 'leaderboard'
  | 'word-cloud'
  | 'survey'
  | 'heatmap'
  | 'reaction-stream'
  | 'audience-ai-prompt';

export interface OpenSessionCall {
  readonly tenantId: string;
  readonly projectId: string;
  readonly sessionId: string; // ULID supplied by the editor
  readonly clipKind: AudienceClipKind;
  /** Provider-specific opaque options (e.g., Slido pollId, Mentimeter sessionCode). */
  readonly options?: Record<string, unknown>;
}

export interface SessionHandle {
  readonly sessionId: string;
  readonly joinUrl: string;    // QR / participant landing URL (T-456)
  readonly joinCode: string;   // short code for manual entry
  readonly closedAt?: string;
}

export interface SubmitVoteCall {
  readonly sessionId: string;
  readonly voterToken: string;             // per §D7
  readonly payload: VotePayload;
  readonly clientTimestamp: string;        // voter wall-clock; server stamps authoritative time
}

export interface VotePayload {
  readonly kind: AudienceClipKind;
  readonly value: unknown; // discriminated by kind in @stageflip/audience-contract per ADR-010
}

export interface VoteAck {
  readonly eventId: string;
  readonly serverTimestamp: string;
  readonly accepted: boolean;
  /** Set when rejected; e.g., rate-limited, session-closed, vote-not-allowed-for-this-kind. */
  readonly rejectReason?: string;
}

export interface SubscribeCall {
  readonly sessionId: string;
  /** Admin tokens see full aggregation; presenter-only tokens see the presenter view; voter tokens MAY see a public view per the clip kind. */
  readonly authToken: string;
}

export interface AggregationSnapshot {
  readonly sessionId: string;
  readonly frameNo: number;
  readonly serverTimestamp: string;
  readonly voterCount: number;
  /** Clip-kind-specific aggregation shape; defined in ADR-010 per clip. */
  readonly aggregation: unknown;
}

export interface CloseSessionCall {
  readonly sessionId: string;
  readonly authToken: string;
}

export interface FinalSnapshot extends AggregationSnapshot {
  readonly closedAt: string;
  readonly snapshotFrame: number; // surfaces into AudienceProvenance.snapshotFrame per ADR-010
}
```

**Why one interface for native + vendor.** ADR-007 §D2 reserved exactly one consumer-ADR interface per modality; we honour that. The native backend (`@stageflip/audience-native`, T-478) implements this against `apps/api` + Firestore. Each vendor bridge (`@stageflip/audience-slido`, `@stageflip/audience-mentimeter`, `@stageflip/audience-polleverywhere`, `@stageflip/audience-vevox`, `@stageflip/audience-wooclap`, T-479 → T-483) implements the same interface against the vendor's API; per-vendor mismatches (e.g., Slido does not support Heatmap) surface via `supportedClipKinds` filtering, not interface variation.

**Why call/result shapes are sketched, not normative here.** ADR-009 fixes the descriptor envelope + the four-method contract surface. T-452 (`@stageflip/audience-contract`) ships the precise call/result types; ADR-010 (T-451) defines the per-clip-kind `VotePayload.value` and `AggregationSnapshot.aggregation` shapes. The shapes above document the cross-cutting envelope and the discriminating fields the routing engine reads.

**Why `submitVote` returns an ack (not fire-and-forget).** A voter retry path is required for "vote didn't register" UX — without an ack, the voter UI can't distinguish "vote-accepted" from "transient socket failure". The ack is durable (the event is in the `events/` sub-collection before ack returns); rate-limit refusals (per §D3) return `accepted: false` with `rejectReason`.

### D3. Rate-limit model

Two layers, enforced by the audience backend service (T-453) before any event reaches the Firestore `events/` sub-collection:

1. **Per-tenant message rate** — bounded by `TenantSettings.features.audience.maxIngestRateHz` (extension of T-411a `TenantSettings`; default `100 Hz` per tenant aggregated across all live sessions). Exceeding this triggers a 429 + `LF-AUDIENCE-TENANT-RATE-LIMITED` loss flag on the requesting voter's socket. The token bucket refills at the configured rate; bursts up to `2× rate` are admitted.

2. **Per-session voter cap** — bounded by the adapter's `AudienceCapabilityDescriptor.maxConcurrentVoters` (per §D2) and the tenant's `TenantSettings.features.audience.maxConcurrentVotersPerSession` (default 1000; matches the SLA target in §D4). The server refuses `openSession` if the cap is met for the requesting tenant; voters joining after the cap are queued (best-effort, with a "you'll be admitted shortly" UX surface) or rejected (when the queue would exceed cap × 1.5).

3. **Per-voter rate (anti-spam)** — bounded at the adapter level (default `1 vote / 500 ms` per voter token; clip-kind-specific override for ReactionStream which allows `10 reactions / second` per voter). Exceeding this triggers `LF-AUDIENCE-VOTER-RATE-LIMITED`; vote is dropped silently to avoid a spammer learning the cap.

**Backpressure model**: when the per-session ingest rate exceeds `maxIngestRateHz`, the backend **drops** vote events (returns `accepted: false`, `rejectReason: 'rate-limited'`) rather than queuing. Dropping is acceptable for live audience aggregation — a missed vote in a 1000-voter poll affects the count by 0.1% and the rapid-snapshot cadence (per §D6 below) re-aggregates from the durable `events/` sub-collection so eventual consistency is preserved. Queuing would buffer the spike, force the snapshot cadence to lag, and break the live-aggregation latency SLA (per §D4).

**Why per-tenant + per-session + per-voter** (three layers). Per-tenant defends the platform against a runaway tenant. Per-session defends each presentation from a noisy-neighbor session. Per-voter defends each session from a single spammer. Without all three, a botnet against a single session would exhaust the tenant's budget for the day.

**Where the policy lives**: `TenantSettings.features.audience.{maxIngestRateHz, maxConcurrentVotersPerSession}` (extends T-411a's `TenantSettingsStore` via the same 3-method contract; no new storage facet needed). The per-voter cap is hardcoded in the native adapter; vendor adapters inherit the vendor's policy.

### D4. SLA target (1000 concurrent voters v1; latency budget)

**Target**: 1000 concurrent voters per session, sustained for the duration of a typical 60-minute keynote. **Latency budget** (per T-475 load test):

| Hop | Target | Hard ceiling |
|---|---|---|
| Voter tap → backend ack | p50 < 100 ms | p95 < 250 ms |
| Backend persist (events/ sub-collection write) | p50 < 50 ms | p95 < 150 ms |
| Snapshot aggregation (events → AggregationSnapshot) | p50 < 100 ms | p95 < 300 ms |
| Backend → presenter socket frame | p50 < 50 ms | p95 < 150 ms |
| **End-to-end (voter tap → presenter screen)** | **p50 < 200 ms** | **p95 < 500 ms** |

The end-to-end ceiling matches T-475's explicit acceptance criterion (`p50 < 200 ms, p95 < 500 ms voter-tap → screen`). Vendor adapters inherit the vendor's own SLA; the routing engine surfaces the vendor's `latencyMs` hint (per ADR-007 §D1) so the editor's adapter picker can warn when a vendor adapter's stated latency exceeds the SLA budget.

**Why 1000 (not 10k).** The v1 target is "a typical keynote" (one auditorium, one host). 10k requires a different ingestion architecture (Pub/Sub fan-in instead of direct Firestore writes) and is gated on T-477 demonstrating 1000 is comfortable headroom for that path's design constraints. **Future SLA target**: 10k concurrent voters via Pub/Sub-fronted ingestion; out-of-scope for v1.

**Why p95 (not p99).** Audience latency is bursty (network jitter dominates from venue wifi); p99 measurements at 1000 voters across heterogeneous client networks would be dominated by client-side outliers. p95 cleanly separates server-side health from voter-network health.

**Per-clip-kind latency variance**: HeatmapClip (T-469) renders raster-snapshot aggregations and is allowed a relaxed budget (p50 < 400 ms voter-tap → screen) given the aggregation cost; ReactionStreamClip (T-470) renders particle storms via ShaderClip and is allowed a relaxed presenter-frame cadence (10 Hz instead of 30 Hz) since the visual is high-density-by-design. These per-kind exceptions are documented in ADR-010; ADR-009 establishes the default budget.

### D5. Persistence model

Per-session Firestore document shape (lands in T-453's storage layer):

```
/tenants/{tenantId}/projects/{projectId}/audience-sessions/{sessionId}
├── (root doc fields)
│   ├── createdAt:       ISO 8601
│   ├── closedAt:        ISO 8601 | null
│   ├── clipKind:        AudienceClipKind
│   ├── voterCount:      number       (server-maintained running count)
│   ├── snapshotFrame:   number | null (set on close; references the final snapshot)
│   ├── adapterDescriptor: { id, license }  (audit: which adapter served this session)
│   └── ttlAt:           ISO 8601     (per the TTL policy below)
├── events/{eventId}     (append-only sub-collection)
│   ├── eventId:        ULID (server-assigned at write)
│   ├── voterToken:     opaque per-voter token (per §D7); hashed at rest
│   ├── serverTimestamp: ISO 8601
│   ├── clientTimestamp: ISO 8601
│   ├── payload:        VotePayload
│   └── accepted:       boolean (false rows kept for audit; not aggregated)
└── snapshots/{frameNo}  (server-emitted aggregation snapshots)
    ├── frameNo:        number
    ├── serverTimestamp: ISO 8601
    ├── voterCount:     number
    └── aggregation:    clip-kind-specific shape (per ADR-010 — opaque to ADR-009)
```

**TTL posture**: every session document carries a `ttlAt` field that drives a Firestore TTL policy. Default `ttlAt = closedAt + 90 days` for closed sessions; `ttlAt = createdAt + 24 hours` for sessions that opened but never closed (orphan sweep). Tenant policy (`TenantSettings.features.audience.retentionDays`) overrides the default per-tenant. EU-residency tenants pin the document to the EU multi-region (per the existing `storage-firebase` region-router pattern); no audience-results data crosses the residency boundary.

**Voter-token hashing at rest**: per-voter tokens (the `voterToken` opaque string) are stored hashed (SHA-256 with a per-tenant pepper) in the `events/` sub-collection so the durable log carries no plaintext voter identifier. The pepper is stored on the audience-backend service alongside the tenant credential; rotation invalidates per-voter retry continuity but preserves aggregation. This is the audience analog of the consent-row audit posture from ADR-008 §D4 (audit-load-bearing, append-mostly, per-row sensitive).

**Snapshot cadence**: the backend emits aggregation snapshots at a default `30 Hz` for live-aggregating clips (LivePoll, LiveQA, LiveQuiz, WordCloud, Leaderboard) and `5 Hz` for ReactionStream (per §D4 per-kind override). Each snapshot is persisted in `snapshots/{frameNo}` so the `staticFallback` path (ADR-010) can render any historical frame without re-aggregating from `events/`. The cadence is the adapter's `AudienceCapabilityDescriptor.snapshotCadenceHz` (per §D2).

**Aggregation snapshots vs. final snapshot**: every snapshot is a point-in-time aggregation; the **final snapshot** persisted on `closeSession` is authoritative — it is the one `staticFallback` paths consume at export time, and the one `AudienceProvenance.snapshotFrame` (per ADR-010 / §D9 below) references.

**Why a sub-collection for events**: per-event documents enable Firestore's native real-time listener primitive (the backend subscribes to the `events/` sub-collection internally to feed the snapshot aggregator); per-event documents also enable per-event audit (which voter cast which vote, at what server time, did the rate-limit gate admit it). A monolithic events-array on the root document would not scale past ~10MB of event payload (Firestore document size cap) and would force every snapshot read to deserialize the entire history.

**Why snapshots are persisted (not held in memory)**: server crashes between snapshots must not lose the running aggregation, and the staticFallback path needs random access to historical frames at export time (T-472). Holding snapshots in memory only is a less-defensive design.

### D6. WebSocket transport — connection lifecycle, reconnection, backoff

Connection lifecycle:

```
1. Client opens WebSocket to /v1/audience/ws/:sessionId with Authorization header
   carrying the voter session token (per §D7) or the presenter admin token.

2. Server validates token; on failure closes the socket with code 4001
   (unauthorized) + reason string. On success acks with a HELLO frame
   carrying the server's heartbeat cadence (default 30 s).

3. Client sends VOTE frames (voter side) or pulls SNAPSHOT frames
   (presenter side); admin sends COMMAND frames. All frames are
   length-prefixed JSON; protocol shape lands in T-452 + T-453.

4. Either side may send PING; the other side replies PONG within
   <heartbeat cadence> or the socket is considered stale and closed.

5. On client-initiated close, server flushes any pending VoteAck and
   closes cleanly with code 1000.

6. On server-initiated close (session-closed, server restart),
   code 4000 (session-closed) or 4002 (server-shutdown) with reason.
```

**Reconnection policy** (client-side):

- On unexpected close (codes 1006, 4002, 4003) the client SHOULD retry with **exponential backoff**: `delay = min(30s, base * 2^attempt + jitter)` where `base = 250 ms` and `jitter` is `±20%`. Maximum **6 attempts** before surfacing `LF-AUDIENCE-CONNECTION-LOST` to the editor + voter UI.
- On 4001 (unauthorized) the client MUST NOT retry — the token is rejected; user re-auth is required.
- On 4000 (session-closed by server) the client MUST NOT retry — the session is over; voter UI surfaces "Voting closed".
- Voter tokens are scoped to one session; reconnecting picks up where it left off (the backend correlates by `(tenantId, sessionId, voterToken)` and replays any missed snapshots if requested via the HELLO frame's `replayFrom: frameNo` field).

**Heartbeat**: 30 s default; lowered to 10 s for sessions with `clipKind === 'reaction-stream'` (high-frequency interaction; staler heartbeat would mask network issues that show up as visual stutter). The cadence is the server's choice, not the client's; client honours whatever the HELLO frame declared.

**Backoff cap rationale**: 6 attempts × max 30 s = ~2 minutes of retries. Beyond that the voter is almost certainly behind a hostile network (captive portal, blocked ws://); surfacing the loss flag and prompting the voter to refresh is better UX than continuing to retry silently. The editor's presenter view follows the same policy but with a louder UI prompt (presenter cannot quietly lose the session mid-keynote).

**Why exponential backoff (not constant retry).** Constant retry across 1000 voters all reconnecting after a 10s server blip generates a thundering herd that prevents the server from recovering. Jittered exponential backoff staggers the reconnect attempts so the server's capacity ramps up smoothly.

### D7. Authentication / authorization model

Two distinct trust domains:

1. **Presenter / admin token** — tenant-scoped, issued by the existing `apps/api` auth service (the same OAuth flow the editor uses). Grants `openSession`, `closeSession`, admin commands (open/close question, advance round, lock votes), and full aggregation subscribe. Stored in the editor session; not exposed to voters.

2. **Voter session token** — session-scoped, anonymous-by-default, issued by the backend on the voter landing page (T-456) after the voter joins via QR / code. Grants `submitVote` for the bound session only + public-view subscribe (if the clip kind exposes one). Carries no PII; the per-voter token is a random ULID stamped at the join step; hashing-at-rest (per §D5) means the durable log never exposes the plaintext token.

**Why two trust domains**: presenter compromise reveals tenant credentials; voter compromise reveals a single session's votes. A unified token would conflate the two blast radii. The split also lets vendor bridges map their own admin/voter split (Slido, Mentimeter, Vevox all separate admin auth from voter join codes) onto a uniform StageFlip-side contract.

**Authenticated voters** (the `voterIdentity: 'authenticated' | 'either'` capability per §D2): a future enterprise-tenant story (corporate town-hall with SSO-authenticated employees). v1 ships `anonymous`; the descriptor flag is provisioned so the routing engine can prefer authenticated-capable adapters when a tenant policy requires it (`TenantSettings.features.audience.requireAuthenticatedVoters`).

**Vote rate-limit enforcement** uses the voter token as the key (per §D3 per-voter rate); voter rotation (a voter rejoining and getting a new token to evade the cap) is a known abuse vector and is rate-limited at the join step (per-IP cap on join-token issuance; per T-458 implements). This is documented as a known limitation; PII-grade voter binding is gated on the authenticated-voter posture.

**Token transport**: voter tokens flow over the WebSocket subprotocol header at handshake time (not in the URL — URL-borne tokens leak via referrer / logging). Presenter tokens use the standard `Authorization: Bearer <token>` header. Both are scoped (per §D3) so leakage of a voter token grants nothing beyond the single session.

### D8. Vendor adapter bridge contract

Each vendor adapter implements `AudienceBackendProvider` (per §D2) against the vendor's API. The bridge translates StageFlip-side calls into vendor calls; the vendor's response is normalized into the ADR-009 result shapes.

**Adapter responsibilities** (uniform across vendors):

1. Translate `openSession` → vendor's create-poll / create-session API call. Return a `SessionHandle` whose `joinUrl` + `joinCode` come from the vendor (since the audience joins via the vendor's URL infrastructure when using a vendor adapter — Slido participants go to slido.com, not our backend).
2. Translate `submitVote` → vendor's vote API call. Voters using a vendor adapter go through the vendor's joining flow; the StageFlip presenter UI is the only StageFlip-side surface (per the "Slido API → render via our presets (not via embed)" rationale on T-479).
3. Translate vendor-side aggregation pushes → ADR-009 `AggregationSnapshot` shape on the `subscribe` AsyncIterable. Vendor cadence may be lower than the native backend's 30 Hz; the adapter declares `snapshotCadenceHz` in its descriptor honestly.
4. Surface per-vendor mismatches via `supportedClipKinds`. Slido does not support HeatmapClip; the Slido adapter omits `'heatmap'` from `supportedClipKinds`. The routing engine refuses to dispatch a Heatmap clip against the Slido adapter.

**Vendor parity matrix** (illustrative; precise vendor capabilities ratified in T-485 regression suite):

| Adapter | live-poll-* | live-qa | live-quiz | leaderboard | word-cloud | survey | heatmap | reaction-stream | audience-ai-prompt |
|---|---|---|---|---|---|---|---|---|---|
| `audience-native` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `audience-slido` | ✓ | ✓ | ✓ | partial[¹] | ✓ | ✓ | ✗ | ✗ | ✗ |
| `audience-mentimeter` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `audience-polleverywhere` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `audience-vevox` | ✓ | ✓ | partial[²] | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ |
| `audience-wooclap` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |

[¹] Slido leaderboard tied to its quiz feature only; standalone leaderboard not supported.
[²] Vevox quiz API has tighter timing constraints; T-485 verifies behaviour.

**Marquee differentiators (Heatmap, ReactionStream, AudienceAiPrompt) are native-only**: the three motion-native clips exploit the StageFlip clip pipeline + (for AudienceAiPrompt) the Phase 14 asset-gen contract; no vendor exposes equivalent primitives. The routing engine routes these to the native adapter unconditionally; if the native adapter is unavailable (e.g., tenant has only vendor adapters licensed), the clip falls through to `staticFallback` (per ADR-010).

**Manifest declaration** (Phase 16 marketplace alignment, ADR-007 §D12): each vendor adapter ships as a plugin with a manifest declaring `contributes.kind: audience-backend-provider`. The descriptor includes the `supportedClipKinds`, `maxConcurrentVoters` (vendor's stated cap), and `voterIdentity` flag. Plugin ratification at install time validates the descriptor against the v1 vendor parity matrix.

**Why a uniform interface across native + vendor**: the editor's adapter picker should treat the choice between native and vendor as a routing decision, not an API surface decision. Distinct interfaces per vendor would force the editor to special-case each vendor's UX. Uniform interface + capability filtering achieves both: tenants choosing Slido see the Slido-supported clip kinds in the picker; native-tenant users see the full set including the three differentiators.

### D9. `AudienceProvenance` schema preview (full schema in ADR-010)

ADR-010 (T-451) defines the full `AudienceProvenance` schema with all slots and the per-clip-kind `aggregation` shapes. ADR-009 names the slots so T-460 (`AudienceProvenance` type) has a forward-citation target.

```ts
// PREVIEW only — final schema lands in ADR-010 + T-460.
//
// `AudienceProvenance` is the audience analog of `MediaProvenance` (ADR-008
// §D2): a strict, optional slot on the persisted clip element capturing how
// the static-fallback snapshot was produced, when, and from which session.

export interface AudienceProvenance {
  /** Adapter that served the session (descriptor.id from §D2). */
  readonly provider: string;

  /** Stable session id (the `sessionId` from §D2). */
  readonly sessionId: string;

  /** The frame number of the final aggregation snapshot the staticFallback path renders. */
  readonly snapshotFrame: number;

  /** Voter count captured at the snapshot frame. */
  readonly voterCountAtCapture: number;

  /** ISO 8601 of session close (matches the `closedAt` from §D5). */
  readonly capturedAt: string;

  // --- ADR-010 will add per-clip-kind aggregation slots here ---
  // (e.g., voteDistribution for LivePoll, topQuestions for LiveQA, …)
}
```

**Why a preview, not the full schema, in ADR-009**: the audience backend ADR establishes the lifecycle that produces the snapshot; the clip-family ADR establishes the per-clip-kind shape of the snapshot. Splitting along that boundary keeps each ADR scoped to its concern. T-451 (ADR-010) lands the full shape; T-460 implements it.

**Audit trail**: `provenance.provider` records which adapter served the session — `audience-native`, `audience-slido`, etc. Exporters consuming the static-fallback snapshot (PPTX / MP4 / display) MAY surface "Powered by Slido" attribution when `provenance.provider === 'audience-slido'`; v1 does not require it but the slot is provisioned.

### D10. Determinism posture

The audience backend (`apps/api` extension) and the audience adapter packages are **outside** the determinism perimeter (CLAUDE.md §3 covers `packages/frame-runtime/**`, `packages/runtimes/**/src/clips/**`, `packages/renderer-core/src/clips/**`). Backends freely use `Date.now()`, `setTimeout`, RNGs, network, and filesystem.

The `audience` runtime (T-454, `packages/runtimes/audience/`) sits inside the perimeter because it lives under `packages/runtimes/**` per ADR-003. Per the same posture as ADR-003 / ADR-005 for the interactive tier: the `liveMount` path of an audience clip uses non-deterministic primitives (network, time, RNG) at runtime; the `staticFallback` path renders from a persisted snapshot (per §D5 + §D9) and is deterministic-by-construction — same snapshot → same frame output regardless of when rendered.

**Static-fallback determinism**: the snapshot frame the parity harness renders against is the persisted `AggregationSnapshot` (per §D5); given identical snapshot bytes, the clip's `staticFallback` path emits identical pixels. T-476 verifies via Cluster I parity fixtures. Parity goldens are signed off in the normal flow.

**Live-aggregation latency variability**: same voter input across two live runs MAY produce different per-frame `voterCount` trajectories (network jitter, snapshot cadence interaction); the **final snapshot** is reproducible-given-identical-events because the aggregation is deterministic over the persisted `events/` sub-collection. The live path is observably non-deterministic; the export-time path is contractually deterministic.

### D11. Loss-flag inventory

This ADR adds the audience-backend loss flags. All land in `@stageflip/loss-flags` via T-452 (the `@stageflip/audience-contract` task is the natural carrier; the audience-backend service T-453 consumes them on the server side, individual clips T-461..T-471 emit them on the runtime side).

| Code | Severity | Category | When emitted |
|---|---|---|---|
| `LF-AUDIENCE-TENANT-RATE-LIMITED` | warn | other | Per-tenant ingest rate exceeded (§D3); voter sees retry-after backoff |
| `LF-AUDIENCE-VOTER-RATE-LIMITED` | info | other | Per-voter rate exceeded (§D3); vote dropped silently |
| `LF-AUDIENCE-SESSION-CLOSED` | info | other | Voter attempted to submit after the session closed (§D6 close code 4000) |
| `LF-AUDIENCE-CONNECTION-LOST` | error | other | WebSocket reconnect budget exhausted (§D6, 6 retries × max 30s) |
| `LF-AUDIENCE-ADAPTER-UNAVAILABLE` | error | other | Routing engine could not find an `AudienceBackendProvider` for the requested clip-kind / tenant combo |
| `LF-AUDIENCE-VENDOR-API-FAILURE` | warn | other | Vendor adapter received a non-2xx from the vendor's API; retry budget kicked in; final outcome flagged separately |
| `LF-AUDIENCE-SNAPSHOT-MISSING` | warn | other | `staticFallback` path requested a `snapshotFrame` that is not in `snapshots/` (corruption signal; renderer falls through to "Voting closed" placeholder) |
| `LF-AUDIENCE-CAPACITY-CAP` | warn | other | `openSession` refused because per-tenant `maxConcurrentVotersPerSession` is reached |

Successful retry / reconnect is **not** a loss flag (matches ADR-007 §D8 D9 — reconnect is UI-toast, not loss-flag). Loss flags surface in the reporter UI (T-248); voter-side flags surface in the voter landing page UX (T-456).

### D12. Plugin / adapter contribution surface (Phase 16 alignment)

ADR-007 §D12 ratified the manifest shape every plugin uses to declare seam contributions. ADR-009 adds the audience-specific declaration shape:

```yaml
# Audience-backend-specific extension to the §D12 manifest from ADR-007.
contributes:
  - kind: audience-backend-provider
    name: audience-slido
    descriptor:
      sourceGrounded: false
      capability:
        persistenceTier: durable
        maxConcurrentVoters: 5000     # Slido enterprise plan cap
        supportedClipKinds:
          - live-poll-multiple-choice
          - live-poll-open-text
          - live-poll-rating
          - live-qa
          - live-quiz
          - word-cloud
          - survey
        supportsMotionNative: false
        voterIdentity: anonymous
        supportsStaticFallback: true
        maxIngestRateHz: 200
        snapshotCadenceHz: 5         # Slido's polling cadence; lower than native
      license: proprietary-byo
      sandbox: { remote-service: SLIDO_API_URL }
      costPerCall: { unit: 'session', amount: 0.00 }   # tenant pays Slido directly
      latencyMs: { p50: 800, p95: 2500 }                # vendor's stated SLA

  - kind: audience-backend-provider
    name: audience-native
    descriptor:
      sourceGrounded: false
      capability:
        persistenceTier: durable
        maxConcurrentVoters: 1000          # v1 SLA cap (§D4)
        supportedClipKinds:                # full set including motion-native
          - live-poll-multiple-choice
          - live-poll-open-text
          - live-poll-rating
          - live-qa
          - live-quiz
          - leaderboard
          - word-cloud
          - survey
          - heatmap
          - reaction-stream
          - audience-ai-prompt
        supportsMotionNative: true
        voterIdentity: either
        supportsStaticFallback: true
        maxIngestRateHz: 1000             # native ingest ceiling
        snapshotCadenceHz: 30
      license: apache-2.0
      sandbox: { in-process }
      costPerCall: { unit: 'voter-event', amount: 0.000001 }
      latencyMs: { p50: 50, p95: 200 }
```

**Plugin ratification at install time** validates: every `audience-backend-provider` declaring `supportsMotionNative: true` MUST list all three motion-native kinds (`heatmap`, `reaction-stream`, `audience-ai-prompt`) in `supportedClipKinds`; partial motion-native claims are rejected. This keeps the descriptor flag meaningful for the routing engine (a `supportsMotionNative: true` adapter is contractually offering all three).

### D13. Permissions manifest cross-reference

Per ADR-005 §D2 (clip permissions manifest) + T-455 (`check-audience-permissions` CI rule): every Live Audience clip declares `permissions: ['audience-network']` in its clip manifest. The `audience-network` permission grants the clip's `liveMount` path the capability to open WebSocket connections to the audience-backend service.

Tenant policy controls whether `audience-network` is grantable (`TenantSettings.features.audience.enabled`). Tenants with audience disabled get the `staticFallback` path for any audience clip at render time; the `liveMount` path is denied at permission check, emitting `LF-PERMISSION-DENIED` (existing flag, per ADR-005 §D3).

**Why a dedicated permission (not piggyback on `network`)**: the `network` permission is too broad — it grants any HTTP fetch; `audience-network` is scoped to the audience-backend service's origin allowlist. T-484 ships the allowlist update applying the ADR-005 amendment that landed in T-393 (`WebEmbedClip` `liveMount`); the audience-network allowlist follows the same pattern.

---

## Out-of-scope decisions (deferred)

| Question | Punted to |
|---|---|
| `@stageflip/audience-contract` package layout (per-call shapes + Zod parsers) | T-452 |
| Audience backend service implementation (`apps/api` extension + Firestore wiring) | T-453 |
| `packages/runtimes/audience/` runtime tier (interactive tier extension per ADR-003) | T-454 |
| `check-audience-permissions` CI rule implementation | T-455 |
| Voter-join UX (QR + code modal + landing page) | T-456 |
| `tools/audience-engagement/SKILL.md` semantic tool bundle (#19) | T-457 |
| Rate-limit / spam-protection implementation (per-IP + per-session + per-voter caps) | T-458 |
| CSV / JSON post-event analytics export | T-459 |
| `AudienceProvenance` schema implementation (Zod + element-base merge) | T-460 |
| Per-clip-kind `VotePayload.value` + `AggregationSnapshot.aggregation` shapes | ADR-010 (T-451) |
| Clip-family implementations (LivePoll / LiveQA / LiveQuiz / WordCloud / Survey / Leaderboard) | T-461 → T-468 |
| Three marquee differentiators (HeatmapClip / ReactionStreamClip / AudienceAiPromptClip) | T-469 / T-470 / T-471 |
| Static-fallback consolidated for all 9 v1 clips | T-472 |
| Quiz fairness — tie-breaking, late-joiner, disconnect/reconnect | T-473 |
| Audience-data persistence — TTL + EU residency posture (the policy is in §D5; T-474 implements) | T-474 |
| Live-aggregation latency tests (p50 < 200 ms, p95 < 500 ms) | T-475 |
| Cluster I parity fixtures (static-fallback paths) | T-476 |
| Audience-backend SLA load test — 1000 concurrent voters via K6 | T-477 |
| `@stageflip/audience-native` reference implementation | T-478 |
| Vendor adapters (Slido / Mentimeter / Poll Everywhere / Vevox / Wooclap) | T-479 → T-483 |
| WebEmbed allowlist update for audience origins | T-484 |
| Vendor adapter regression suite | T-485 |
| Cluster I preset cluster (~6 presets) | T-486 |
| Cluster I `SKILL.md` + `compose_*` semantic tools | T-487 |
| GA readiness + security review (auth flow, websocket abuse vectors, voice-clone if AudienceAiPromptClip uses TTS) | T-488 |
| 10k concurrent voter SLA (Pub/Sub-fronted ingestion) | Future generalization (post-v1) |
| Multi-region replication of audience-sessions | Future generalization (post-v1) |
| Authenticated voters via tenant SSO | Future enterprise story (descriptor flag provisioned in §D2 / §D7) |
| Vendor cost-pass-through accounting (per-vendor billing for tenants on a unified invoice) | Out-of-scope for Phase 15; tracked separately if/when commercial demand surfaces |

---

## Consequences

### Immediate (Phase 15 α dispatch unblock)

- **T-451** (ADR-010 Live Audience Clip Family) cites this ADR for the backend lifecycle; ADR-010 defines the per-clip-kind shapes that ride this ADR's transport.
- **T-452** (`@stageflip/audience-contract`) implements the `AudienceBackendProvider` interface from §D2 + the eight loss-flag codes from §D11.
- **T-453** (audience backend service) implements the `/v1/audience/*` route family in `apps/api` + the Firestore `audience-results` collection per §D1 / §D5. Honours the rate-limit model from §D3 and the WebSocket lifecycle from §D6.
- **T-454** (`packages/runtimes/audience/`) extends the `interactive` runtime tier per ADR-003 §D1 with the audience-clip permission scope per §D13.
- **T-455** (`check-audience-permissions`) enforces the `permissions: ['audience-network']` requirement on every audience clip per §D13.
- **T-456** (audience-join UX) consumes `SessionHandle.{joinUrl, joinCode}` per §D2.
- **T-457** (`tools/audience-engagement/SKILL.md`) is the canonical tool bundle #19; cites this ADR + ADR-010.
- **T-458** (rate-limit / spam protection) implements §D3.
- **T-459** (CSV / JSON post-event analytics) reads the Firestore `audience-sessions/{sessionId}/snapshots/` sub-collection per §D5.
- **T-460** (`AudienceProvenance` type) implements the preview from §D9 + the per-clip-kind extension from ADR-010.

### Downstream (Phase 15 β + γ)

- All nine v1 clip families (T-461 → T-471) consume the `AudienceBackendProvider` interface from §D2.
- The five vendor adapters (T-479 → T-483) implement the same interface; per-vendor capability mismatches surface via `supportedClipKinds` per §D8.
- T-472 (static-fallback paths consolidated) consumes `FinalSnapshot.snapshotFrame` + the per-clip-kind `aggregation` shapes per §D9 + ADR-010.
- T-475 (latency tests) verifies the §D4 SLA budget.
- T-477 (SLA load test) verifies the 1000-concurrent-voter target.

### Downstream (Phase 16)

- Phase 16 marketplace plugin ratification gate consumes the §D12 manifest validation rules (motion-native flag implies all three motion-native kinds).
- Vendor-adapter packs are bundle-shape candidates (one bundle per vendor) per ADR-007 §D12 + the eventual ADR-012 bundle-format ADR.

### Ongoing

- New audience clip-kind → expand `AudienceClipKind` discriminated union in §D2 + add per-clip-kind `VotePayload.value` + `AggregationSnapshot.aggregation` shapes in ADR-010 + add a row to the §D8 vendor parity matrix.
- New vendor adapter → implement `AudienceBackendProvider` against the vendor; add to the §D8 vendor parity matrix; ship `@stageflip/audience-<vendor>` package.
- New rate-limit posture (e.g., per-region cap) → expand §D3 + bump the policy slot in `TenantSettings.features.audience`.
- 10k concurrent voter SLA → new ADR for Pub/Sub-fronted ingestion; this ADR's interface stays unchanged (the routing engine selects the higher-capacity adapter; descriptor flag does the work).

### Risks

- **Firestore write-rate ceilings**. The audience-results sub-collection write rate at 1000 concurrent voters at peak vote density (e.g., a 5-second poll window with 1000 simultaneous taps) approaches Firestore's per-document-collection write-rate limits. §D3 backpressure (drop, not queue) keeps the rate bounded; T-477 load test verifies headroom. If the load profile is tighter than expected, T-453 introduces an in-memory aggregator that batches writes (acceptable trade: dropped writes lose individual audit-row granularity but preserve aggregation accuracy).
- **Vendor API rate-limit ceilings**. Each vendor adapter is bounded by the vendor's own API rate limits (Slido: ~100 req/min for free tier, ~1000/min enterprise). The adapter surfaces `LF-AUDIENCE-VENDOR-API-FAILURE` on 429s; tenants using vendor adapters at scale may need vendor enterprise tier. Documented as a tenant-facing caveat in T-457's SKILL.
- **WebSocket through hostile networks**. Some venue / corporate networks block ws:// or wss:// outright. Fallback (long-polling / SSE-only) is out-of-scope for v1; the voter UX surfaces `LF-AUDIENCE-CONNECTION-LOST` after the §D6 retry budget exhausts. A future fallback transport is tracked as a future generalization.
- **Vendor parity drift**. The §D8 parity matrix is illustrative; the actual vendor capabilities are confirmed by T-485's regression suite. If a vendor adds a clip-kind we don't support (e.g., a vendor-specific "ranking" clip), we either add the kind to `AudienceClipKind` (new clip-family work) or accept the gap; matrix is the single source of truth.
- **Permission scope surface**. The `audience-network` permission (per §D13) grants WebSocket egress to the audience-backend origin. Misconfigured allowlists (T-484) would either over-grant (security risk) or under-grant (clip stuck on `staticFallback`). T-455's CI rule + the ADR-005 amendment T-393 landed are the controls; verified at GA review (T-488).
- **Voter-token enumeration**. Per-voter tokens are random ULIDs; a brute-force enumeration of in-flight session tokens is theoretically possible but bounded by §D3's per-voter rate cap and the 26⁶-bit token space. Documented as accepted-risk for anonymous-voter posture; the authenticated-voter path (§D7 future) closes this gap.

---

## Alternatives Considered

### A. Separate audience-backend deployment (not an `apps/api` extension)

**Rejected per §D1.** A dedicated `apps/audience-backend` would multiply ops surface (deployment pipeline, observability hooks, region routing, tenant-auth wiring) for v1 load that `apps/api` can already absorb. The route prefix `/v1/audience` is a natural fork point if T-453 + T-477 surface that the load profile diverges from the rest of `apps/api`; deferring the deployment fork until evidence justifies it is the more conservative choice.

### B. Postgres or Redis instead of Firestore for the audience-results store

**Rejected per §D1.** Postgres would add a new storage adapter family (the existing `packages/storage-firebase` doesn't support it); Redis would solve the live-aggregation read latency but not the durable-audit requirement (per §D5 `events/` sub-collection). Firestore's real-time listener primitives + append-only sub-collection semantics match the live-aggregation problem natively. The `AudienceBackendProvider` interface (§D2) is storage-tier-agnostic — a future Redis-backed adapter is a one-package add.

### C. SSE-only transport (no WebSocket)

**Rejected per §D1.** SSE is one-way (server→client). Audience is bidirectional: voters push events, presenters subscribe, admins push commands. Two unidirectional streams (one SSE per direction) would double connection count + complicate the admin-command path. WebSocket is the natural shape; the streaming-agent-events skill's SSE preference is for one-way agent streams, the opposite shape.

### D. Unified presenter+voter trust domain (one token type)

**Rejected per §D7.** Voter token compromise reveals one session's votes; presenter token compromise reveals tenant credentials. A unified token would conflate these blast radii. The two-domain split also lets vendor bridges map their own admin/voter split (Slido, Mentimeter, Vevox all separate admin auth from voter join codes) onto a uniform StageFlip-side contract.

### E. Queue (not drop) on rate-limit exceedance

**Rejected per §D3.** Queuing at 1000 voters tapping in a 5-second window would buffer the spike, force the snapshot cadence to lag the live frame budget, and break the §D4 SLA. Dropping is acceptable for live aggregation — a missed vote in a 1000-voter poll affects count by 0.1% and the rapid-snapshot cadence re-aggregates from the durable `events/` sub-collection so eventual consistency is preserved. The drop is observable (the voter sees `accepted: false`, retries once, and the second event lands in the next bucket).

### F. Vendor-specific interfaces (one per vendor) instead of a uniform `AudienceBackendProvider`

**Rejected per §D8.** Distinct per-vendor interfaces would force the editor's adapter picker to special-case each vendor's UX. Uniform interface + capability filtering achieves both: tenants choosing Slido see Slido-supported clip kinds in the picker; native-tenant users see the full set including the three differentiators. Per-vendor capability variance is expressed via `supportedClipKinds` (per §D2), not interface variation.

### G. `AudienceProvenance` schema in this ADR (not deferred to ADR-010)

**Rejected per §D9.** The audience-backend ADR establishes the lifecycle that produces the snapshot; the clip-family ADR establishes the per-clip-kind shape of the snapshot. Splitting along that boundary keeps each ADR scoped. ADR-009 names the shared slots (`provider`, `sessionId`, `snapshotFrame`, `voterCountAtCapture`, `capturedAt`) so T-460 has a forward-citation target; ADR-010 lands the per-clip-kind aggregation extensions.

### H. Snapshot cadence as a fixed 30 Hz across all clip kinds

**Rejected per §D4 / §D5.** ReactionStreamClip's visual is high-density-by-design (emoji particle storm); a 30 Hz cadence over a 1000-voter reaction burst would saturate the snapshot store with redundant data. Per-kind override (5 Hz for ReactionStream, 30 Hz default elsewhere) is the smaller surface; uniform 30 Hz wastes capacity.

---

## References

- `docs/decisions/ADR-007-provider-seam-pattern.md` — meta-pattern this ADR's `AudienceBackendProvider` interface extends; §D1 (`AdapterDescriptor` shape), §D2 (modality reservation table — ADR-009 was reserved here), §D3 (license-aware routing), §D8 (proposal D1–D9 ratifications), §D11 (loss-flag conventions), §D12 (plugin manifest), §D13 (asset-license cross-reference).
- `docs/decisions/ADR-008-asset-generation.md` — sibling consumer ADR; §D2 (`MediaProvenance` template `AudienceProvenance` mirrors), §D11 (loss-flag inventory pattern this ADR follows).
- `docs/decisions/ADR-003-interactive-runtime-tier.md` — `interactive` runtime tier the audience runtime extends; §D1 (tier contract).
- `docs/decisions/ADR-005-frontier-clip-catalogue.md` — clip-permissions manifest convention §D13 honours + the `liveMount` / `staticFallback` two-path contract every audience clip inherits; §D2 (clip permissions), §D3 (`LF-PERMISSION-DENIED`).
- `docs/decisions/ADR-010-live-audience-clip-family.md` — sibling Phase 15 α ADR (T-451; pending). Defines the nine v1 clips + the full `AudienceProvenance` schema preview §D9 references.
- `apps/api/` — existing API surface; §D1 extends with the `/v1/audience/*` route family.
- `packages/storage-firebase/` — existing Firestore patterns the audience-results collection inherits (region-router, tenant-scoped paths, TTL).
- `packages/storage/src/contract.ts` — `StorageAdapter` 3-method contract; the audience-backend storage tier uses the existing surfaces directly (no new facet needed for v1 — `audience-sessions` is a Firestore-native collection accessed via the firebase adapter; per-clip-kind state machines stay in the backend service, not the storage layer).
- `packages/runtimes/contract/` — interactive runtime contract; T-454 extends per ADR-003.
- `packages/loss-flags/src/types.ts` — receives the eight `LF-AUDIENCE-*` codes per §D11 (string-typed `code`; no closed-union edit).
- `docs/implementation-plan.md` — Phase 15 α (T-450 → T-460), Phase 15 β (T-461 → T-477), Phase 15 γ (T-478 → T-485), Phase 15 δ (T-486 → T-489); v1.28 (this ADR's ship) records the merge.
- `apps/docs/src/content/docs/skills/stageflip/concepts/streaming-agent-events.md` — SSE vs. WebSocket rationale §D1 cites.
- CLAUDE.md §3 (license whitelist invariant + determinism perimeter §D10 honours), §6 (escalation triggers — vendor parity disputes if a vendor's claimed feature behaves differently in T-485 regression), §10 (where things go — adapter packages slot under `packages/<vendor>-audience/` — convention to be confirmed in T-478..T-483 dispatch), §13 (structural-extension rule — N/A here, this is a docs-only ADR; the schema additions ADR-009 / ADR-010 specify land in T-452 / T-460 which DO bear the §13 obligation).

---

## Ratification Signoff

- [ ] Product owner — audience backend architecture + rate-limit model ratified
- [ ] Product owner — 1000-concurrent-voter v1 SLA target + 200 ms p50 latency budget ratified
- [ ] Engineering — T-452 (`@stageflip/audience-contract`) shipped against this ADR; `AudienceBackendProvider` interface + eight `LF-AUDIENCE-*` loss-flag codes
- [ ] Engineering — T-453 (audience backend service) extends `apps/api` per §D1 + Firestore `audience-results` collection per §D5
- [ ] Engineering — T-454 (`packages/runtimes/audience/`) extends `interactive` runtime tier per ADR-003 + §D13 permission scope
- [ ] Engineering — T-455 (`check-audience-permissions`) enforces `permissions: ['audience-network']` on every audience clip
- [ ] Engineering — T-475 (latency tests) verifies p50 < 200 ms / p95 < 500 ms voter-tap → screen per §D4
- [ ] Engineering — T-477 (SLA load test) verifies 1000 concurrent voters per §D4
- [ ] Security — T-488 GA review covers auth flow (§D7), WebSocket abuse vectors (§D6), rate-limit posture (§D3), permission scope (§D13)
