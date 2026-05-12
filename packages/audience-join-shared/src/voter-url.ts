// packages/audience-join-shared/src/voter-url.ts
// T-456 — Builds the public voter URL for a given session, e.g.
// `https://join.stageflip.app/<sessionId>`. Both the editor-shell modal
// (which renders the QR + copy-to-clipboard) and the audience-join app
// (which validates a hand-entered code by navigating here) import this
// helper so the URL shape is one source of truth.
//
// Browser-safe — no Node-only imports.

/** Inputs for `voterUrlFor`. */
export interface VoterUrlInput {
  /**
   * The audience-join app's public origin, e.g.
   * `https://join.stageflip.app` (or `http://localhost:3500` for local
   * dev). Trailing slashes are tolerated. MUST be `http(s)://`.
   */
  readonly baseUrl: string;
  /** The session id the voter will join. MUST be non-empty. */
  readonly sessionId: string;
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Build the voter URL for the given session. Validates `baseUrl` is a
 * non-empty `http(s)://` URL and that `sessionId` is non-empty. The
 * returned URL is `<baseUrl>/<encodeURIComponent(sessionId)>`.
 *
 * Throws `Error` with a message naming the invalid field.
 */
export function voterUrlFor(input: VoterUrlInput): string {
  const { baseUrl, sessionId } = input;
  if (typeof baseUrl !== 'string' || baseUrl.length === 0) {
    throw new Error('voterUrlFor: baseUrl must be a non-empty string.');
  }
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('voterUrlFor: sessionId must be a non-empty string.');
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(`voterUrlFor: baseUrl is not a valid URL: ${baseUrl}`);
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(
      `voterUrlFor: baseUrl protocol must be http: or https:, got ${parsed.protocol}`,
    );
  }

  const trimmed = baseUrl.replace(/\/+$/, '');
  return `${trimmed}/${encodeURIComponent(sessionId)}`;
}
