// packages/audience-join-shared/src/index.ts
// Public surface of `@stageflip/audience-join-shared` (T-456).
//
// Browser-safe entry point. The Node-only `roomCodeForSync` helper lives
// in `room-code-node.ts` and is intentionally NOT re-exported here —
// callers that need it import the path explicitly to keep `node:crypto`
// out of any client bundle (T-304-class browser-bundle hazard).

export {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  encodeRoomCode,
  isRoomCode,
  roomCodeFor,
} from './room-code.js';
export { type VoterUrlInput, voterUrlFor } from './voter-url.js';
