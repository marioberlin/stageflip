---
---

T-550 — Marketplace GA-readiness audit + commercial-terms legal-review
ledger. Ships `pnpm check-marketplace-ga-readiness` (audits the nine
P16 δ marketplace surfaces — registry, Stripe, npm-path, browsing UI,
telemetry dashboard, tier system, conversion flow, refunds + disputes,
parity validator) plus a humans-only legal-review sign-off check
against `docs/legal-review-marketplace.md`. Forward-compatible mode by
default: unsigned legal clauses surface as warnings, never fail the
build. Strict mode (`--require-legal-signoff`) is reserved for the
GA-launch checklist runbook. Tooling + docs only — no publishable
package change.
