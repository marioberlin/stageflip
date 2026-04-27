---
title: Collaboration (CRDT + Presence)
id: skills/stageflip/concepts/collab
tier: concept
status: substantive
last_updated: 2026-04-27
owner_task: T-260
related:
  - skills/stageflip/concepts/schema/SKILL.md
  - skills/stageflip/concepts/auth/SKILL.md
  - skills/stageflip/concepts/rate-limits/SKILL.md
---

# Collaboration — CRDT + Presence

Two data planes, on purpose:

| Plane | Store | Ships in |
|---|---|---|
| Canonical document state | Firestore via storage contract (Yjs CRDT deltas encoded as `Uint8Array`) | T-260 |
| Presence (cursors, selection, user avatars) | Realtime Database | T-261 |

## Why two stores

Presence churns many updates per second per user. Firestore writes are slow
and metered; Realtime Database is cheap and streams. Canonical state is
low-frequency, high-value — exactly Firestore's sweet spot.

## CRDT flow

- Clients keep a Yjs doc in memory.
- Local mutations produce Yjs updates → the storage contract's
  `applyUpdate(docId, update)` appends to a server-side log.
- The server fan-outs the update via `subscribeUpdates(docId)` to every other
  client.
- Clients apply the update to their in-memory Yjs doc; the UI re-renders.
- Periodically, a server compaction job collapses the update log into a new
  snapshot via the storage contract's `getSnapshot` / `putSnapshot`.

## Schema vs CRDT

The CRDT operates over **the canonical schema's shape**, not a separate
structure. Fields that must be CRDT-reconcilable (text, arrays of elements)
are modeled so Yjs merges make sense. Fields that must not (theme tokens,
document id) are treated as `y.Map` at the top but mutated single-writer.

## Presence shape

Shipped in T-261 as `@stageflip/presence`. Locked by ADR-006 §D5 +
`docs/tasks/T-261.md` D-T261-1:

```ts
interface Presence {
  userId: string;
  /** Stable color across sessions — derived from userId hash. */
  color: string;
  /** Last-seen wall-clock ms. Server-side stale filter compares against now. */
  lastSeenMs: number;
  cursor?: {
    slideId: string;
    x: number;
    y: number;
    // Cursor coords are slide-local, in canonical-pixel units (per RIR).
  };
  selection?: {
    /** IDs of selected elements on the active slide. */
    elementIds: string[];
  };
  status?: 'active' | 'idle' | 'away';
}
```

Presence data is ephemeral — never persisted beyond the session.

## Heartbeat + idle thresholds

D-T261-2:

- **Heartbeat cadence** — 10 s. The client writes its presence record
  (refreshing `lastSeenMs` and `status`) every 10 s.
- **`active`** — there has been a cursor or selection change in the last
  30 s.
- **`idle`** — 30 s of no input.
- **`away`** — 5 minutes of no input.
- **Server-side stale filter** — the RTDB adapter filters records older
  than 30 s from yielded subscribe maps. Stale records are not eagerly
  deleted server-side; a Cloud Function cleaner is operational scope
  (out of T-261). Filtering is sufficient for v1.
- **Hard disconnect** — the RTDB adapter wires
  `ref.onDisconnect().remove()` on connect, so the user's record is
  removed when the socket closes (the killer feature of RTDB for
  presence).

The 3:1 ratio of stale TTL (30 s) to heartbeat cadence (10 s) is
intentional: a single missed heartbeat does not immediately ghost the
user; two consecutive misses do.

## Color assignment

D-T261-4: stable per `userId` across docs and sessions. The palette
order is part of the API contract — changing it shifts every user's
color across releases.

```ts
const PRESENCE_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#eab308',
]; // 12 colors, all WCAG-AA on white, distinguishable to deuteranopes
```

Hash is a simple polynomial (`hash = (hash * 31 + ch) | 0`) modulo 12.
Pinned via test for stability across releases.

## Cursor debounce

D-T261-3. Mouse-move can fire 60+ fps. `PresenceClient.setCursor(...)`
debounces the **wire write** to 50 ms (≈20 fps). The local-state
observable (`onLocal`) fires on every call, so UI sees no lag. Selection
changes are NOT debounced — they're rare, intent-driven actions.

