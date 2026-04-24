---
title: Collaboration (CRDT + Presence)
id: skills/stageflip/concepts/collab
tier: concept
status: substantive
last_updated: 2026-04-20
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

## Current state (Phase 1 exit)

- **Storage contract is live** (T-025, T-026). All three method pairs
  (snapshot / update delta / patch) are implemented by `InMemoryStorageAdapter`
  with multi-subscriber fan-out, per-doc isolation, abort-signal cleanup, and
  bounded-buffer drop-oldest policy. 23 tests in `@stageflip/storage`.
- **CRDT (Yjs) + presence (RTDB)** remain unimplemented — Phase 12
  (T-260, T-261). The delta methods are the integration point they will use.

## Related

- Storage contract: T-025, T-026 · `packages/storage/`
- Presence impl: T-261
- Tasks: T-260 (CRDT), T-261 (presence)
