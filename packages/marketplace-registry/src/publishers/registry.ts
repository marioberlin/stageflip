// packages/marketplace-registry/src/publishers/registry.ts
// T-536 — TOFU (Trust-on-First-Use) publisher-key registry per ADR-014
// §D2. First publish from a publisher id binds that publisher's
// public key; subsequent publishes verify the supplied key matches
// the bound one byte-for-byte (after PEM normalization).
//
// Mirrors the structural shape of `PublisherKeyRegistryLike` from
// `@stageflip/pack-loader` — the loader's TOFU cache on disk is the
// tenant-side counterpart of this server-side registry.
//
// Determinism perimeter: outside (server-side).

/** Result of a TOFU record-or-verify call. */
export interface TofuResult {
  /** `true` if the key was either freshly recorded or matched the bound key. */
  readonly ok: boolean;
  /** When `ok === false`, a short machine-readable reason. */
  readonly reason?: string;
}

/**
 * Server-side TOFU publisher-key registry. Holds publisher ids →
 * canonical public-key PEM strings. Concrete implementations may
 * persist in Firestore (production) or memory (tests).
 */
export interface PublisherKeyRegistry {
  /**
   * On first call for `publisherId`: bind `publicKeyPem` and return
   * `{ ok: true }`. On subsequent calls: compare the supplied PEM
   * against the bound one. Returns `{ ok: false, reason: 'key-mismatch' }`
   * on mismatch. PEM strings are normalized (whitespace + newline
   * trimmed) before comparison so trivially-different PEM
   * formattings of the same key compare equal.
   */
  readonly recordOrVerify: (publisherId: string, publicKeyPem: string) => Promise<TofuResult>;

  /**
   * Look up the bound public key for `publisherId`. Returns `null`
   * if the publisher has never published before.
   */
  readonly getPublicKey: (publisherId: string) => Promise<string | null>;
}

/**
 * In-memory `PublisherKeyRegistry`. Each instance has its own map;
 * there is NO global state.
 */
export class InMemoryPublisherKeyRegistry implements PublisherKeyRegistry {
  private readonly bound = new Map<string, string>();

  readonly recordOrVerify = async (
    publisherId: string,
    publicKeyPem: string,
  ): Promise<TofuResult> => {
    const normalized = normalizePem(publicKeyPem);
    const existing = this.bound.get(publisherId);
    if (existing === undefined) {
      this.bound.set(publisherId, normalized);
      return { ok: true };
    }
    if (existing !== normalized) {
      return { ok: false, reason: 'key-mismatch' };
    }
    return { ok: true };
  };

  readonly getPublicKey = async (publisherId: string): Promise<string | null> => {
    return this.bound.get(publisherId) ?? null;
  };
}

/**
 * Normalize a PEM string for byte-comparable equality: strip leading +
 * trailing whitespace, collapse internal `\r\n` to `\n`. PEM headers
 * + body are left intact.
 */
function normalizePem(pem: string): string {
  return pem.replace(/\r\n/g, '\n').trim();
}
