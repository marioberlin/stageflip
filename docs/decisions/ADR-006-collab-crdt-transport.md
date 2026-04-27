# ADR-006: Collab CRDT — Y.Doc Binding, Transport, ChangeSet Layering

**Date**: 2026-04-27
**Ratified**: 2026-04-27 (via merge to `main` as `d32aea5`; T-260 implements)
**Status**: **Accepted**
**Supersedes**: N/A
**Superseded by**: N/A

---

## Context

Phase 12 entry task **T-260** ships the `ChangeSets + CRDT (Yjs) sync layer` — the first task that actually exercises the storage contract's delta methods (`applyUpdate` / `subscribeUpdates`) introduced in T-025 and dormant through Phases 1–11. T-261 follows with presence (cursors, selection) on Realtime Database, deliberately a separate plane.

Before T-260 can be implemented, six architectural questions must be answered:

1. How is `Document` (the canonical schema shape) bound to a `Y.Doc`?
2. What transport carries Yjs updates between clients and the server?
3. How do CRDT updates relate to the storage contract's `ChangeSet` (RFC 6902 patch) audit tier?
4. When are durable snapshots cut, and by whom?
5. Where does presence live, and does Yjs awareness factor in?
6. Where does the new code physically live in the workspace?

The existing `skills/stageflip/concepts/collab/SKILL.md` sketches the high-level shape (Yjs deltas via `applyUpdate`, RTDB for presence, periodic snapshot compaction). This ADR turns that sketch into binding decisions so T-260 — and every Phase 12 collab follow-up — has a single source of truth.

---

## Decisions

### D1. `Y.Doc` binding: shaped, not opaque

The `Y.Doc` carries a **shaped tree** that mirrors the canonical `Document`, not an opaque blob.

- Top-level `Y.Map` keyed `meta`, `theme`, `variables`, `components`, `masters`, `layouts`, `content`.
- `content.slides` is a `Y.Array<Y.Map>`. Each slide is a `Y.Map` with element list at `elements: Y.Array<Y.Map>`.
- Element field types follow rules:
  - Long-form text fields (TextElement `text`, slide `notes`) — `Y.Text` to enable character-level concurrent edits.
  - Arrays where element identity matters (`elements`, `slides`, `animations`) — `Y.Array<Y.Map>`.
  - Scalar primitives + small fixed-shape records (`transform`, color literals, `inheritsFrom`) — plain JSON values inside the parent `Y.Map`.
- Document id, `meta.id`, theme tokens, master/layout structural ids are **single-writer** by convention — clients do not mutate them concurrently. The server rejects updates that touch them from non-owner actors (enforcement deferred to T-262 auth).

**Why shaped, not opaque**: a shaped tree is what gives Yjs its merge value. Two users editing the same slide's two different elements concurrently must merge automatically; that requires Yjs to see element identity. An opaque blob stored as a single `Y.Map.set('doc', JSON)` collapses every concurrent edit into a last-writer-wins overwrite and defeats the purpose.

**Why partial single-writer**: theme / variables / masters are not concurrent-edit hotspots; their churn rate is low and a CRDT merge of two simultaneous theme changes produces no useful semantics. Treating them as single-writer keeps the binding mapper simple.

### D2. Transport: storage contract is the transport

T-260 does **not** introduce a new WebSocket / WebRTC server. The Yjs provider is a thin adapter that wraps the existing `StorageAdapter`:

- Local Y.Doc update → `await storage.applyUpdate(docId, update)`.
- Subscription loop: `for await (const update of storage.subscribeUpdates(docId)) Y.applyUpdate(ydoc, update)`.
- Bootstrap: `const snap = await storage.getSnapshot(docId); if (snap) Y.applyUpdate(ydoc, snap.content as Uint8Array)`.

This means the transport **is the adapter**:
- `InMemoryStorageAdapter` (T-025/T-026, already in `packages/storage/`) — dev/test transport via in-process fan-out. T-260 lights it up.
- `FirebaseStorageAdapter` (T-036, ships earlier) — prod transport via Firestore document subcollection + onSnapshot fan-out.
- `PostgresStorageAdapter` (T-270, later in Phase 12) — alternate prod transport via LISTEN/NOTIFY.

**Why not y-websocket**: y-websocket is the canonical Yjs transport but it is its own server with its own persistence assumptions. Adopting it would force us to either (a) run it next to Firestore and reconcile two stores, or (b) replace Firestore for collab. The storage contract was designed (T-025) precisely to avoid that fork. T-260 honors the design.

