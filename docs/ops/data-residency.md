# Data residency runbook (T-271)

Operational runbook for assigning orgs to a Firestore region and migrating an
org between regions. Source of truth for the routing contract is
`skills/stageflip/concepts/auth/SKILL.md` §"Tenant data residency".

## Architecture recap

- **One Firebase project, two Firestore databases.**
  - `(default)` — US (`nam5` multi-region). Default home for every org.
  - `eu-west` — EU (`europe-west3`, Frankfurt). Home for `org.region === 'eu'`.
- **Routing happens in `@stageflip/storage-firebase`'s `createRegionRouter`.**
  Application code never picks a database directly; it asks the router for the
  right Firestore + assets bucket given an `Org`.
- **`org.region` is immutable post-creation in v1.** The
  `validateRegionTransition` helper in `@stageflip/auth-schema` rejects
  in-place mutation; both Firestore rules files block client-side writes to
  `org.region`. Cross-region migration is the manual procedure documented
  below.

## When to flag an org for EU residency

A new org is created with `region: 'eu'` when ANY of the following is true:

1. The customer's contract or DPA names "EU data residency", "GDPR Schrems II",
   or "data must remain in the EEA" as a requirement.
2. The customer's primary establishment (per GDPR Art. 4(16)) is in the EU/EEA
   AND they process personal data of EU residents through StageFlip.
3. Internal legal review has flagged the org's industry vertical (public
   sector, healthcare, regulated finance) as requiring in-region processing.

If unsure, default to `region: 'us'` and surface to legal review. Migrating
later is possible (see below) but disruptive; mis-assigning an org to EU
without operational need wastes routing complexity.

## Manual migration procedure

Cross-region migration is a v1 manual procedure. The legal trigger is rare
(an org's residency requirements changing post-onboarding); the customer-
facing impact is significant (read-only window). Engineering, legal, and the
customer's account owner must all sign off before the procedure starts.

### Pre-flight checklist

- [ ] Customer has been notified of the read-only window and has scheduled
      it within their change-management policy.
- [ ] Legal has confirmed the migration is required (and not just nice to
      have) and signed off on the data-transfer paperwork.
- [ ] Engineering has a rollback plan (snapshot of the source-region copy
      retained for 30 days under soft-delete).
- [ ] On-call engineer is available for the duration of the window.

### Procedure

```
pnpm tsx scripts/migrate-org-region.ts \
  --dry-run \
  --org=<orgId> \
  --target-region=<eu|us>
```

The skeleton script prints the planned operations. Steps 1–8 are then executed
manually under supervision:

1. **Snapshot the source region.** Use the Firebase admin SDK or
   `gcloud firestore export` to dump `orgs/<orgId>` and all subcollections.
2. **Set the org to read-only.** Write a `migrationInProgress: true` flag
   that the application layer checks before allowing mutations.
3. **Import to the target region.** `gcloud firestore import` against the
   target database.
4. **Verify parity.** Document counts and content-hashes match between
   source and target.
5. **Update user references.** `users/{userId}.orgs[]` may carry the old
   region; bulk-update via admin SDK.
6. **Flip `orgs/<orgId>.region`** in the TARGET database. The application-side
   `validateRegionTransition` would block this in normal code; the migration
   runs as admin SDK and bypasses the guard. This is the documented escape
   hatch.
7. **Tombstone the source copy.** Mark with a 30-day soft-delete; do NOT
   hard-delete until the customer confirms the migration succeeded.
8. **Notify the customer.** Lift the read-only flag.

### What the customer sees

- A scheduled read-only window (typically 30–120 min depending on doc count).
- During the window: collaborative editing disabled; existing exports still
  download; the agent is paused.
- After the window: business as usual, with assets served from the
  target-region bucket.

### Rollback plan

If verification (step 4) fails or the customer reports data loss within the
30-day soft-delete window:

1. Lift the read-only flag in the source region.
2. Rewrite `users/{userId}.orgs[]` references back to the source region.
3. Re-flip `orgs/<orgId>.region` in the source database.
4. Tombstone the target-region copy.
5. Restore the customer's last-known-good snapshot if data drift occurred
   while the read-only window was lifted prematurely.

If the failure is detected AFTER 30 days, the source copy is gone and the
rollback collapses into a standard incident-response procedure. Avoid this
class of failure by allocating the on-call engineer for the full window.

## Related

- `skills/stageflip/concepts/auth/SKILL.md` — auth + tenancy contract.
- `packages/storage-firebase/src/region-router.ts` — routing implementation.
- `packages/auth-schema/src/org.ts` — `validateRegionTransition` guard.
- `firebase/firestore-eu.rules` — EU database rules (mirror of `(default)`).
- `scripts/migrate-org-region.ts` — dry-run skeleton.
