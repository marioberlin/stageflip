---
'@stageflip/storage-firebase': minor
---

T-474 — Audience-data persistence (Firestore).

Adds `createFirebaseAudienceResultsStore` — the Firestore-backed
`AudienceResultsStore` impl per ADR-009 §D5. Targets the
`audience-sessions/{sessionId}` collection with an append-only
`events/{eventId}` sub-collection. Per-tenant region routing (US / EU)
is inherited from the existing `region-router.ts`; the factory accepts
whichever Firestore the caller hands it.

Implements all 7 methods on the existing T-453 + T-459 + T-473 contract:
`openSession` / `closeSession` / `appendEvent` / `readSnapshot` /
`setTtl` / `updateQuizState` / `listEvents`. Voter-token hashing
(SHA-256(pepper + plaintext_token), hex) matches the in-memory adapter
algorithm bit-for-bit so cross-adapter hashes are stable. TTL policy
enforcement is configured at deployment time on the `audience-sessions`
collection; this impl writes the `ttlAt` field.

Structural Firestore shim (`FirestoreAudienceResultsLike` +
`FirestoreCollectionRefLike` + `FirestoreDocRefLike` +
`FirestoreQueryLike`) mirrors the T-411a tenant-settings pattern with
a sub-collection on `FirestoreDocRefLike.collection(path)` + an
expanded `FirestoreQueryLike` chain (`.orderBy().where().limit().get()`)
so unit tests run without an emulator.

NOT a structural extension per CLAUDE.md §13 — adds a new
implementation conforming to the frozen `AudienceResultsStore`
interface; no document-model / binding-model / renderer-pipeline
degrees of freedom added. Render verification N/A.
