// packages/runtimes/interactive/src/network-allowlist.ts
// Global URL allowlist gating the 'network' permission per T-403 R-5.
// PO decision (2026-05-14): global scope (not per-tenant); warn-then-
// enforce rollout (30-day grace from ENFORCEMENT_STARTS_AT).
//
// Empty default = nothing on the allowlist. During the warn window the
// gate logs telemetry but does NOT block. After the cutover the gate
// rejects mounts whose clip exercises a non-allowlisted host (detected
// by the clip's runtime fetch/XHR; for v1 we trust the clip's
// declared egress).
//
// BROWSER-SAFE: pure module — no `fs` / `path` / `child_process` / no
// network calls. State is module-level; the deny-all default keeps the
// tier safe even if a consumer forgets to seed.
//
// Mirrors the pattern in
// `packages/schema/src/clips/interactive/live-data-props.ts`
// (T-404 R-1 `extendAllowedHosts`).

/**
 * ISO-8601 date string at which the warn-then-enforce rollout flips
 * from `'warn'` to `'enforce'`. Enforcement begins at start-of-day UTC.
 *
 * PO decision (2026-05-14): 30-day grace window → 2026-06-13.
 */
export const ENFORCEMENT_STARTS_AT = '2026-06-13';

const trustedNetworkHostPatterns: RegExp[] = [];

/**
 * Snapshot of the current allowlist for telemetry / debugging. Returns
 * a fresh copy each call so callers cannot mutate the underlying array.
 */
export function NETWORK_ALLOWED_HOST_PATTERNS(): readonly RegExp[] {
  return [...trustedNetworkHostPatterns];
}

/**
 * Extend the network host allowlist with additional regex patterns.
 * MERGE semantics — calling twice extends; never replaces. Duplicate
 * patterns (same `source` + `flags`) are skipped to keep the array
 * small.
 *
 * Typical use: a host shell calls this at startup with the static
 * first-party host set; tests call it inside `beforeEach`.
 */
export function extendNetworkAllowedHosts(patterns: readonly RegExp[]): void {
  for (const pattern of patterns) {
    const exists = trustedNetworkHostPatterns.some(
      (existing) => existing.source === pattern.source && existing.flags === pattern.flags,
    );
    if (!exists) {
      trustedNetworkHostPatterns.push(pattern);
    }
  }
}

/**
 * Test-only reset of the network allowlist back to `[]` (T-403 R-5).
 * Underscored to flag it as not-for-production. The module has no
 * other writable state.
 */
export function __resetNetworkAllowlistForTests(): void {
  trustedNetworkHostPatterns.length = 0;
}

/**
 * Pure predicate: is the given host on the allowlist? Empty allowlist
 * returns `false` for every input (deny-all-by-default).
 */
export function isNetworkHostAllowed(host: string): boolean {
  return trustedNetworkHostPatterns.some((pattern) => pattern.test(host));
}

/**
 * Decision shape returned by {@link evaluateNetworkGate}. The trio of
 * fields is captured on `PermissionShim.lastNetworkGateDecision` so
 * test code (and future telemetry) can verify the gate ran and which
 * branch it took.
 *
 * - `outcome: 'permit'` — the call may proceed. Used both in warn-mode
 *   (no destination info, or allowlisted destination) and enforce-mode
 *   (allowlisted destination, or legacy caller with no destination
 *   info supplied).
 * - `outcome: 'warn-only'` — the destination is non-allowlisted but
 *   the gate is still in warn-mode; the call proceeds while telemetry
 *   records the breach. Only emitted before {@link ENFORCEMENT_STARTS_AT}.
 * - `outcome: 'block'` — the destination is non-allowlisted and the
 *   gate is in enforce-mode; the call MUST be rejected.
 *
 * `mode` is the rollout-phase the clock landed in. `reason` is a
 * stable enum the telemetry pipeline keys on.
 */
export interface NetworkGateDecision {
  readonly outcome: 'permit' | 'warn-only' | 'block';
  readonly mode: 'warn' | 'enforce';
  readonly reason?:
    | 'enforcement-pending'
    | 'host-allowlisted'
    | 'host-not-allowlisted-block'
    | 'host-not-allowlisted-warn';
}

/**
 * Pure: given a clock + (optional) destination host, return the gate
 * decision. No I/O, no global state writes — reads only the
 * module-level allowlist.
 *
 * Semantics:
 *
 * - If `now < enforcementStartsAt`: `mode === 'warn'`.
 *   - With `destinationHost` undefined: `outcome: 'permit'`,
 *     `reason: 'enforcement-pending'` (legacy callers don't yet
 *     supply hosts; warn-mode permits silently).
 *   - With `destinationHost` allowlisted: `outcome: 'permit'`,
 *     `reason: 'host-allowlisted'`.
 *   - With `destinationHost` non-allowlisted: `outcome: 'warn-only'`,
 *     `reason: 'host-not-allowlisted-warn'`. The caller permits the
 *     request but records telemetry.
 * - If `now >= enforcementStartsAt`: `mode === 'enforce'`.
 *   - With `destinationHost` undefined: `outcome: 'permit'`,
 *     `reason: 'enforcement-pending'` (this is the coarse permission-
 *     envelope-level gate; per-call host enforcement is the clip-
 *     level fetch wrapper's job and is the residual scope after T-403
 *     R-5 closure).
 *   - With `destinationHost` allowlisted: `outcome: 'permit'`,
 *     `reason: 'host-allowlisted'`.
 *   - With `destinationHost` non-allowlisted: `outcome: 'block'`,
 *     `reason: 'host-not-allowlisted-block'`.
 *
 * Boundary: `now === enforcementStartsAt` is treated as `'enforce'`
 * (inclusive).
 */
export function evaluateNetworkGate(args: {
  /** Current time as ISO-8601 string. */
  readonly nowIso: string;
  /**
   * Optional concrete destination host. If undefined, host-level
   * enforcement is skipped (legacy path — the v1 `requestPermission`
   * call site does not yet thread per-mount destination info).
   */
  readonly destinationHost?: string;
  /**
   * Override for testing. Defaults to {@link ENFORCEMENT_STARTS_AT}.
   */
  readonly enforcementStartsAt?: string;
}): NetworkGateDecision {
  const cutover = args.enforcementStartsAt ?? ENFORCEMENT_STARTS_AT;
  const nowMs = Date.parse(args.nowIso);
  const cutoverMs = Date.parse(cutover);
  const inWarnWindow = nowMs < cutoverMs;
  const mode: 'warn' | 'enforce' = inWarnWindow ? 'warn' : 'enforce';

  if (args.destinationHost === undefined) {
    return { outcome: 'permit', mode, reason: 'enforcement-pending' };
  }

  const allowed = isNetworkHostAllowed(args.destinationHost);
  if (allowed) {
    return { outcome: 'permit', mode, reason: 'host-allowlisted' };
  }
  if (inWarnWindow) {
    return { outcome: 'warn-only', mode, reason: 'host-not-allowlisted-warn' };
  }
  return { outcome: 'block', mode, reason: 'host-not-allowlisted-block' };
}
