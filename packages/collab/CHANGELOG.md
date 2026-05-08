# @stageflip/collab

## 0.1.0

### Minor Changes

- fea0393: T-260: Initial release of `@stageflip/collab` — Yjs ChangeSet sync layer.

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

### Patch Changes

- Updated dependencies [2f0ae52]
- Updated dependencies [6cfbb4c]
- Updated dependencies [6474d98]
- Updated dependencies [a36fcbe]
- Updated dependencies [8ddef40]
- Updated dependencies [e054d6d]
- Updated dependencies [4fe6fda]
- Updated dependencies [12a98d3]
- Updated dependencies [ca945df]
- Updated dependencies [5af6789]
- Updated dependencies [22d44d6]
- Updated dependencies [b6d2229]
- Updated dependencies [a4bb803]
- Updated dependencies [bbcbd38]
- Updated dependencies [d393eff]
- Updated dependencies [3112c98]
- Updated dependencies [e422e50]
- Updated dependencies [7c0165c]
- Updated dependencies [732f6c7]
- Updated dependencies [36d0c5d]
- Updated dependencies [38e4017]
  - @stageflip/schema@0.1.0
