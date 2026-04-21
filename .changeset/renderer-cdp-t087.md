---
"@stageflip/renderer-cdp": minor
---

Audio mixer — parse tracks, mix via ffmpeg filter graph, mux (T-087).

Takes N `AudioTrack`s (source path + comp-time window + RIR-shaped
knobs) plus the video produced by T-085, builds a
`-filter_complex` graph, and muxes the mixed audio into the output
container. No tracks → simple stream-copy through.

New module `packages/renderer-cdp/src/audio-mixer.ts`:

- `AudioTrack` — mirrors the RIR audio-content schema: sourcePath,
  startFrame/endFrame, trimStartMs/trimEndMs, loop, gain, pan,
  fadeInMs/fadeOutMs.
- `buildMixAudioArgs(opts)` — pure. Emits ffmpeg argv + the
  filter-graph string. Fails loud on malformed input with
  per-track context (`track[N]: <field>`).
- `mixAudio(opts)` — spawns via the T-085 `ChildRunner` seam,
  awaits exit, raises `MixAudioError` with stderr on non-zero.

Per-track filter chain, applied in order:

```
atrim=start=Ts:end=Te,
asetpts=PTS-STARTPTS,
aloop=loop=-1:size=2147483647  # when loop=true (INT32_MAX samples)
volume=G                    # when G != 1
pan=stereo|c0=...|c1=...    # stereo matrix from pan ∈ [-1,1]
adelay=Dms|Dms              # comp-timing delay
afade=t=in:st=D/1000:d=fIn  # when fadeInMs > 0
afade=t=out:st=(D+dur-fOut)/1000:d=fOut   # when fadeOutMs > 0
```

Then `amix=inputs=N:dropout_transition=0:normalize=0[mix]`, muxed
with `-map 0:v -map [mix] -c:v copy -c:a aac -shortest`.

Zero-track path emits `-i video -c copy out` — pure pass-through,
no filter graph, no re-encode.

Scope deferred: surround / channel-aware pan (stereo-only today;
the RIR pan field is stereo-only too); ffprobe-derived duration
overrides; per-track output bit-depth control.

Test surface: 17 cases for the mixer (+ existing 123 = 140 total
across 14 files). Covers 0/1/N track paths, every filter emission
conditional (trim, loop, volume, pan, fade, delay), argv shape,
validation, and orchestration (spawn + non-zero exit + custom
path).
