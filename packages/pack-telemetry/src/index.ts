// packages/pack-telemetry/src/index.ts
// T-503 — Public surface of `@stageflip/pack-telemetry`. Three event
// kinds + a redaction helper + a dependency-injected recorder + three
// transport implementations (Noop / Buffered / Http).
//
// ADR-001 posture: opt-in only. Construct the recorder with
// `enabled: false` (the default) and every record* call is a silent
// no-op. The host product surfaces an explicit opt-in toggle (lands
// in T-541) before flipping this to `true`.

export {
  type PackActivationEvent,
  type PackInstallEvent,
  type PackLicenseKind,
  type PackTelemetryEvent,
  type PackTelemetryPlatform,
  type PackUsageEvent,
  makeActivationEvent,
  makeInstallEvent,
  makeUsageEvent,
} from './events.js';

export { detectPlatform, hashPackId } from './redact.js';

export {
  type PackTelemetryRecorderOptions,
  PackTelemetryRecorder,
  type RecordActivationInput,
  type RecordInstallInput,
  type RecordUsageInput,
  type TelemetryTransport,
} from './recorder.js';

export {
  BufferedTransport,
  type BufferedTransportOptions,
  type FetchLike,
  HttpTransport,
  type HttpTransportOptions,
  NoopTransport,
  type TelemetryLogger,
  defaultTelemetryLogger,
} from './transport.js';
