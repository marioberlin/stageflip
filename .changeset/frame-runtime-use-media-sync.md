---
"@stageflip/frame-runtime": minor
---

Add `useMediaSync(ref, { offsetMs?, durationMs? })` (T-055).

Imperatively drives `<video>` / `<audio>` `.currentTime` to match the
FrameClock, and manages play/pause based on whether the current frame
falls inside `[offsetMs, offsetMs + durationMs)`. Skips redundant seeks
when drift is within half a frame. `play()` rejections (autoplay
policies) are swallowed silently.
