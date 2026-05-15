// packages/runtimes/interactive/src/sensitive-log-redactor.ts
// T-403 R-15 — host-installable console.log redactor for the interactive
// runtime tier. CLAUDE.md §3 exempts the interactive tier from the no-
// console.log rule (see ADR-003 §D5 + T-306 D-T306-5), so a careless
// clip author could `console.log(apiKey)` and the value would land in
// renderer logs / browser devtools / Sentry / wherever the host pipes
// console output. This module ships an opt-in wrapper that scans
// console arguments for credential-shaped strings and replaces them
// with `[REDACTED]` BEFORE delegating to the original console.
//
// Hosts call `installSensitiveLogRedactor(console)` at boot and
// `uninstallSensitiveLogRedactor(console)` at teardown. The redactor
// is idempotent on both sides: repeated install / uninstall calls
// converge on the expected state without losing or doubling-up the
// wrapper.
//
// Patterns redacted (case-INSENSITIVE on the leading token, the value
// portion is matched as-printed):
//   - `Bearer <token>` — RFC 6750 bearer-token Authorization header.
//   - JWTs — three base64url-encoded segments separated by `.` with
//     a header that decodes to `{"alg":...}`.
//   - API key prefixes — `sk_*`, `pk_*`, `api_*`, `key_*`, `tok_*`,
//     `secret_*`, plus the leading-prefix-on-its-own form (Stripe,
//     OpenAI, Anthropic, GitHub, etc. all use one of these shapes).
//
// The scanner walks plain strings, plain object values (recursively),
// and array elements. It does NOT recurse into class instances,
// Maps, Sets, Errors, DOM nodes, or anything that fails the
// `Object.getPrototypeOf(x) === Object.prototype` check — those
// rarely carry credentials in clip-author code and recursing into
// them causes performance / cycle problems. Cycle detection via a
// WeakSet is in place regardless.
//
// BROWSER-BUNDLE SAFE: no Node-only imports.

/**
 * Methods we wrap on the supplied console-like object. Matches the
 * union the redactor recognises; consumers pass `globalThis.console`
 * by default but tests inject a stub.
 */
const REDACTED_METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const;
type RedactedMethod = (typeof REDACTED_METHODS)[number];

/**
 * Sentinel placed on a wrapped function so we can detect a previously-
 * installed wrapper and skip double-wrapping (idempotency) and so we
 * can recover the original on `uninstallSensitiveLogRedactor`.
 */
const WRAPPER_TAG: unique symbol = Symbol('stageflip:sensitive-log-redactor');

/** Replacement value substituted for any matched credential string. */
const REDACTED_PLACEHOLDER = '[REDACTED]';

/**
 * Patterns that must be redacted from console arguments. ORDER MATTERS:
 * the JWT scanner runs BEFORE the api-key prefix scanner so a
 * `Bearer eyJ...` value loses both the `Bearer ` prefix and the JWT.
 * Each pattern uses a global flag so `replace` strips every occurrence
 * within a single string.
 */
const REDACTION_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  // RFC 6750 bearer-token Authorization header — `Bearer <opaque>`.
  // The opaque token is required; we accept word chars, dot, dash,
  // underscore, plus, slash, equal — the b64-url + b64 cover-set.
  { name: 'bearer', regex: /\bBearer\s+[A-Za-z0-9_\-+/=.]+/gi },
  // JWT — three base64url segments with the canonical header prefix
  // `eyJ` (the URL-safe encoding of `{"`). Length floors keep us out
  // of false-positive territory for short hash-shaped strings.
  { name: 'jwt', regex: /\beyJ[A-Za-z0-9_\-]{4,}\.[A-Za-z0-9_\-]{4,}\.[A-Za-z0-9_\-]{4,}/g },
  // API-key-prefix family: sk_*, pk_*, api_*, key_*, tok_*, secret_*.
  // The trailing token must be at least 16 chars to dodge variable
  // names like `sk_test` and other short identifiers.
  {
    name: 'api-key-prefix',
    regex: /\b(?:sk|pk|api|key|tok|secret)_[A-Za-z0-9_\-]{16,}/gi,
  },
];