**Tradeoff**: we lose y-websocket's mature presence + awareness implementation (acceptable — presence is on RTDB per T-261) and its built-in conflict-free server-side merge (acceptable — Yjs updates are commutative; the server only needs to fan out and persist, which the storage contract already specifies).

### D3. ChangeSet (semantic patch) is a separate, intent-driven layer

The storage contract's `ChangeSet` (RFC 6902 JSON Patch) tier is **NOT** the same as the Yjs update stream. The two coexist:

| Layer | Stream | Purpose | Cardinality |
|---|---|---|---|
| Yjs `applyUpdate` | binary `Uint8Array` deltas | live sync, automatic merge | high (every keystroke) |
| `applyPatch` ChangeSet | JSON-Patch ops with `actor` + `parentVersion` | undo/redo, audit log | low (one per user-intent action) |

T-260 ships **both paths**. The collab client takes mutations through a thin command layer:

```ts
collab.command('add-text-element', { slideId, element }) // → emits both:
//   1. Y.Doc transaction adding element (CRDT update fans out)
//   2. ChangeSet { ops: [{ op: 'add', path: '/content/slides/<idx>/elements/-', value: element }] } (audit)
```

Multi-step Yjs transactions emit one ChangeSet covering the whole intent. Pure character-level Y.Text edits inside a long text run **do not** emit ChangeSets per-keystroke; they collapse to a single `replace` ChangeSet on transaction close (debounced). This keeps the audit log readable.

**Why both**: undo/redo at the Yjs level is well-defined (`Y.UndoManager` exists), but server-side audit, "who edited this slide last", and offline JSON-Patch replay all want a semantic history. The storage contract already has `applyPatch`/`getHistory` for exactly this; T-260 wires it.

**ChangeSet `parentVersion` semantics**: in a CRDT world, `parentVersion` is the snapshot version at command-emit time. Concurrent ChangeSets from two actors with the same `parentVersion` are both accepted — version-mismatch error fires only when a stale client tries to apply a patch against a snapshot that has since been compacted past their `parentVersion`. The Yjs stream is the conflict-resolution mechanism; ChangeSets are append-only audit and do not block on each other.

### D4. Snapshot cadence: server-driven, time- + count-bounded

Snapshots compact the update log into a fresh `DocumentSnapshot` whose `content` is the Y.Doc-serialized state via `Y.encodeStateAsUpdate(ydoc)`. They are **server-driven**:

- Trigger thresholds (whichever first):
  - 200 updates since last snapshot.
  - 30 seconds idle (no new updates).
  - 24 hours wall-clock since last snapshot.
- Compaction lives outside T-260 — it is a server-side worker that runs against the storage adapter. T-260 ships the Y.Doc shape, the provider, the client, and a documented `compact(docId): Promise<void>` helper. The cron / queue that calls it is operational (Cloud Run cron in prod; vitest helper in tests).

**Why time-bounded matters**: clients hydrate via `getSnapshot` + replay of post-snapshot updates. Without a wall-clock bound, a quiet doc with intermittent edits could accumulate weeks of updates and slow cold-start hydration unboundedly.

### D5. Presence: separate plane, separate task

Yjs has `y-protocols/awareness` for presence. We do **not** use it. Per `concepts/collab/SKILL.md` and ADR ratification of the two-plane model, presence ships in **T-261** on Realtime Database. Reasons:

- Presence churns 10× more than canonical state. RTDB is metered for that pattern; Firestore is not.
- Presence has no merge semantics — last-write-wins is correct. CRDT machinery is unnecessary overhead.
- Decoupling presence from canonical sync means presence outages don't kill collab and vice versa.

T-260 must not import `y-protocols/awareness` and must not add a `Y.Awareness` instance on the Y.Doc. Linter / review check.

### D6. Package layout: new `@stageflip/collab` package

T-260 creates `packages/collab/`:

```
packages/collab/
  src/
    binding.ts          — Document ↔ Y.Doc mapping (shaped, per D1)
    binding.test.ts
    provider.ts         — Yjs Provider that wraps StorageAdapter (per D2)
    provider.test.ts
    client.ts           — CollabClient: hydrate, command, dispose
    client.test.ts
    commands/           — typed command emitters (see D3)
      index.ts
      slide-commands.ts
      element-commands.ts
      <...>.test.ts
    changeset.ts        — Yjs-transaction → ChangeSet derivation
    changeset.test.ts
    snapshot.ts         — encodeStateAsUpdate / compact() helper (per D4)
    snapshot.test.ts
    index.ts            — public surface
  package.json
  tsconfig.json
  CHANGELOG.md
```

