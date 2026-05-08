# @stageflip/presence

## 0.1.0

### Minor Changes

- 3332abd: T-261: Initial release of `@stageflip/presence` — RTDB-backed cursor /
  selection presence as the second collab plane per ADR-006 §D5.

  Per the spec, the package ships:
  - `Presence` shape (D-T261-1) — `userId`, stable `color`, `lastSeenMs`,
    optional `cursor` / `selection` / `status`. Cursor coordinates are
    slide-local in canonical-pixel units.
  - `colorForUserId` (D-T261-4) — 12-color palette, deterministic hash;
    the palette order is part of the API contract.
  - `PresenceAdapter` contract — `set` / `remove` / `subscribe` /
    `registerDisconnectCleanup`, mirroring `@stageflip/storage`'s
    `AbortSignal` plumbing and multi-subscriber fan-out.
  - `InMemoryPresenceAdapter` — dev/test fan-out; simulates RTDB-style
    disconnect by tying cleanup to the subscribe loop's signal.
  - `FirebaseRtdbPresenceAdapter` — wraps a structural `DatabaseLike`
    slice of `firebase-admin/database`. Writes to the canonical
    `/presence/{docId}/{userId}` path, wires
    `ref.onDisconnect().remove()` for hard-disconnect cleanup, and
    filters records older than 30 s from yielded snapshots.
  - `PresenceClient` — 10 s heartbeat, 50 ms cursor-write debounce
    (wire-only; the local observable fires every call so UI sees no
    lag), idle/away status transitions (30 s / 5 min), peer-only
    subscribe (excludes the local user).

  Per ADR-006 §D5 the package does NOT import `y-protocols/awareness`
  and does NOT instantiate `Y.Awareness`; presence and canonical state
  remain decoupled planes. No editor-shell wiring; consumption ships
  in a follow-up app PR.
