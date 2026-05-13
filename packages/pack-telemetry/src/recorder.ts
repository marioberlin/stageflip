// packages/pack-telemetry/src/recorder.ts
// T-503 — `PackTelemetryRecorder` — the public surface callers
// (engine, pack-loader, etc.) interact with. Default-disabled per
// ADR-001's opt-in privacy posture; when disabled every record* call
// is a silent no-op and no events are buffered.

import {
  type PackLicenseKind,
  type PackTelemetryEvent,
  type PackTelemetryPlatform,
  makeActivationEvent,
  makeInstallEvent,
  makeUsageEvent,
} from './events.js';
import { detectPlatform, hashPackId } from './redact.js';
import {
  BufferedTransport,
  type TelemetryLogger,
  type TelemetryTransport,
  defaultTelemetryLogger,
} from './transport.js';

export type { TelemetryTransport } from './transport.js';

/** Recorder construction options. */
export interface PackTelemetryRecorderOptions {
  /** Master switch — default `false` per ADR-001. When `false`,
   *  every record* call returns immediately and nothing reaches the
   *  transport. */
  readonly enabled: boolean;
  /** Where events ship. The recorder wraps this in a
   *  `BufferedTransport`. Use `NoopTransport` when telemetry is
   *  off (caller may also pass any transport and rely on the
   *  `enabled` gate). */
  readonly transport: TelemetryTransport;
  /** Engine version — stamped into every install event. */
  readonly engineVersion: string;
  /** Injected `Date.now()` for tests. Defaults to `Date.now`. */
  readonly now?: () => number;
  /** Platform override — defaults to `detectPlatform()`. */
  readonly platform?: PackTelemetryPlatform;
  /** Buffer threshold — auto-flush when this many events accumulate.
   *  Defaults to 16. */
  readonly bufferSize?: number;
  /** Logger for transport-error fallout. */
  readonly logger?: TelemetryLogger;
}

/** Inputs for `recordInstall`. Caller passes plaintext publisher +
 *  pack ids; the recorder hashes them before they reach the
 *  transport. */
export interface RecordInstallInput {
  readonly publisherId: string;
  readonly packId: string;
  readonly packVersion: string;
  readonly licenseKind: PackLicenseKind;
}

/** Inputs for `recordActivation`. */
export interface RecordActivationInput {
  readonly publisherId: string;
  readonly packId: string;
  readonly packVersion: string;
  readonly mountedAnyClip: boolean;
}

/** Inputs for `recordUsage`. */
export interface RecordUsageInput {
  readonly publisherId: string;
  readonly packId: string;
  readonly packVersion: string;
  readonly clipMountCount: number;
  readonly windowSeconds: number;
}

/**
 * Records pack install / activation / usage events to a configured
 * transport. Default-disabled per ADR-001's opt-in posture; callers
 * must set `enabled: true` explicitly to opt in.
 *
 * Determinism perimeter: this package is OUTSIDE the perimeter; the
 * recorder may use `Date.now()`. Tests inject `now()` for stability.
 */
export class PackTelemetryRecorder {
  private readonly enabled: boolean;
  private readonly buffered: BufferedTransport | undefined;
  private readonly engineVersion: string;
  private readonly nowFn: () => number;
  private readonly platform: PackTelemetryPlatform;
  private readonly logger: TelemetryLogger;
  /** In-flight `enqueue` promises pending settlement; drained on `flush`. */
  private readonly inflight: Promise<unknown>[] = [];

  constructor(opts: PackTelemetryRecorderOptions) {
    this.enabled = opts.enabled;
    this.engineVersion = opts.engineVersion;
    this.nowFn = opts.now ?? (() => Date.now());
    this.platform = opts.platform ?? detectPlatform();
    this.logger = opts.logger ?? defaultTelemetryLogger;

    if (this.enabled) {
      const bufOpts: { inner: TelemetryTransport; bufferSize?: number } = {
        inner: opts.transport,
      };
      if (opts.bufferSize !== undefined) {
        bufOpts.bufferSize = opts.bufferSize;
      }
      this.buffered = new BufferedTransport(bufOpts);
    } else {
      // Telemetry disabled — the provided transport is ignored and
      // no events are buffered.
      this.buffered = undefined;
    }
  }

  /** True iff this recorder will ship events. */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Record a pack-install. No-op if `!enabled`. */
  recordInstall(input: RecordInstallInput): void {
    if (!this.enabled || this.buffered === undefined) return;
    try {
      const ev = makeInstallEvent({
        packIdHash: hashPackId(input.publisherId, input.packId),
        packVersion: input.packVersion,
        licenseKind: input.licenseKind,
        engineVersion: this.engineVersion,
        platform: this.platform,
        nowMs: this.nowFn(),
      });
      this.enqueue(ev);
    } catch (err) {
      this.logger.warn(`[pack-telemetry] recordInstall failed: ${(err as Error).message}`);
    }
  }

  /** Record a pack-activation. No-op if `!enabled`. */
  recordActivation(input: RecordActivationInput): void {
    if (!this.enabled || this.buffered === undefined) return;
    try {
      const ev = makeActivationEvent({
        packIdHash: hashPackId(input.publisherId, input.packId),
        packVersion: input.packVersion,
        mountedAnyClip: input.mountedAnyClip,
        nowMs: this.nowFn(),
      });
      this.enqueue(ev);
    } catch (err) {
      this.logger.warn(`[pack-telemetry] recordActivation failed: ${(err as Error).message}`);
    }
  }

  /** Record a pack-usage window. No-op if `!enabled`. */
  recordUsage(input: RecordUsageInput): void {
    if (!this.enabled || this.buffered === undefined) return;
    try {
      const ev = makeUsageEvent({
        packIdHash: hashPackId(input.publisherId, input.packId),
        packVersion: input.packVersion,
        clipMountCount: input.clipMountCount,
        windowSeconds: input.windowSeconds,
        nowMs: this.nowFn(),
      });
      this.enqueue(ev);
    } catch (err) {
      this.logger.warn(`[pack-telemetry] recordUsage failed: ${(err as Error).message}`);
    }
  }

  /** Force-flush the buffer to the transport. No-op if disabled. Also
   *  drains any in-flight `enqueue` sends so transport errors observed
   *  during auto-flush surface here (and not on the floor). */
  async flush(): Promise<void> {
    if (!this.enabled || this.buffered === undefined) return;
    // Drain in-flight enqueues first; each was wrapped in .catch so
    // none of these settle as rejected.
    const inflight = this.inflight.slice();
    this.inflight.length = 0;
    await Promise.allSettled(inflight);
    try {
      await this.buffered.flush();
    } catch (err) {
      this.logger.error(`[pack-telemetry] flush failed: ${(err as Error).message}`);
    }
  }

  /** Enqueue a single event; auto-flush handled by `BufferedTransport`.
   *  Errors are swallowed + logged. */
  private enqueue(ev: PackTelemetryEvent): void {
    if (this.buffered === undefined) return;
    const p = this.buffered.send([ev]).catch((err: unknown) => {
      this.logger.error(`[pack-telemetry] enqueue failed: ${(err as Error).message}`);
    });
    this.inflight.push(p);
  }
}
