# `@stageflip/renderer-cdp` pitfalls

Observed failure modes in the CDP-based reference-render pipeline + prevention rules. Append entries as new failures surface during T-119 reference-render runs, parity tests, or production exports. Inspired by huashu's `animation-pitfalls.md` (16 failure modes); adapted to StageFlip's actual renderer-cdp implementation.

## Pitfall #1: Async font load races animation start

**Symptom**: Text renders briefly in the system fallback font, then snaps to the intended webfont mid-animation. Visible as a 100-300ms layout shift or character-width jump in recorded videos.

**Root cause**: The renderer captures frames before `document.fonts.ready` resolves. The CDP session paints frame 1 with whatever fonts are loaded; webfont URLs fetched during `<style>` parse fire async.

**Prevention**:
- The clip's mount point waits for `document.fonts.ready` before signaling render-ready.
- T-084a's asset preflight (`packages/renderer-cdp/src/asset-resolver.ts`) downloads font files at preflight, rewrites `@font-face src` to `file://` paths, and gates the bake on font availability.
- For new clip authors: never rely on `document.fonts.load(...)` at clip mount time without awaiting it.

**Pin**: [packages/renderer-cdp/src/asset-resolver.ts](../../../../../packages/renderer-cdp/src/asset-resolver.ts) — handles the preflight font cache.

---

## Pitfall #2: `requestAnimationFrame` runs in real-time during bake

**Symptom**: Bake outputs are non-deterministic (slightly different bytes per run); animation timing drifts from the canonical timeline.

**Root cause**: The browser's `requestAnimationFrame` fires on the page's wall-clock at vsync intervals; bake mode requires deterministic frame-by-frame capture at the document's `frameRate`.

**Prevention**: The determinism shim ([packages/determinism/](../../../../../packages/determinism/)) overrides `requestAnimationFrame` / `cancelAnimationFrame` / `setTimeout` / `setInterval` in clip + runtime code per CLAUDE.md §3. Clip authors **must not call them directly**; use `useFrame()` / `Sequence` from `@stageflip/frame-runtime` instead.

**CI gate**: `pnpm check-determinism` (ESLint scoped rule). Violations block merge.

**Pin**: CLAUDE.md §3 "Determinism (in clip + runtime code only)."

---

## Pitfall #3: Concurrent bake jobs collide on the temp directory

**Symptom**: A bake job's intermediate frames or audio mix gets clobbered by a parallel bake; the final video has wrong frames or mixed audio from another deck.

**Root cause**: Renderer's temp dir is process-local (e.g., `/tmp/stageflip-render-...`). Two `node renderer-cdp/bin/...` invocations sharing the same temp prefix can overwrite each other's intermediate files.

**Prevention**: Each bake job allocates a unique temp dir (UUID-suffixed or job-id-suffixed). Cleanup is per-job; never `rm -rf /tmp/stageflip-render-*` globally.

**Pin**: [packages/renderer-cdp/src/artifact-store.ts](../../../../../packages/renderer-cdp/src/artifact-store.ts) — manages per-job artifact paths.

---

## Pitfall #4: Audio mix loses frames if FFmpeg encoder finishes before audio writer

**Symptom**: Final MP4 has the correct video frames but audio cuts off before the video does, or audio has gaps.

**Root cause**: The audio mixer (`@stageflip/renderer-cdp/src/audio-mixer.ts`) and the FFmpeg encoder (`@stageflip/renderer-cdp/src/ffmpeg-encoder.ts`) write to separate streams that FFmpeg muxes at the end. If the audio mixer finishes early (e.g., a clip with no audio writes nothing), FFmpeg's mux step may emit a video-only file.

**Prevention**: The mixer always writes a silent-track placeholder for the deck's full duration, even when no clip has audio. The encoder waits for both streams to flush before muxing.

**Pin**: [packages/renderer-cdp/src/audio-mixer.ts](../../../../../packages/renderer-cdp/src/audio-mixer.ts), [packages/renderer-cdp/src/ffmpeg-encoder.ts](../../../../../packages/renderer-cdp/src/ffmpeg-encoder.ts).

---

## Pitfall #5: WebGL context loss during long bakes

**Symptom**: A bake of a deck with WebGL clips (e.g., shader transitions, 3D scenes) fails midway with "WebGL context lost" — frames after the loss point are blank or fall back to last-known state.

**Root cause**: Chromium aggressively reclaims GPU resources for backgrounded tabs. CDP-driven sessions are technically "background" by default; long-running renders can trip the context-loss heuristic.

**Prevention**:
- The CDP session is launched with flags suppressing context-loss reclamation (`--disable-gpu-process-for-dx12-vulkan-info-collection`, etc.) — see the CDP session impl.
- Clip authors using `<canvas>` listen for `webglcontextlost` and signal a bake error via the FrameContext rather than continuing with a blank canvas.

**Pin**: [packages/renderer-cdp/vendor/](../../../../../packages/renderer-cdp/vendor/) — Hyperframes engine launch flags.

---

## Pitfall #6: Seek-only discipline violation = stateful clip

**Symptom**: A clip looks correct when played start-to-finish but shows wrong content when seeked (e.g., scrubbed in editor, or sampled mid-bake). Symptoms: missing animation states, wrong text frame, image still loading.

