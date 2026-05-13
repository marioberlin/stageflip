// packages/marketplace-refunds/src/index.ts
// T-545 — Public surface of `@stageflip/marketplace-refunds`. The
// package is a refund + dispute orchestration LIBRARY consumed by
// the marketplace UI (tenant-initiated refunds), the Stripe webhook
// adapter (T-537 — dispute events), the marketplace tier writer
// (T-543 — entitlement protection), and the deployment-wiring task
// (T-550). It performs no I/O; callers resolve their Stripe +
// entitlement reads upstream and pass projected inputs into
// `processRefund` / `handleDispute` / `buildDisputeEvidence`.
//
// Determinism perimeter: outside (server-side).

// Refund policy
export type { RefundPolicy } from './policy/refund-policy.js';
export {
  DEFAULT_FULL_REFUND_WINDOW_DAYS,
  DEFAULT_NO_REFUND_AFTER_DAYS,
  DEFAULT_PRO_RATA_REFUND_WINDOW_DAYS,
  DEFAULT_REFUND_POLICY,
} from './policy/refund-policy.js';

// Refund processor
export type { RefundDecision, RefundReason, RefundRequest } from './refunds/request.js';
export { processRefund } from './refunds/request.js';

// Dispute handler
export type {
  DisputeAction,
  DisputeEvent,
  DisputeReason,
  DisputeStatus,
} from './disputes/handler.js';
export { handleDispute } from './disputes/handler.js';

// Dispute evidence builder
export type {
  BuildDisputeEvidenceOpts,
  DisputeCustomerInfo,
  DisputeEvidence,
  DisputeUsageMetrics,
} from './disputes/response-builder.js';
export { buildDisputeEvidence } from './disputes/response-builder.js';

// Ledger
export type { LedgerEntry, LedgerOutcome } from './ledger/refund-ledger.js';
export { InMemoryRefundLedger } from './ledger/refund-ledger.js';