## Storage contract integration

The storage contract's delta methods (T-025) sit idle through Phases 1–11.
T-260 is the first task that actually exercises them in prod. The contract
is deliberately shaped to make this seamless.

## Provider topology

T-260 deliberately does **not** stand up a y-websocket / WebRTC server.
The `StorageAdapter` is the transport: a `YjsStorageProvider` wraps the
adapter, forwarding local Y.Doc updates via `applyUpdate(docId, update)`
and reading remote updates from `subscribeUpdates(docId)`. Bootstrap pulls
the most recent snapshot (Y-encoded `Uint8Array` or a parsed JSON
`Document` for legacy docs) before the subscription loop begins. The same
provider works against `InMemoryStorageAdapter` (dev/test),
`FirebaseStorageAdapter` (prod), and the future `PostgresStorageAdapter`
(T-270). Reasoning: ADR-006 §D2.

## Reorder caveat

`reorderSlides` is implemented as delete-then-insert because Y.Array has no
native move primitive. Consequence: any `Y.Text` instances inside the moved
slide (notably `slide.notes`) lose CRDT identity — the reinserted slide
carries fresh `Y.Text` values rebuilt from the JSON snapshot taken at
reorder time. Concurrent remote edits to a reordered slide's `notes` (or
any future slide-level Y.Text field) that have not yet flushed at reorder
time are NOT preserved across the reorder. The emitted ChangeSet reflects
this honestly with a `remove` followed by an `add` (NOT a `move`) so the
audit log records the rebuild rather than implying preservation. Editor
consumers (T-261) should treat reorder as destructive w.r.t. unflushed
concurrent Y.Text edits on the moved slide.

## ChangeSet vs. Yjs update

The Yjs `applyUpdate` stream is the live-sync / merge layer. The
`ChangeSet` (RFC 6902 JSON Patch) layer is a separate, intent-driven audit
log emitted alongside every command. They coexist: every `collab.command`
emits one Y.Doc transaction (high-frequency CRDT delta) and one
`ChangeSet` (low-frequency semantic patch with `actor` + `parentVersion`).
Per-keystroke Y.Text bursts collapse to a single debounced `replace`
ChangeSet (250 ms window) so the audit log stays readable. Reasoning:
ADR-006 §D3.

## Current state (Phase 12 entry)

- **Storage contract is live** (T-025, T-026). All three method pairs
  (snapshot / update delta / patch) are implemented by `InMemoryStorageAdapter`
  with multi-subscriber fan-out, per-doc isolation, abort-signal cleanup, and
  bounded-buffer drop-oldest policy. 23 tests in `@stageflip/storage`.
- **CRDT (Yjs) layer ships in T-260** — `@stageflip/collab` provides the
  shaped `Document` ↔ `Y.Doc` binding (D1), the `YjsStorageProvider` (D2),
  the `CollabClient` + command registry that dual-emits Y.Doc transactions
  and ChangeSets (D3), and the `compact()` snapshot helper (D4). 49 tests.
  See ADR-006 for the binding rationale.
- **Presence (RTDB) ships in T-261** — `@stageflip/presence` provides the
  `PresenceAdapter` contract, an `InMemoryPresenceAdapter` (dev/test
  fan-out, AbortSignal-driven disconnect simulation), a
  `FirebaseRtdbPresenceAdapter` wired to `ref.onDisconnect().remove()` on
  the canonical `/presence/{docId}/{userId}` path with a 30 s stale-record
  filter, and a `PresenceClient` with 10 s heartbeat, 50 ms cursor
  debounce (wire-only; local observable fires every call), idle/away
  status transitions, and peer-only subscribe (excludes the local user).
  39 tests. Per ADR-006 §D5 neither package imports
  `y-protocols/awareness`; the two planes stay decoupled.
- **Compaction worker** (the cron that calls `compact()`) is operational
  scope; ships as a follow-up infra task.

## Related

- ADR: `docs/decisions/ADR-006-collab-crdt-transport.md`
- Storage contract: T-025, T-026 · `packages/storage/`
- CRDT package: `packages/collab/` (T-260)
- Presence package: `packages/presence/` (T-261)
- Tasks: T-260 (CRDT), T-261 (presence)
