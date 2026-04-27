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

```ts
interface Presence {
  userId: string;
  color: string;            // stable across sessions
  cursor?: { slideId: string; x: number; y: number };
  selection?: { elementIds: string[] };
  status?: 'active' | 'idle' | 'away';
}
```

Presence data is ephemeral — never persisted beyond the session.

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
- **Presence (RTDB) ships in T-261**. Per ADR-006 §D5 the collab package
  must NOT import `y-protocols/awareness`.
- **Compaction worker** (the cron that calls `compact()`) is operational
  scope; ships as a follow-up infra task.

## Related

- ADR: `docs/decisions/ADR-006-collab-crdt-transport.md`
- Storage contract: T-025, T-026 · `packages/storage/`
- CRDT package: `packages/collab/` (T-260)
- Presence impl: T-261
- Tasks: T-260 (CRDT), T-261 (presence)
