---
'@stageflip/collab': minor
---

T-260: Initial release of `@stageflip/collab` — Yjs ChangeSet sync layer.

Per ADR-006, the package ships:

- A shaped `Document` ↔ `Y.Doc` binding (D1) — long-form text uses `Y.Text`,
  element/slide arrays use `Y.Array<Y.Map>`, theme/masters/layouts/meta.id
  are single-writer plain JSON.
- `YjsStorageProvider` (D2) — wraps any `StorageAdapter` as a Yjs transport.
  Origin filtering prevents echo loops; local updates debounce to 50 ms;
  reconnect uses capped exponential backoff with ±25% jitter.
- `CollabClient` + command registry (D3) — every command emits both a Y.Doc
  transaction (CRDT) and a `ChangeSet` (RFC 6902 audit). Y.Text bursts
  collapse to a single debounced `replace` ChangeSet (250 ms).
- `compact(docId, ydoc, storage)` helper (D4) — crystallizes a fresh
  `DocumentSnapshot` from the current Y.Doc state.

No editor-shell / app changes; consumption ships in T-261-era follow-ups.
