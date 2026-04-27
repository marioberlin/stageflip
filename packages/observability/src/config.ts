// packages/observability/src/config.ts
// Env-var → ObservabilityConfig parsing per D-T264-2 (sampling defaults) and
// D-T264-4 (deployment.environment from NODE_ENV). Throws on bad sample-rate.

/** Resolved deployment environment label per D-T264-4. */
export type DeploymentEnvironment = 'dev' | 'staging' | 'prod';

/** Resolved observability config — the union of env input + computed defaults. */
export interface ObservabilityConfig {
  /** Service identifier; consumers override at init time when present. */
  readonly serviceName?: string;
  /** Resolved deployment environment. */
  readonly environment: DeploymentEnvironment;
  /** Trace sample rate ∈ [0, 1]. Forced spans bypass this (D-T264-2). */
  readonly traceSampleRate: number;
  /** Sentry DSN; absent when SENTRY_DSN is unset/empty (AC #3). */
  readonly sentryDsn?: string;
  /** OTLP HTTP endpoint; absent triggers console-fallback (AC #4). */
  readonly otlpEndpoint?: string;
  /** Release identifier (git SHA) for Sentry release tracking (D-T264-5). */
  readonly release?: string;
}

/** Map raw NODE_ENV to one of three buckets. */
function mapEnvironment(nodeEnv: string | undefined): DeploymentEnvironment {
  if (nodeEnv === 'production') return 'prod';
  if (nodeEnv === 'staging') return 'staging';
  // dev | test | development | undefined → 'dev'
  return 'dev';
}

/** Default sample rate per environment per D-T264-2. */
function defaultSampleRate(env: DeploymentEnvironment): number {
  switch (env) {
    case 'prod':
      return 0.01;
    case 'staging':
      return 0.1;
    case 'dev':
      return 1;
  }
}

/** Parse + validate trace sample rate from env. Throws on invalid input. */
function parseSampleRate(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(
      `observability: STAGEFLIP_OTEL_TRACE_SAMPLE_RATE="${raw}" is not a finite number`,
    );
  }
  if (n < 0 || n > 1) {
    throw new Error(
      `observability: STAGEFLIP_OTEL_TRACE_SAMPLE_RATE="${raw}" must be between 0 and 1 (inclusive)`,
    );
  }
  return n;
}

/** Read a string env var; treat empty string as unset. */
function readOptionalString(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const v = env[name];
  return v === undefined || v === '' ? undefined : v;
}

/**
 * Resolve the observability config from `env` (defaults to `process.env`).
 *
 * Reads:
 *   - `NODE_ENV` → deployment.environment (production → prod; staging passthrough; everything else → dev)
 *   - `STAGEFLIP_OTEL_TRACE_SAMPLE_RATE` → traceSampleRate (∈ [0, 1])
 *   - `OTEL_EXPORTER_OTLP_ENDPOINT` → otlpEndpoint
 *   - `SENTRY_DSN` → sentryDsn
 *   - `STAGEFLIP_RELEASE` → release
 *
 * Defaults documented in D-T264-2.
 */
export function resolveConfig(env: NodeJS.ProcessEnv = process.env): ObservabilityConfig {
  const environment = mapEnvironment(env.NODE_ENV);
  const traceSampleRate = parseSampleRate(
    env.STAGEFLIP_OTEL_TRACE_SAMPLE_RATE,
    defaultSampleRate(environment),
  );
  const cfg: {
    -readonly [K in keyof ObservabilityConfig]: ObservabilityConfig[K];
  } = {
    environment,
    traceSampleRate,
  };
  const dsn = readOptionalString(env, 'SENTRY_DSN');
  if (dsn !== undefined) cfg.sentryDsn = dsn;
  const otlp = readOptionalString(env, 'OTEL_EXPORTER_OTLP_ENDPOINT');
  if (otlp !== undefined) cfg.otlpEndpoint = otlp;
  const release = readOptionalString(env, 'STAGEFLIP_RELEASE');
  if (release !== undefined) cfg.release = release;
  return cfg;
}
