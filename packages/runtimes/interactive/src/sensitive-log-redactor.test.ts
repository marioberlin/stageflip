// packages/runtimes/interactive/src/sensitive-log-redactor.test.ts
// T-403 R-15 — coverage for installSensitiveLogRedactor / uninstall.
// Each pattern type, install/uninstall idempotency, recursion into
// plain objects + arrays, and pass-through for non-credential strings.

import { describe, expect, it, vi } from 'vitest';

import {
  type ConsoleLike,
  REDACTION_PLACEHOLDER_FOR_TESTS,
  installSensitiveLogRedactor,
  uninstallSensitiveLogRedactor,
} from './sensitive-log-redactor.js';

type SpyConsole = ConsoleLike & {
  log: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
};

/**
 * Build a record of spy methods AND the matching ConsoleLike. The spies
 * stay separately addressable so tests can read `.mock.calls` after the
 * wrapper replaces the method on the ConsoleLike.
 */
function makeStubConsole(): {
  console: ConsoleLike;
  spies: SpyConsole;
} {
  const spies: SpyConsole = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  const cons: ConsoleLike = {
    log: (...args: unknown[]) => spies.log(...args),
    info: (...args: unknown[]) => spies.info(...args),
    warn: (...args: unknown[]) => spies.warn(...args),
    error: (...args: unknown[]) => spies.error(...args),
    debug: (...args: unknown[]) => spies.debug(...args),
  };
  return { console: cons, spies };
}

describe('sensitive-log-redactor', () => {
  it('R-15 — Bearer token in a top-level string is redacted', () => {
    const { console: cons, spies } = makeStubConsole();
    installSensitiveLogRedactor(cons);
    cons.log?.('Authorization: Bearer abcdef0123456789ABCDEF');
    expect(spies.log).toHaveBeenCalledWith(`Authorization: ${REDACTION_PLACEHOLDER_FOR_TESTS}`);
  });

  it('R-15 — JWT in a top-level string is redacted', () => {
    const { console: cons, spies } = makeStubConsole();
    installSensitiveLogRedactor(cons);
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2Q';
    cons.log?.('token=', jwt);
    expect(spies.log).toHaveBeenCalledWith('token=', REDACTION_PLACEHOLDER_FOR_TESTS);
  });

  it('R-15 — API-key prefix family (sk_*, pk_*, api_*) is redacted', () => {
    const { console: cons, spies } = makeStubConsole();
    installSensitiveLogRedactor(cons);
    cons.warn?.('keys', 'sk_live_abcdefghijklmnopqrst', 'pk_test_zyxwvutsrqponmlkjih');
    expect(spies.warn).toHaveBeenCalledWith(
      'keys',
      REDACTION_PLACEHOLDER_FOR_TESTS,
      REDACTION_PLACEHOLDER_FOR_TESTS,
    );
  });

  it('R-15 — non-matching strings pass through unchanged', () => {
    const { console: cons, spies } = makeStubConsole();
    installSensitiveLogRedactor(cons);
    cons.log?.('hello world', 42, true, null);
    expect(spies.log).toHaveBeenCalledWith('hello world', 42, true, null);
  });

  it('R-15 — credentials inside nested plain-object values are redacted', () => {
    const { console: cons, spies } = makeStubConsole();
    installSensitiveLogRedactor(cons);
    const payload = {
      tenant: 'acme',
      auth: { header: 'Bearer abcdef0123456789ABCDEFGH' },
      keys: ['sk_live_abcdefghijklmnopqrst'],
    };
    cons.error?.('payload:', payload);
    expect(spies.error).toHaveBeenCalledWith('payload:', {
      tenant: 'acme',
      auth: { header: REDACTION_PLACEHOLDER_FOR_TESTS },
      keys: [REDACTION_PLACEHOLDER_FOR_TESTS],
    });
  });

  it('R-15 — uninstall restores original methods (round-trip)', () => {
    const { console: cons } = makeStubConsole();
    const originalLog = cons.log;
    installSensitiveLogRedactor(cons);
    expect(cons.log).not.toBe(originalLog);
    uninstallSensitiveLogRedactor(cons);
    expect(cons.log).toBe(originalLog);
  });

  it('R-15 — install is idempotent (no double-wrapping)', () => {
    const { console: cons, spies } = makeStubConsole();
    installSensitiveLogRedactor(cons);
    const wrappedOnce = cons.log;
    installSensitiveLogRedactor(cons);
    expect(cons.log).toBe(wrappedOnce);
    cons.log?.('Bearer abcdef0123456789ABCDEF');
    // Underlying spy registers ONE call with the redacted form.
    expect(spies.log).toHaveBeenCalledTimes(1);
    expect(spies.log).toHaveBeenCalledWith(REDACTION_PLACEHOLDER_FOR_TESTS);
  });

  it('R-15 — uninstall is idempotent (no-op when not installed)', () => {
    const { console: cons } = makeStubConsole();
    expect(() => uninstallSensitiveLogRedactor(cons)).not.toThrow();
  });

  it('R-15 — cycle in nested object does not crash the redactor', () => {
    const { console: cons } = makeStubConsole();
    installSensitiveLogRedactor(cons);
    type Cyclic = { name: string; self?: Cyclic };
    const cyclic: Cyclic = { name: 'top' };
    cyclic.self = cyclic;
    expect(() => cons.log?.('cycle:', cyclic)).not.toThrow();
  });

  it('R-15 — Error instances are passed through unchanged (do not recurse)', () => {
    const { console: cons, spies } = makeStubConsole();
    installSensitiveLogRedactor(cons);
    const err = new Error('boom');
    cons.error?.('failure:', err);
    const lastCall = (spies.error.mock.calls[0] ?? []) as readonly unknown[];
    expect(lastCall[1]).toBe(err);
  });
});