Depends on `yjs` (MIT — whitelisted), `@stageflip/schema`, `@stageflip/storage`. **Does not depend** on `@stageflip/runtimes/*`, `@stageflip/renderer-core`, `@stageflip/engine` — collab is upstream of execution.

`@stageflip/editor-shell` consumes `@stageflip/collab` later (T-261 / T-262 era). T-260 itself does not modify the editor; it ships the package + tests + skill update only.

### D7. Determinism posture

`packages/collab/**` is **NOT** clip / runtime code. The `pnpm check-determinism` rules (no `Date.now`, `Math.random`, `setTimeout`, etc.) do not apply. The collab layer freely uses `Date.now()` for `ChangeSet.createdAt` (ISO timestamps), wall-clock-driven snapshot triggers (D4), and `crypto.randomUUID()` for ChangeSet ids.

Yjs internally uses `Math.random()` for client ids; this is acceptable because (a) Yjs is not in any clip/runtime path, (b) client id non-determinism is irrelevant to canonical-state convergence (Yjs is designed for it).

### D8. Error semantics

The provider must handle three failure modes:

1. **Network drop mid-subscription** — `subscribeUpdates` async iterator throws or returns. The provider rebuilds the subscription with backoff (exponential, capped at 30s, jitter) and re-bootstraps from `getSnapshot` to catch up.
2. **Stale snapshot on bootstrap** — `getSnapshot` returns a snapshot whose `version` is older than the actual log head. The provider applies the snapshot, then replays log tail via `getHistory({ after: snapshot.updatedAt })` (note: `getHistory` returns ChangeSets, not Y updates — this catch-up path uses ChangeSets to fast-forward, then Y updates resume from current). _If the storage adapter does not preserve a separable Y-update log (in-memory adapter does not persist), bootstrap is just `getSnapshot` and no replay is possible — acceptable for in-memory dev._
3. **`applyUpdate` rejection** (e.g., per-doc rate limit hit, T-263) — the local Y.Doc state is now ahead of the server. The provider buffers pending updates in memory, retries with backoff, and surfaces a `CollabClient.status: 'syncing' | 'synced' | 'error'` observable for the editor to indicate offline state. No data loss as long as the process stays alive; a hard crash before drain loses unflushed local updates (acceptable per "browser collab is best-effort", see editor-shell offline guarantees).

---

## Out-of-scope decisions (deferred)

| Question | Punted to |
|---|---|
| WebRTC peer-to-peer fallback when storage adapter is unreachable | Future task; YAGNI for v1. |
| Server-side authority over CRDT updates (validating shape on write) | T-262 (auth) — without org/actor identity, validation is moot. |
| Selective subscription (clients only sync slides they're viewing) | Performance optimization; revisit when fixture profiles surface a hotspot. |
| Migration of pre-T-260 documents into `Y.Doc` form | Lazy migration on first collab open. The bootstrap path detects an absent snapshot and seeds Y.Doc from the existing document store. |
| Y.UndoManager wiring for editor undo/redo | Editor task (T-261 era or later). Provider exposes the Y.Doc; editor wires its own UndoManager. |
| Encryption-at-rest of update payloads | Out of scope here; storage adapter is responsible for at-rest encryption per backend (Firestore handles it; Postgres requires column-level). |

---

## Consequences

- **Positive**: ships the smallest correct collab layer, fully reuses the storage contract, no new server. Honors the two-plane separation. Yjs's merge guarantees are preserved by shaped binding.
- **Positive**: ChangeSet audit + Yjs sync coexist cleanly; intent capture is preserved without doubling the wire format.
- **Negative**: shaped binding requires a Document↔Y.Doc mapper per element type. Adding a new element type now requires a binding update (adds rigor; manageable).
- **Negative**: snapshot compaction is operational work that lands in a follow-up; until that worker exists, hydration time grows linearly with updates. Acceptable for v1; escalate when fixtures show >5 s cold-start.
- **Negative**: storage adapter's transport quality is the collab transport quality. A slow `applyUpdate` (Firestore P95 latency: 50–200 ms) means perceptible local-typing lag if Yjs updates are not coalesced. T-260 must coalesce (debounce update emission to 50 ms) to keep local typing snappy; remote replication remains real-time.

---

## Acceptance for ratification

Before T-260 dispatches:

1. ✅ All six questions answered (D1–D6).
2. ✅ Determinism posture explicit (D7).
3. ✅ Error semantics enumerated (D8).
4. ✅ Out-of-scope items listed.
5. ⏳ Reviewer (or Orchestrator) approves on PR; once merged, ADR is **Accepted** and T-260 dispatch unblocked.
