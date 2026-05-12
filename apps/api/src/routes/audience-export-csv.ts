// apps/api/src/routes/audience-export-csv.ts
// T-459 — Pure RFC 4180-compliant CSV encoder for audience-event exports.
//
// Schema (one header row + one row per event):
//
//   eventId,sessionId,clipKind,voterTokenHash,kind,appendedAt,payload
//
// Where:
//   - eventId        — `AudienceEventDoc.eventId` (server-assigned ULID)
//   - sessionId      — `AudienceEventDoc.sessionId`
//   - clipKind       — `payload.kind` if the payload is an object with a
//                      string `kind` field; empty string otherwise. The
//                      audience-events sub-collection is shared across
//                      all clip kinds for a session, but per ADR-009 §D5
//                      the per-event `kind` IS the routing discriminator.
//   - voterTokenHash — already hashed at rest (ADR-009 §D5). NOT un-hashed
//                      on export — the audit posture is preserved.
//   - kind           — same source as clipKind. Both columns are emitted
//                      because tooling consumers expect both axes
//                      explicitly (one for filtering by clip-kind family,
//                      one for the routing discriminator on the event).
//   - appendedAt     — `AudienceEventDoc.serverTimestamp` (the canonical
//                      append timestamp; ADR-009 §D5 line 218).
//   - payload        — `JSON.stringify(event.payload)`; the resulting cell
//                      is RFC 4180 quoted because JSON contains commas +
//                      double-quotes.
//
// Every cell containing `,`, `"`, `\n`, or `\r` is wrapped in `"..."` per
// RFC 4180 §2.6; internal `"` is escaped as `""` per §2.7. The resulting
// document uses `\n` as the row separator (LF; spec permits `\r\n` but
// agentic + spreadsheet consumers accept LF).
//
// Pure function — no I/O, no external deps.

import type { AudienceEventDoc } from '@stageflip/storage';

const HEADER = 'eventId,sessionId,clipKind,voterTokenHash,kind,appendedAt,payload';

/**
 * RFC 4180 §2.6 / §2.7 quoting. Wraps the input in `"..."` when it
 * contains `,`, `"`, `\n`, or `\r`; doubles internal `"`.
 */
function csvQuote(s: string): string {
  if (s.length === 0) return '';
  // Fast path: no special characters.
  if (!s.includes(',') && !s.includes('"') && !s.includes('\n') && !s.includes('\r')) {
    return s;
  }
  return `"${s.replaceAll('"', '""')}"`;
}

/**
 * Read `payload.kind` if the payload is an object with a string `kind`
 * field; return `''` otherwise. The store types `payload` as `unknown`
 * (per ADR-009 §D5 — clip-router parses); the export is best-effort.
 */
function extractKind(payload: unknown): string {
  if (payload !== null && typeof payload === 'object' && 'kind' in payload) {
    const k = (payload as { kind: unknown }).kind;
    if (typeof k === 'string') return k;
  }
  return '';
}

/**
 * Encode a list of audience events as one RFC 4180-compliant CSV
 * document. Header row + one row per event. Empty input returns the
 * header alone (with a trailing `\n`).
 *
 * Pure function — no I/O. Order of input events is preserved verbatim.
 *
 * @param events — events to encode; the caller is responsible for
 *   ordering (the export endpoint orders by `appendedAt` ascending).
 */
export function encodeAudienceEventsCsv(events: readonly AudienceEventDoc[]): string {
  if (events.length === 0) return `${HEADER}\n`;
  const rows: string[] = [HEADER];
  for (const e of events) {
    const kind = extractKind(e.payload);
    const payloadCell = csvQuote(JSON.stringify(e.payload));
    rows.push(
      [
        csvQuote(e.eventId),
        csvQuote(e.sessionId),
        csvQuote(kind),
        csvQuote(e.voterTokenHash),
        csvQuote(kind),
        csvQuote(e.serverTimestamp),
        payloadCell,
      ].join(','),
    );
  }
  return `${rows.join('\n')}\n`;
}
