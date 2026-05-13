// packages/pack-cli/src/pack-ref.ts
// T-497 — Parse a `<pack-id>[@<version>]` CLI argument. Shared between
// `info`, `verify`, and `remove`.

/** Parsed `<pack-id>[@<version>]` argument. */
export interface PackRef {
  readonly id: string;
  readonly version?: string;
}

/**
 * Parse `<pack-id>[@<version>]` or return `null` if the input is empty /
 * undefined / malformed. The caller emits a typed error.
 */
export function parsePackRef(input: string | undefined): PackRef | null {
  if (input === undefined || input.length === 0) return null;
  const atIdx = input.indexOf('@');
  if (atIdx === -1) {
    return { id: input };
  }
  const id = input.slice(0, atIdx);
  const version = input.slice(atIdx + 1);
  if (id.length === 0 || version.length === 0) return null;
  return { id, version };
}
