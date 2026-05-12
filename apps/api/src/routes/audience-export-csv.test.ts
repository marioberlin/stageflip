// apps/api/src/routes/audience-export-csv.test.ts
// T-459 — Unit tests for the RFC 4180-compliant CSV encoder used by the
// audience-export endpoint. Covers: empty input, simple cell, comma in
// cell, embedded `"` in cell, embedded `\n` in cell, embedded `\r\n` in
// cell, multi-event ordering preservation.

import { describe, expect, it } from 'vitest';

import type { AudienceEventDoc } from '@stageflip/storage';

import { encodeAudienceEventsCsv } from './audience-export-csv.js';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

function makeEvent(overrides: Partial<AudienceEventDoc> = {}): AudienceEventDoc {
  return {
    eventId: 'evt-1',
    sessionId: 's-1',
    voterTokenHash: HASH_A,
    serverTimestamp: '2026-05-12T00:00:01.000Z',
    clientTimestamp: '2026-05-12T00:00:00.500Z',
    payload: { kind: 'live-poll-multiple-choice', optionIndex: 0 },
    accepted: true,
    ...overrides,
  };
}

describe('encodeAudienceEventsCsv — header', () => {
  it('returns header-only output (with trailing newline) for empty input', () => {
    const csv = encodeAudienceEventsCsv([]);
    expect(csv).toBe('eventId,sessionId,clipKind,voterTokenHash,kind,appendedAt,payload\n');
  });
});

describe('encodeAudienceEventsCsv — simple event', () => {
  it('emits one row per event with the documented column order', () => {
    const csv = encodeAudienceEventsCsv([makeEvent()]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('eventId,sessionId,clipKind,voterTokenHash,kind,appendedAt,payload');
    expect(lines[1]).toContain('evt-1');
    expect(lines[1]).toContain('s-1');
    expect(lines[1]).toContain('live-poll-multiple-choice'); // clipKind comes from payload.kind
    expect(lines[1]).toContain(HASH_A);
    expect(lines[1]).toContain('2026-05-12T00:00:01.000Z'); // appendedAt = serverTimestamp
    // Trailing newline + blank.
    expect(lines.at(-1)).toBe('');
  });
});

describe('encodeAudienceEventsCsv — RFC 4180 quoting', () => {
  it('quotes a cell containing a comma', () => {
    const csv = encodeAudienceEventsCsv([makeEvent({ eventId: 'a,b', payload: 'plain' })]);
    const dataRow = csv.split('\n')[1] ?? '';
    expect(dataRow.startsWith('"a,b"')).toBe(true);
  });

  it('quotes a cell containing an embedded `"` and doubles the quote', () => {
    const csv = encodeAudienceEventsCsv([makeEvent({ eventId: 'has"quote', payload: 'plain' })]);
    const dataRow = csv.split('\n')[1] ?? '';
    expect(dataRow.startsWith('"has""quote"')).toBe(true);
  });

  it('quotes a cell containing a `\\n`', () => {
    const csv = encodeAudienceEventsCsv([makeEvent({ eventId: 'line1\nline2', payload: 'plain' })]);
    expect(csv).toContain('"line1\nline2"');
  });

  it('quotes a cell containing a `\\r\\n`', () => {
    const csv = encodeAudienceEventsCsv([makeEvent({ eventId: 'crlf\r\nrow', payload: 'plain' })]);
    expect(csv).toContain('"crlf\r\nrow"');
  });

  it('does NOT quote a cell with no special characters', () => {
    const csv = encodeAudienceEventsCsv([
      makeEvent({ eventId: 'plain-id', payload: 'plain-payload' }),
    ]);
    const dataRow = csv.split('\n')[1] ?? '';
    // The id cell shouldn't be wrapped in quotes; the payload cell will be
    // because JSON.stringify('plain-payload') yields `"plain-payload"` — but
    // a string-only payload becomes a JSON string with quotes, which forces
    // RFC 4180 quoting.
    expect(dataRow.startsWith('plain-id,')).toBe(true);
  });
});

describe('encodeAudienceEventsCsv — payload column', () => {
  it('JSON-stringifies the payload, quoting the resulting cell when needed', () => {
    const csv = encodeAudienceEventsCsv([
      makeEvent({ payload: { kind: 'reaction-stream', glyph: 'heart' } }),
    ]);
    // payload JSON contains commas + quotes → cell is quoted, internal
    // `"` doubled.
    expect(csv).toContain('"{""kind"":""reaction-stream"",""glyph"":""heart""}"');
  });

  it('emits "null" for a null payload', () => {
    const csv = encodeAudienceEventsCsv([makeEvent({ payload: null })]);
    expect(csv).toContain(',null\n');
  });
});

describe('encodeAudienceEventsCsv — multi-event ordering', () => {
  it('preserves the order of the input events', () => {
    const csv = encodeAudienceEventsCsv([
      makeEvent({ eventId: 'evt-a', voterTokenHash: HASH_A, payload: 1 }),
      makeEvent({ eventId: 'evt-b', voterTokenHash: HASH_B, payload: 2 }),
      makeEvent({ eventId: 'evt-c', voterTokenHash: HASH_A, payload: 3 }),
    ]);
    const lines = csv.split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(4); // header + 3 data rows
    expect(lines[1]?.startsWith('evt-a,')).toBe(true);
    expect(lines[2]?.startsWith('evt-b,')).toBe(true);
    expect(lines[3]?.startsWith('evt-c,')).toBe(true);
  });
});

describe('encodeAudienceEventsCsv — clipKind / kind columns', () => {
  it('reads kind from payload.kind when present, else empty', () => {
    const csv = encodeAudienceEventsCsv([
      makeEvent({ payload: { kind: 'heatmap', x: 0.5, y: 0.5 } }),
      makeEvent({ payload: { x: 0.1, y: 0.2 } }), // no kind
    ]);
    const rows = csv
      .split('\n')
      .filter((l) => l.length > 0)
      .slice(1);
    // Column order: eventId,sessionId,clipKind,voterTokenHash,kind,appendedAt,payload
    // clipKind + kind both come from payload.kind.
    const cells0 = rows[0]?.split(',') ?? [];
    expect(cells0[2]).toBe('heatmap');
    expect(cells0[4]).toBe('heatmap');
    const cells1 = rows[1]?.split(',') ?? [];
    expect(cells1[2]).toBe('');
    expect(cells1[4]).toBe('');
  });
});
