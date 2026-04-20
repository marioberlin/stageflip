---
"@stageflip/frame-runtime": minor
---

Add `useAudioVisualizer(ref, options?)` (T-053).

Wires an `HTMLMediaElement` through a Web Audio `AnalyserNode` and returns
`{ frequency, waveform, volume }` per frame. Editor / preview only — not
determinism-clean because analyser output depends on wall-clock-driven
decoder state. `AudioContext` creation is deferred to mount; pass
`audioContextFactory` to inject a custom context (or a stub in tests).
Validates `fftSize` (power of two, 32..32768) and
`smoothingTimeConstant` ([0, 1]).
