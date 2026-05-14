<!-- docs/legal-review-marketplace.md -->
<!-- T-550 — Humans-only legal-review checklist for the marketplace GA gate. -->

# Marketplace Commercial-Terms Legal Review (T-550)

This document is the human-only sign-off ledger for the StageFlip
marketplace GA launch. The `pnpm check-marketplace-ga-readiness`
audit (T-550) reads this file and surfaces every clause that has not
yet been signed:

- **Forward-compatible mode (default)**: unsigned clauses surface as
  `warn`. The build does not fail on them. This is the posture for
  P16 δ — the legal review is a gate on the GA *announcement*, not on
  every PR merge.
- **Strict mode (`--require-legal-signoff`)**: unsigned clauses fail
  the audit. Wire this flag into the GA-launch checklist runbook,
  not into routine CI.

Each clause has a sign-off block of the form:

```
### Clause: <name>
- Status: `pending-counsel-review` | `signed:YYYY-MM-DD <signer-name>`
- Owner: <legal-counsel-name-or-pseudo>
- Notes: <free text>
```

Sign-off lives **only** in this document. The audit script never
mutates this file; humans must edit it by hand and ratify via the
normal PR-review flow.

---

## Required clauses

The clause names below MUST stay in sync with `REQUIRED_LEGAL_CLAUSES`
in `scripts/check-marketplace-ga-readiness.ts`. Adding a new required
clause means: (a) add a new `### Clause: <name>` block here, (b) add
the same name to the constant in the script, (c) ship both changes in
the same PR, (d) update the changeset note.

---

### Clause: Terms of Service
- Status: `pending-counsel-review`
- Owner: outside-counsel-tbd
- Notes: Drafted text not yet circulated to outside counsel. Covers
  the marketplace as a hosted-service surface; refers out to the
  per-pack EULA for IP-licensing terms. Pending: outside-counsel
  redline + jurisdiction-of-record selection (DE vs DE-DE).

### Clause: Privacy Policy
- Status: `pending-counsel-review`
- Owner: outside-counsel-tbd
- Notes: Must align with ADR-001 (telemetry hashing of
  `(publisherId, packId)` tuples; no IP addresses logged at the
  receiver). Pending: outside-counsel review of the
  `marketplace-telemetry-dashboard` data flows + GDPR-Art-13/14
  notice text.

### Clause: Stripe Billing Terms
- Status: `pending-counsel-review`
- Owner: outside-counsel-tbd
- Notes: Stripe MSA already signed at the platform level; this
  clause covers the marketplace-specific addendum (revenue split
  with publishers, payout cadence, refund-driven clawback). Pending:
  Stripe Connect application + tax-residency questionnaire.

### Clause: DMCA Takedown Procedure
- Status: `pending-counsel-review`
- Owner: outside-counsel-tbd
- Notes: Procedure must name a registered DMCA agent (US safe
  harbor) and define the takedown SLA. Pending: outside-counsel
  draft + designation form filing with the US Copyright Office.

### Clause: Publisher Agreement
- Status: `pending-counsel-review`
- Owner: outside-counsel-tbd
- Notes: Template covers the publisher → StageFlip relationship —
  IP warranty, indemnification, revenue split, code-of-conduct,
  termination. Pending: outside-counsel draft + finance sign-off
  on the revenue-split schedule.

### Clause: Tenant Master Subscription Agreement
- Status: `pending-counsel-review`
- Owner: outside-counsel-tbd
- Notes: Template for the tenant → StageFlip subscription contract.
  Includes the tier-system limits per ADR-013 §D3 and the trial /
  conversion mechanics from T-505 / T-544. Pending: outside-counsel
  redline.

### Clause: Per-Pack EULA
- Status: `pending-counsel-review`
- Owner: outside-counsel-tbd
- Notes: Template the publisher fills in for each shipped pack.
  Must allow either MIT (open-source packs) or proprietary terms
  (paid packs) per the LF-LICENSE-* loss-flag taxonomy. Pending:
  outside-counsel draft of the proprietary template.

### Clause: GDPR Data Processing Agreement
- Status: `pending-counsel-review`
- Owner: outside-counsel-tbd
- Notes: Standard SCC-backed DPA executed at tenant onboarding.
  Must cover the tenant → StageFlip processor relationship AND the
  StageFlip → Stripe sub-processor disclosure. Pending: outside-
  counsel draft + sub-processor list freeze (Stripe, AWS, Cloudflare).

### Clause: Refund and Dispute Policy
- Status: `pending-counsel-review`
- Owner: outside-counsel-tbd
- Notes: Anchored to `@stageflip/marketplace-refunds`
  (T-545) — 7 / 30 / 60-day windows per ADR-013 §D11. Pending:
  outside-counsel review of the chargeback-evidence template
  produced by `buildDisputeEvidence`.

### Clause: Tax Collection Policy
- Status: `pending-counsel-review`
- Owner: outside-counsel-tbd
- Notes: VAT (EU), GST (UK / AU / CA), and US sales-tax position
  for marketplace transactions. Stripe Tax handles collection;
  this clause covers our publisher-disclosed-net-of-tax position
  and the related publisher-statement template. Pending: tax-
  advisor review + Stripe Tax configuration.

---

## Sign-off mechanics

When a clause is approved by counsel:

1. Edit the `Status` line of that clause to `signed:YYYY-MM-DD <signer-name>`
   (e.g. `signed:2026-05-21 J. Doe (Outside Counsel)`).
2. Append context to the `Notes` block — what changed, what was
   accepted, what remains conditional.
3. Open a PR titled `[T-550] Sign off <clause-name>`. The PR body
   should link to the counsel email / redline / contract version
   that produced the approval.
4. Reviewer runs `pnpm check-marketplace-ga-readiness
   --require-legal-signoff` locally to confirm the audit advances.

When **all** clauses above are signed, the marketplace clears the
legal-review GA gate. The Orchestrator then flips the
`--require-legal-signoff` flag into the launch-checklist runbook so
the strict-mode audit runs against the ratified state.