**Root cause**: Clip's render function depends on prior render calls (e.g., accumulating state in a closure, mutating a global). The renderer assumes idempotency: `renderAt(t)` produces the same output regardless of prior history.

**Prevention**: Per Phase 3 handover §3.4 "Seek-only discipline": every clip's `renderAt(t)` must be a **pure function** of `t` and the clip's static props. No `useState`, no module-level mutation, no `useEffect` with cleanup that assumes ordering.

**CI gate**: Indirectly enforced by parity tests — a stateful clip will produce different bytes for the same frame across two bakes; the parity comparison will flag it.

**Pin**: `docs/handover-phase3-complete.md` §3.4; clip-runtime contract at [packages/runtimes/contract/](../../../../../packages/runtimes/contract/).

---

## Pitfall #7: Image asset URL changes mid-bake

**Symptom**: A bake started with image asset `asset:abc123` resolved successfully; mid-bake, the asset's bytes changed in the storage layer (e.g., a concurrent edit re-uploaded). Frames before the change have one image, frames after have another.

**Root cause**: The asset-resolver fetches by id but doesn't pin a content hash for the bake's duration. Storage layer updates the asset; the renderer continues with the updated bytes.

**Prevention**: T-084a's preflight pass downloads all assets to a job-local cache **before** the bake starts. The bake reads from the cache, not the storage. Concurrent storage edits don't affect in-flight bakes.

**Pin**: [packages/renderer-cdp/src/asset-resolver.ts](../../../../../packages/renderer-cdp/src/asset-resolver.ts) (asset-cache pattern).

---

## Pitfall #8: Bake output size exceeds Cloud Run memory budget

**Symptom**: A long deck (e.g., 60s, 4K) bakes locally but OOMs on the Cloud Run worker (T-231). The job is restarted; intermediate state is lost; user sees an error.

**Root cause**: Cloud Run's default 4 GiB memory cap is exceeded by large frame buffers held in memory before the FFmpeg encoder consumes them. Streaming (frame-by-frame to FFmpeg via stdin pipe) keeps memory bounded; buffering all frames first does not.

**Prevention**: The encoder uses a streaming pipe (`spawn('ffmpeg', [...]).stdin.write(frame)`) rather than collecting frames into an array. Audio mix similarly streams.

**Pin**: [packages/renderer-cdp/src/ffmpeg-encoder.ts](../../../../../packages/renderer-cdp/src/ffmpeg-encoder.ts).

---

## Pitfall #9: Determinism shim fails to install before user code runs

**Symptom**: A bake produces non-deterministic output even though the clip code looks pure. Investigation shows `Math.random()` was called by a third-party library (e.g., a chart lib generating "unique" tooltip IDs) before the shim's overrides took effect.

**Root cause**: The shim is installed via a `<script>` injected by the renderer at clip-mount time. If a third-party library runs synchronously during module init (e.g., via top-level statements before `DOMContentLoaded`), it can call `Math.random()` before the shim runs.

**Prevention**:
- The shim is injected as the **first** script tag on the page, before any clip imports.
- Clip authors using third-party libs verify those libs don't call non-deterministic APIs at module scope. If they do, vendor the lib + patch out the call site, OR escalate per CLAUDE.md §6.

**Pin**: [packages/determinism/](../../../../../packages/determinism/) — shim install order.

---

## Pitfall #10: FFmpeg version drift between dev and CI

**Symptom**: A bake passes locally with the developer's `brew install ffmpeg` (version 7.x) but produces different bytes / corrupt output on CI (which has FFmpeg 5.x).

**Root cause**: FFmpeg's encoders evolve subtly between major versions (codec defaults, bit-rate quantizer, audio resampler precision). Two FFmpeg versions can produce different bytes for the same input.

**Prevention**: `ffmpeg-doctor` ([packages/renderer-cdp/src/ffmpeg-doctor.ts](../../../../../packages/renderer-cdp/src/ffmpeg-doctor.ts)) validates the available FFmpeg version against a pinned minimum at preflight. If the version is outside the supported range, the bake fails fast with a clear error.

**Pin**: [packages/renderer-cdp/src/ffmpeg-doctor.ts](../../../../../packages/renderer-cdp/src/ffmpeg-doctor.ts).

---

## Pitfall #11: `<canvas>` resolution mismatches device pixel ratio

**Symptom**: Canvas-based clips look crisp on the developer's retina screen during preview but pixelated in the bake output (or vice versa).

**Root cause**: A `<canvas>` rendered at logical CSS pixels but read out as raw bitmap doesn't account for `devicePixelRatio`. If the bake runs at a different DPR than the preview, fidelity diverges.

**Prevention**: Clip authors using canvas size their backing store explicitly: `canvas.width = cssWidth * window.devicePixelRatio`, `canvas.height = cssHeight * window.devicePixelRatio`, then `ctx.scale(devicePixelRatio, devicePixelRatio)`. The renderer-cdp launches Chromium at a fixed DPR (typically 1) for bake; clip code should match.

**Pin**: For new canvas clips, pin a test that asserts the readback bitmap matches the expected dimensions (CSS-pixels × DPR).

---

## Future entries (placeholder)

When new failure modes are discovered, append here. Format: Symptom / Root cause / Prevention / Pin (file_path:line). Keep each entry under ~25 lines.
