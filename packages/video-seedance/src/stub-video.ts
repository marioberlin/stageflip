// packages/video-seedance/src/stub-video.ts
// Deterministic placeholder MP4 synthesizer for the stub-mode
// SeedanceVideoProvider. Pure function: same `prompt` → byte-identical
// output (and in fact byte-identical across ALL inputs — prompt + seed
// differentiate the cache key only). No `Date`, no `Math.random`, no
// `fetch`, no timers.
//
// Output is a `data:video/mp4;base64,...` URI for a minimal valid MP4
// container (ISO base media file format, ISO/IEC 14496-12). The fixture
// is **Option A** from docs/tasks/T-430.md §"Stub MP4 fixture
// rationale": a hard-coded base64-encoded minimal valid MP4 (~489 bytes
// after decode) carrying:
//   - `ftyp` box: major_brand `isom`, minor_version 512, compatible
//     brands `isom` + `mp41`.
//   - `moov` box: `mvhd` + 1 `trak` (`tkhd` for a 1920×1080 video track
//     + `mdia` (`mdhd` at 30 timescale, 450 sample duration = 15s @
//     30fps; `hdlr` = vide; `minf` with `vmhd`, `dinf` self-contained,
//     and empty `stbl` sample-table sub-boxes)).
//   - `mdat` box: empty (no codec frames — production wire-up replaces
//     the entire body with a real H.264 + AAC payload from fal.ai).
//
// The on-the-wire stub bytes are byte-identical for ANY input. Production
// wire-up (T-430a) replaces this with a real fal.ai HTTPS API call + MP4
// download; the surrounding shape (URL string) stays identical.
//
// **Fixture provenance**: generated once by the helper in T-430's spec
// review using a small TypeScript MP4 box writer (~150 LOC; not vendored
// — the production wire-up subsumes it). The bytes were copied here as
// a base64 literal so this file ships pure-data with zero box-format
// writer surface to maintain. The `ftyp` magic at byte offset 4 is the
// canonical proof-point tests assert on.

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
 * `moov` (with one 1920×1080 video track at 30fps / 15s declarative
 * duration) + empty `mdat`. ~489 bytes decoded; ~652 chars base64.
 * Byte-identical across every call. Production wire-up (T-430a) replaces
 * this with a real fal.ai-produced MP4 download.
 */
const STUB_MP4_BASE64 =
  'AAAAGGZ0eXBpc29tAAACAGlzb21tcDQxAAAByW1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAADqYAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAFVdHJhawAAAFx0a2hkAAAABwAAAAAAAAAAAAAAAQAAAAAAADqYAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAeAAAAEOAAAAAAA8W1kaWEAAAAgbWRoZAAAAAAAAAAAAAAAAAAAAB4AAAHCVcQAAAAAAC1oZGxyAAAAAAAAAAB2aWRlAAAAAAAAAAAAAAAAVmlkZW9IYW5kbGVyAAAAAJxtaW5mAAAAFHZtaGQAAAABAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAABcc3RibAAAABBzdHNkAAAAAAAAAAAAAAAQc3R0cwAAAAAAAAAAAAAAEHN0c2MAAAAAAAAAAAAAABRzdHN6AAAAAAAAAAAAAAAAAAAAEHN0Y28AAAAAAAAAAAAAAAhtZGF0';
