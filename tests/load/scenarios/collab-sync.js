// tests/load/scenarios/collab-sync.js
// AC #1 — opens N WebSocket connections to the collab server, fires bursts
// of synthetic binary updates, asserts P95 round-trip fan-out < 200 ms.
//
// Smoke profile (CI):    10 VUs × 60 s.   Threshold: P95 < 300 ms.
// Full profile (ops):    50 VUs × 5 min.  Threshold: P95 < 200 ms.
//
// FAN-OUT MEASUREMENT
// K6 has no built-in metric for "round-trip from send to fan-out echo". We
// emit a custom Trend `fanout_latency_ms`: each VU stamps every outbound
// update with `(seq, sentAt)` packed into the synthetic payload, then
// records `Date.now() - sentAt` when the server echoes the same `seq` back
// on the binaryMessage event. This is the metric the AC #1 P95 < 200 ms
// threshold gates on.
//
// (Date.now is permitted here: tests/load/** is OUT OF the determinism
// scan per D-T269-5 / check-determinism.ts.)
//
// K6 WebSocket support (k6/ws) handles binary frames via ws.binaryType =
// 'arraybuffer'. The synthetic update is a small fixed-shape buffer; a
// real Yjs encoding lib is not available inside K6's Goja runtime, and we
// only care about the server's fan-out path (echo same bytes to peers).
//
// Per-VU lifecycle:
//   open WS -> auth handshake -> join docId -> send N updates over T -> close.

import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import ws from 'k6/ws';

import { collabSyncFull, collabSyncSmoke } from '../thresholds.js';

// Custom Trend feeding the AC #1 threshold.
const fanoutLatency = new Trend('fanout_latency_ms');

const PROFILE = (__ENV.STAGEFLIP_LOAD_PROFILE || 'smoke').toLowerCase();
const TARGET = __ENV.STAGEFLIP_LOAD_TARGET || 'wss://staging.stageflip.local';
const TOKEN = __ENV.STAGEFLIP_LOAD_AUTH_TOKEN || 'dev-token';
const ORG_ID = __ENV.STAGEFLIP_LOAD_ORG_ID || 'org-load';
const DOC_ID = __ENV.STAGEFLIP_LOAD_DOC_ID || 'loaddoc-0000';

export const options =
  PROFILE === 'full'
    ? {
        vus: 50,
        duration: '5m',
        thresholds: collabSyncFull,
      }
    : {
        vus: 10,
        duration: '60s',
        thresholds: collabSyncSmoke,
      };

// Wire layout of the synthetic update (20 bytes total):
//   [0..3]   seq           (uint32 big-endian)
//   [4..7]   sentAtHi      (uint32 big-endian — high 32 bits of ms)
//   [8..11]  sentAtLo      (uint32 big-endian — low 32 bits of ms)
//   [12..19] filler        (representative payload size)
//
// We split the millisecond timestamp into two 32-bit halves because JS
// bitwise operators truncate to 32 bits, and Date.now() exceeds 2^32 (it
// has done since 2009). DataView would also work but Goja's `>>>` is the
// idiomatic K6 path for byte-packing.

function writeUint32BE(buf, offset, value) {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

function readUint32BE(view, offset) {
  return (
    ((view[offset] << 24) >>> 0) +
    ((view[offset + 1] << 16) >>> 0) +
    ((view[offset + 2] << 8) >>> 0) +
    view[offset + 3]
  );
}

/** Build a tiny synthetic delta carrying (seq, sentAt) for fan-out timing. */
function syntheticUpdate(seq, sentAt) {
  const buf = new Uint8Array(20);
  writeUint32BE(buf, 0, seq);
  // Math.floor(sentAt / 2^32) is the high 32 bits; sentAt | 0 yields a
  // signed-low-32-bit which we coerce back to unsigned via `>>> 0`.
  const hi = Math.floor(sentAt / 0x100000000);
  const lo = (sentAt - hi * 0x100000000) >>> 0;
  writeUint32BE(buf, 4, hi);
  writeUint32BE(buf, 8, lo);
  for (let i = 12; i < buf.length; i++) buf[i] = (i + seq) & 0xff;
  return buf.buffer;
}

/** Decode (seq, sentAt) out of a fan-out echo. Returns null if too short. */
function decodeUpdate(arrayBuffer) {
  const view = new Uint8Array(arrayBuffer);
  if (view.byteLength < 12) return null;
  const seq = readUint32BE(view, 0);
  const hi = readUint32BE(view, 4);
  const lo = readUint32BE(view, 8);
  const sentAt = hi * 0x100000000 + lo;
  return { seq, sentAt };
}

export default function collabSyncScenario() {
  const url = `${TARGET}/collab/${ORG_ID}/${DOC_ID}?token=${TOKEN}`;
  const params = { tags: { scenario: 'collab-sync' } };

  // Outstanding sequence numbers we've sent and not yet seen echoed. We
  // only record fan-out latency for our OWN updates (other VUs on the
  // same doc will also fan-out into our socket; their seqs aren't in this
  // map and we ignore them — they're noise for THIS VU's measurement).
  const outstanding = new Set();

  const res = ws.connect(url, params, (socket) => {
    socket.on('open', () => {
      let seq = 0;
      // Burst pattern: 5 updates/sec for 30 s, then idle for the rest.
      const burst = setInterval(() => {
        const sentAt = Date.now();
        outstanding.add(seq);
        socket.sendBinary(syntheticUpdate(seq, sentAt));
        seq++;
      }, 200);
      socket.setTimeout(() => {
        clearInterval(burst);
        socket.close();
      }, 30000);
    });
    socket.on('binaryMessage', (msg) => {
      // Server fan-out received. Decode (seq, sentAt) and, if this echo
      // matches one of OUR outstanding sends, record the round-trip into
      // the `fanout_latency_ms` Trend that thresholds.js gates on.
      const decoded = decodeUpdate(msg);
      if (decoded && outstanding.has(decoded.seq)) {
        outstanding.delete(decoded.seq);
        fanoutLatency.add(Date.now() - decoded.sentAt);
      }
      check(msg, {
        'fan-out frame is non-empty': (m) => m.byteLength > 0,
      });
    });
    socket.on('error', (err) => {
      // Bubble up. K6's built-in `ws_session_duration` / non-101 status
      // counters catch overall connection-failure pressure; we log here
      // for operator-visible debugging in the K6 stdout.
      console.error(`ws error: ${err.error()}`);
    });
  });

  check(res, {
    'collab WS handshake (status 101)': (r) => r && r.status === 101,
  });
  // Spread reconnections so we don't thundering-herd.
  sleep(1);
}
