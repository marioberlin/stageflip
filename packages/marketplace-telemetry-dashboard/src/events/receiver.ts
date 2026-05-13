// packages/marketplace-telemetry-dashboard/src/events/receiver.ts
// T-541 — `POST /api/v1/telemetry/events` handler. Accepts a JSON
// batch of `PackTelemetryEvent`s, validates structure + first-party
// scope, normalises into `TimeSeriesEvent` rows, and writes to the
// supplied `TimeSeriesStore`.
//
// Out of scope (deferred to T-550 / future):
//   - Real bearer-token validation (this handler accepts any non-empty
//     `Authorization: Bearer <token>` header).
//   - Rate limiting; back-pressure; quota enforcement.
//   - Batch deduplication (idempotency-key handling).
//
// Determinism perimeter: outside (server-side).

import type { PackTelemetryEvent } from '@stageflip/pack-telemetry';

import type { TimeSeriesEvent, TimeSeriesStore } from '../storage/timeseries.js';

/** Optional logger seam — defaults to no-op so tests stay quiet. */
export interface TelemetryReceiverLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

/** Dependencies for `createTelemetryReceiver`. */
export interface TelemetryReceiverDeps {
  readonly store: TimeSeriesStore;
  /** Set of `packIdHash` strings recognised as first-party. Events
   *  whose hash is outside this set are rejected at receiver time. */
  readonly firstPartyScope: ReadonlySet<string>;
  readonly logger?: TelemetryReceiverLogger;
}

/** HTTP-shaped request the receiver consumes. */
export interface ReceiverRequest {
  readonly headers: Record<string, string>;
  readonly body: string;
}

/** HTTP-shaped response the receiver returns. */
export interface ReceiverResponse {
  readonly status: number;
  /** Number of events successfully written. */
  readonly accepted: number;
  /** Number of events rejected (third-party or malformed). */
  readonly rejected: number;
  /** Optional human-readable reason for non-2xx responses. */
  readonly reason?: string;
}

/** Extract a bearer token from the `Authorization` header. */
function extractBearer(headers: Record<string, string>): string | null {
  const raw = headers.authorization ?? headers.Authorization;
  if (typeof raw !== 'string') return null;
  const m = /^Bearer\s+(.+)$/.exec(raw);
  if (!m || (m[1] ?? '').length === 0) return null;
  return m[1] as string;
}

/** Type-guard: shallow validation of an incoming event row. */
function isValidEventShape(value: unknown): value is PackTelemetryEvent {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  if (typeof o.packIdHash !== 'string' || (o.packIdHash as string).length === 0) return false;
  if (typeof o.packVersion !== 'string') return false;
  if (typeof o.at !== 'string') return false;
  const kind = o.kind;
  return kind === 'install' || kind === 'activation' || kind === 'usage';
}

/** Convert a validated `PackTelemetryEvent` into a stored `TimeSeriesEvent`. */
function toTimeSeriesRow(ev: PackTelemetryEvent): TimeSeriesEvent {
  // Strip the discriminator + identifying fields; remainder is payload.
  const { kind, packIdHash, packVersion, at, ...rest } = ev as PackTelemetryEvent &
    Record<string, unknown>;
  return {
    kind,
    packIdHash,
    packVersion,
    at,
    payload: { ...(rest as Record<string, unknown>) },
  };
}

/**
 * Build the receiver handler bound to the supplied store + scope.
 * Returned function is a single async entry-point that the production
 * HTTP adapter (T-550) wires into its router.
 */
export function createTelemetryReceiver(
  deps: TelemetryReceiverDeps,
): (req: ReceiverRequest) => Promise<ReceiverResponse> {
  const { store, firstPartyScope, logger } = deps;

  return async (req: ReceiverRequest): Promise<ReceiverResponse> => {
    const bearer = extractBearer(req.headers);
    if (bearer === null) {
      logger?.warn('telemetry-receiver: missing or malformed Authorization header');
      return { status: 401, accepted: 0, rejected: 0, reason: 'unauthorized' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(req.body);
    } catch {
      logger?.warn('telemetry-receiver: malformed JSON');
      return { status: 400, accepted: 0, rejected: 0, reason: 'malformed-json' };
    }

    if (!Array.isArray(parsed)) {
      return { status: 400, accepted: 0, rejected: 0, reason: 'expected-array' };
    }

    const accepted: TimeSeriesEvent[] = [];
    let rejected = 0;
    for (const candidate of parsed) {
      if (!isValidEventShape(candidate)) {
        rejected += 1;
        continue;
      }
      if (!firstPartyScope.has(candidate.packIdHash)) {
        rejected += 1;
        continue;
      }
      accepted.push(toTimeSeriesRow(candidate));
    }

    if (accepted.length > 0) {
      try {
        await store.write(accepted);
      } catch (err) {
        logger?.error(`telemetry-receiver: store.write failed: ${(err as Error).message}`);
        return { status: 500, accepted: 0, rejected, reason: 'store-write-failed' };
      }
    }

    return { status: 200, accepted: accepted.length, rejected };
  };
}
