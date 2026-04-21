---
"@stageflip/renderer-cdp": minor
---

FFmpeg integration (T-085).

Frame-sink-backed encoder that pipes PNG buffers to a spawned
`ffmpeg` process and writes H.264 / H.265 / VP9 / ProRes 4444
(alpha) output. Drop-in replacement for `InMemoryFrameSink` when
a consumer wants real video file output.

New modules (packages/renderer-cdp/src/):

- `child-runner.ts` — process-seam abstraction.
  `ChildRunner` + `SpawnedProcess` + `ChildStdin`. Tests inject a
  fake; the default `createNodeChildRunner()` uses Node's
  `child_process.spawn` with piped stdin / captured stderr.
- `ffmpeg-profiles.ts` — the four codec profiles as const records
  (codecArgs, containerExt, pixFmt, supportsAlpha, crfRange).
  `PROFILE_H264`, `PROFILE_H265`, `PROFILE_VP9`,
  `PROFILE_PRORES_4444`, `ENCODER_PROFILES`, `getEncoderProfile`.
- `ffmpeg-encoder.ts` — `FFmpegEncoder implements FrameSink`.
  `create(opts)` spawns eagerly (argv errors surface up-front).
  `onFrame` writes to stdin, `close` ends stdin + awaits exit;
  non-zero exit raises `FFmpegEncoderError` with stderr attached.
  Close is idempotent per the FrameSink contract.
  `buildFfmpegArgs` exposed for tests / introspection.
- `ffmpeg-doctor.ts` — `doctor(opts?)` → `DoctorReport`. Runs
  `ffmpeg -version` once, parses the version line and the
  `--enable-*` configure flags; surfaces per-codec issues.

Encoder details:

- Input is `-f image2pipe -c:v png` — one complete PNG per
  `onFrame` call.
- `-r <fps>` is emitted on both input and output sides so
  container metadata matches captured frame timing.
- H.264 / H.265 use yuv420p + CRF; VP9 sets `-b:v 0` to unlock
  constant-quality mode (without it, CRF is a bitrate ceiling).
- ProRes 4444 uses `-profile:v 4 -pix_fmt yuva444p10le`
  (10-bit alpha channel preserved) and rejects a CRF knob loudly
  rather than silently dropping it.
- Dimensions validated as positive even integers (yuv420p needs
  even sides); fps as positive finite.

Doctor details:

- Single spawn of `ffmpeg -version`; parses both version + the
  `configuration:` line's `--enable-<lib>` flags.
- Reports `ok: false` on missing codecs, unparseable version,
  empty output, or spawn failure (e.g. ENOENT).
- `prores_ks` is bundled with ffmpeg, so it counts as present
  whenever the version output is non-empty.
- CLI wiring (`stageflip doctor`) is future CLI-task territory;
  consumers today call `doctor()` directly.

Test surface: 111 cases across 12 files (+31 from T-084a).
  - 7 child-runner is tested via encoder + doctor fake-runner
    paths (no separate suite — `createNodeChildRunner` touches
    the real `child_process`; integration tests land with
    T-090).
  - 8 ffmpeg-profiles (coverage, alpha, containers, CRF defaults,
    vp9 -b:v 0, prores profile/pixfmt, lookup throws)
  - 17 ffmpeg-encoder (argv, CRF validation, dimension/fps
    validation, -r on both sides, spawn/write/close orchestration,
    non-zero exit, idempotent close, after-close rejects,
    custom ffmpegPath)
  - 7 ffmpeg-doctor (happy path, custom path, missing codecs,
    spawn throw, empty output, unparseable version, ok=false
    with parsed version)
