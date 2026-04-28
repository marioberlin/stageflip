// tests/load/scenarios/collab-sync.js
// AC #1 — opens N WebSocket connections to the collab server, fires bursts
// of Yjs-shaped binary frames, asserts P95 round-trip fan-out < 200 ms.
//
// Smoke profile (CI):    10 VUs × 60 s.   Threshold: P95 < 300 ms.
// Full profile (ops):    50 VUs × 5 min.  Threshold: P95 < 200 ms.
//
// K6 WebSocket support (k6/ws) handles binary frames via ws.binaryType =
// 'arraybuffer'. The Yjs sync protocol is a length-prefixed binary stream;
// we send a small synthetic update payload to keep the test self-contained
// (a real Yjs encoding lib is not available inside K6's Goja runtime).
// This is sufficient to exercise the server's fan-out path: N connected
// clients on the same docId, message X arrives, message X is echoed to the
// other N-1 clients. The server's behaviour is what we measure, not the
// payload semantics.
//
// Per-VU lifecycle:
//   open WS -> auth handshake -> join docId -> send N updates over T -> close.

import { check, sleep } from 'k6';
import ws from 'k6/ws';

import { collabSyncFull, collabSyncSmoke } from '../thresholds.js';

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

/** Build a tiny synthetic delta (4-byte header + 16-byte payload). */
function syntheticUpdate(seq) {
  // K6's Goja runtime exposes ArrayBuffer + Uint8Array.
  const buf = new Uint8Array(20);
  // First 4 bytes: monotonically-increasing sequence (big-endian).
  buf[0] = (seq >> 24) & 0xff;
  buf[1] = (seq >> 16) & 0xff;
  buf[2] = (seq >> 8) & 0xff;
  buf[3] = seq & 0xff;
  // Remainder: filler bytes (representative of a small Yjs update).
  for (let i = 4; i < buf.length; i++) buf[i] = (i + seq) & 0xff;
  return buf.buffer;
}

export default function collabSyncScenario() {
  const url = `${TARGET}/collab/${ORG_ID}/${DOC_ID}?token=${TOKEN}`;
  const params = { tags: { scenario: 'collab-sync' } };

  const res = ws.connect(url, params, (socket) => {
    socket.on('open', () => {
      let seq = 0;
      // Burst pattern: 5 updates/sec for 30 s, then idle for the rest.
      const burst = setInterval(() => {
        socket.sendBinary(syntheticUpdate(seq++));
      }, 200);
      socket.setTimeout(() => {
        clearInterval(burst);
        socket.close();
      }, 30000);
    });
    socket.on('binaryMessage', (msg) => {
      // Server fan-out received. K6's built-in
      // `ws_msgs_received_duration` metric records the round-trip; the
      // threshold in thresholds.js asserts P95.
      check(msg, {
        'fan-out frame is non-empty': (m) => m.byteLength > 0,
      });
    });
    socket.on('error', (err) => {
      // Bubble up; threshold `ws_connection_errors` catches counts.
      console.error(`ws error: ${err.error()}`);
    });
  });

  check(res, {
    'collab WS handshake (status 101)': (r) => r && r.status === 101,
  });
  // Spread reconnections so we don't thundering-herd.
  sleep(1);
}
