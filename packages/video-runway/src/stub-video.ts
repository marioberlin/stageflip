// packages/video-runway/src/stub-video.ts
// Deterministic placeholder MP4 synthesizer for the stub-mode
// RunwayVideoProvider. Pure function: same `prompt` → byte-identical
// output (and in fact byte-identical across ALL inputs — prompt + seed
// differentiate the cache key only). No `Date`, no `Math.random`, no
// `fetch`, no timers.
//
// Output is a `data:video/mp4;base64,...` URI for a minimal valid MP4
// container (ISO base media file format, ISO/IEC 14496-12). The fixture
// is **Option A** from docs/tasks/T-430.md §"Stub MP4 fixture
// rationale" (carried verbatim through T-431): a hard-coded base64-
// encoded minimal valid MP4 (~489 bytes after decode) carrying:
//   - `ftyp` box: major_brand `isom`, minor_version 512, compatible
//     brands `isom` + `mp41`.
//   - `moov` box: `mvhd` + 1 `trak` (`tkhd` for a 3840×2160 video track
//     + `mdia` (`mdhd` at 24 timescale, 240 sample duration = 10s @
//     24fps; `hdlr` = vide; `minf` with `vmhd`, `dinf` self-contained,
//     and empty `stbl` sample-table sub-boxes)).
//   - `mdat` box: empty (no codec frames — production wire-up replaces
//     the entire body with a real H.264 payload from Runway).
//
// **Byte-distinct from the Seedance stub** (T-430): the moov declares
// different width (3840 vs 1920), height (2160 vs 1080), mdhd timescale
// (24 vs 30), and sample duration (240 vs 450) — i.e. the Runway
// fixture declares 10s @ 24fps at 4K while Seedance declares 15s @
// 30fps at 1080p. The resulting base64 strings differ. The agent UI
// can surface this distinction alongside the descriptor's
// `supportsNativeAudio: false` / `supportedResolutions: ['1080p',
// '4k']` capability flags.
//
// The on-the-wire stub bytes are byte-identical for ANY input.
// Production wire-up (T-431a) replaces this with a real Runway HTTPS
// API call + MP4 download; the surrounding shape (URL string) stays
// identical.
//
// **Fixture provenance**: generated once by a TypeScript MP4 box
// writer (~150 LOC; not vendored — the production wire-up subsumes
// it). The bytes were copied here as a base64 literal so this file
// ships pure-data with zero box-format writer surface to maintain.
// The `ftyp` magic at byte offset 4 is the canonical proof-point
// tests assert on.

/**
 * Generate a deterministic placeholder MP4 `data:` URI.
 *
 * Pure: same `prompt` → byte-identical output. Tested against the MP4
 * spec offsets (ftyp signature at byte 4). The prompt parameter is
 * validated for non-emptiness but does NOT influence the MP4 bytes;
 * cache-key differentiation lives in the provider's `deriveCacheKey`
 * call. The seed parameter is accepted for signature parity with the
 * production wire-up but does not influence the bytes.
 *
 * @param prompt The video prompt. Validated non-empty after trim.
 * @param _seed Cache-key differentiator only — does NOT influence bytes.
 *              Accepted for signature parity with the production wire-up.
 * @returns `data:video/mp4;base64,<base64-of-MP4-bytes>` URI.
 */
export function generateStubMp4DataUri(prompt: string, _seed?: number): string {
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error(
      `generateStubMp4DataUri: prompt must be a non-empty string after trim; received ${JSON.stringify(prompt)}`,
    );
  }
  return `data:video/mp4;base64,${STUB_MP4_BASE64}`;
}

// ---------------------------------------------------------------------------
// Pre-computed fixture
// ---------------------------------------------------------------------------

/**
 * Hard-coded base64-encoded minimal MP4 fixture. Carries an `ftyp` +
 * `moov` (with one 3840×2160 video track at 24fps / 10s declarative
 * duration) + empty `mdat`. ~489 bytes decoded; ~652 chars base64.
 * Byte-identical across every call. Production wire-up (T-431a)
 * replaces this with a real Runway-produced MP4 download.
 *
 * Byte-distinct from the Seedance stub (T-430): different declarative
 * width / height / timescale / sample-duration in the moov.
 */
const STUB_MP4_BASE64 =
  'AAAAGGZ0eXBpc29tAAACAGlzb21tcDQxAAAByW1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAACcQAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAFVdHJhawAAAFx0a2hkAAAABwAAAAAAAAAAAAAAAQAAAAAAACcQAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAA8AAAAIcAAAAAAA8W1kaWEAAAAgbWRoZAAAAAAAAAAAAAAAAAAAABgAAADwVcQAAAAAAC1oZGxyAAAAAAAAAAB2aWRlAAAAAAAAAAAAAAAAVmlkZW9IYW5kbGVyAAAAAJxtaW5mAAAAFHZtaGQAAAABAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAABcc3RibAAAABBzdHNkAAAAAAAAAAAAAAAQc3R0cwAAAAAAAAAAAAAAEHN0c2MAAAAAAAAAAAAAABRzdHN6AAAAAAAAAAAAAAAAAAAAEHN0Y28AAAAAAAAAAAAAAAhtZGF0';