/**
 * Console-like surface — a structural typing of `globalThis.console`'s
 * methods we touch. Tests inject `{ log: vi.fn(), ... }`; production
 * code passes `globalThis.console`.
 */
export type ConsoleLike = {
  [K in RedactedMethod]?: (...args: unknown[]) => void;
};

/**
 * Apply every credential-shape pattern to a single string. Order
 * matters per the REDACTION_PATTERNS comment above.
 */
function redactString(value: string): string {
  let result = value;
  for (const { regex } of REDACTION_PATTERNS) {
    result = result.replace(regex, REDACTED_PLACEHOLDER);
  }
  return result;
}

/**
 * Recursively redact a single console argument. Plain objects / arrays
 * are walked; class instances, Errors, DOM nodes, Maps, Sets, etc. are
 * passed through unchanged (their values are rarely credentials and
 * walking them creates more risk than reward).
 */
function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    seen.add(value);
    return value.map((entry) => redactValue(entry, seen));
  }
  // Only recurse into plain objects (`{}` literals). Anything with a
  // non-Object prototype is left alone so we don't mangle Errors / DOM
  // nodes / class instances.
  if (Object.getPrototypeOf(value) === Object.prototype) {
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = redactValue(v, seen);
    }
    return out;
  }
  return value;
}

/**
 * Build the wrapper for one console method. Captures the original so
 * `uninstall` can restore it; tags the wrapper with `WRAPPER_TAG` so
 * repeated installs are idempotent. The wrapper invokes the original
 * with `target` as `this` so methods bound to a particular console
 * instance still see the right receiver.
 */
function makeWrapper(
  original: (...args: unknown[]) => void,
  target: ConsoleLike,
): ((...args: unknown[]) => void) & { [WRAPPER_TAG]?: (...args: unknown[]) => void } {
  const wrapper: ((...args: unknown[]) => void) & {
    [WRAPPER_TAG]?: (...args: unknown[]) => void;
  } = (...args: unknown[]): void => {
    const seen = new WeakSet<object>();
    const redacted = args.map((arg) => redactValue(arg, seen));
    Reflect.apply(original, target, redacted);
  };
  wrapper[WRAPPER_TAG] = original;
  return wrapper;
}

/**
 * Install the credential-redacting wrapper on every method named in
 * REDACTED_METHODS. Idempotent — calling twice on the same console
 * leaves a single wrapper in place. Returns nothing; the host should
 * keep the same console reference around if it intends to call
 * `uninstallSensitiveLogRedactor` later.
 */
export function installSensitiveLogRedactor(target: ConsoleLike): void {
  for (const method of REDACTED_METHODS) {
    const fn = target[method];
    if (typeof fn !== 'function') {
      continue;
    }
    // Already wrapped — bail out so the wrapper does not stack.
    if ((fn as { [WRAPPER_TAG]?: unknown })[WRAPPER_TAG] !== undefined) {
      continue;
    }
    target[method] = makeWrapper(fn, target);
  }
}

/**
 * Uninstall the wrapper installed by `installSensitiveLogRedactor`.
 * Idempotent — calling on a console that was never wrapped (or has
 * already been unwrapped) is a no-op. Restores the original method
 * reference captured at install time.
 */
export function uninstallSensitiveLogRedactor(target: ConsoleLike): void {
  for (const method of REDACTED_METHODS) {
    const fn = target[method];
    if (typeof fn !== 'function') {
      continue;
    }
    const original = (fn as { [WRAPPER_TAG]?: (...args: unknown[]) => void })[WRAPPER_TAG];
    if (original !== undefined) {
      target[method] = original;
    }
  }
}

/**
 * Test-only helper — returns the canonical `[REDACTED]` placeholder
 * so the test file can avoid hard-coding the literal in two places.
 */
export const REDACTION_PLACEHOLDER_FOR_TESTS = REDACTED_PLACEHOLDER;
