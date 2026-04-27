// packages/observability/src/errors.ts
// Sentry error/breadcrumb wrappers per ACs #8–#10. The package supports an
// "off-Sentry" mode (DSN unset, AC #9) where every entry point is a silent
// no-op. We inject the Sentry client through __setSentryClientForTests so the
// unit suite can assert on it; init.ts wires the real client at boot.

/** Marker added to errors that have already been forwarded to Sentry; the
 * logger consults this to avoid double-capture (AC #13 protection). */
export const SENTRY_CAPTURED_MARKER = '__stageflipSentryCaptured';

/** Minimal Sentry surface used by this package. Matches @sentry/node 10.x. */
export interface SentryClientLike {
  captureException(exception: unknown, hint?: { extra?: Record<string, unknown> }): unknown;
  addBreadcrumb(breadcrumb: { message: string; data?: Record<string, unknown> }): void;
}

let activeSentryClient: SentryClientLike | null = null;

/** init.ts sets this on boot; tests overwrite via __setSentryClientForTests. */
export function __setSentryClientForTests(client: SentryClientLike | null): void {
  activeSentryClient = client;
}

/** Reset to off-Sentry mode (between tests). */
export function __resetErrorsForTests(): void {
  activeSentryClient = null;
}

/** Get the currently active Sentry client, or null if off-Sentry. */
export function __getSentryClientForTests(): SentryClientLike | null {
  return activeSentryClient;
}

/** Forward an error to Sentry; off-Sentry mode is a silent no-op (AC #9). */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (activeSentryClient === null) return;
  // Mark the error so logger.error doesn't re-capture (AC #13 / spec note 3).
  if (err !== null && typeof err === 'object') {
    (err as Record<string, unknown>)[SENTRY_CAPTURED_MARKER] = true;
  }
  const hint: { extra?: Record<string, unknown> } = {};
  if (context !== undefined) hint.extra = context;
  activeSentryClient.captureException(err, hint);
}

/** Add a Sentry breadcrumb to the current scope. AC #10. */
export function captureBreadcrumb(message: string, data?: Record<string, unknown>): void {
  if (activeSentryClient === null) return;
  const breadcrumb: { message: string; data?: Record<string, unknown> } = { message };
  if (data !== undefined) breadcrumb.data = data;
  activeSentryClient.addBreadcrumb(breadcrumb);
}
