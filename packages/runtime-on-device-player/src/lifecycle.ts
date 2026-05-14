// packages/runtime-on-device-player/src/lifecycle.ts
// Per-clip lifecycle handle returned by `OnDevicePlayerShim.mount` on the
// happy path. Mirrors `MountHandle` from the interactive tier but tagged
// with device-flavored metadata (clipId / clipFamily / startedAt) so the
// binary can correlate mount/unmount telemetry with on-screen state.

/**
 * Per-clip lifecycle handle. Returned by `OnDevicePlayerShim.mount` on
 * success. The binary holds onto these in its render tree; `unmount()`
 * removes the clip from the shim's internal registry, fires `'unmount'`
 * telemetry, and disposes the underlying harness `MountHandle`.
 *
 * `unmount` is idempotent: the harness already enforces idempotence on
 * the wrapped handle, and the shim's registry-removal step is keyed on
 * `clipId`. Double-unmount is a no-op after the first call.
 */
export interface OnDeviceClipHandle {
  readonly clipId: string;
  readonly clipFamily: string;
  /** Monotonic clock value at mount time (ms-since-boot). */
  readonly startedAt: number;
  unmount(): Promise<void>;
}
