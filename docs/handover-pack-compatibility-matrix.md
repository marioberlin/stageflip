# Pack version compatibility matrix (T-502)

## TL;DR

Each `.stageflip-pack` manifest declares `manifestVersion` — the version
of the pack-format schema it was authored against. Each running
StageFlip engine is at some semver. The **compatibility matrix** at
`packages/pack-format/src/compatibility.ts` is the workspace-wide
authoritative table of which engine versions support which
`manifestVersion` values.

Both the install-time loader gate (`@stageflip/pack-loader`) and the
publisher-side validate command (`@stageflip/pack-publish-cli validate`)
consult this matrix.

## Current matrix (as of T-502)

| engineRange  | manifestVersions | note                                   |
|--------------|------------------|----------------------------------------|
| `>=2.0.0`    | `['1']`          | P16 launch: manifestVersion 1 only     |

`manifestVersion` is currently constrained to the literal `'1'` by
`packManifestSchema.manifestVersion = z.literal('1')`. The matrix has
one row. Future rows will be prepended (newest-engine-first) when
`manifestVersion: '2'` ships.

## When to bump manifestVersion

Bump `manifestVersion` ONLY on breaking changes to the manifest schema.
A breaking change is anything that would cause a previously-valid
manifest to be rejected by the new schema, or a previously-rejected
manifest to be accepted in a way that changes semantics.

### Breaking (bump required)

- Adding a new **required** field.
- Removing any field (required or optional) that consumers may rely on.
- Changing a field's type (e.g. `string` → `number`).
- Narrowing an enum (e.g. removing `'paid-per-tenant'` from
  `LicenseClaim.kind`).
- Changing the discriminator of a discriminated union.
- Changing field semantics without changing the shape (e.g. switching
  `version` from semver to calendar versioning).
- Tightening a regex such that previously-valid values now reject.

### Non-breaking (no bump)

- Adding a new **optional** field.
- Widening an enum (adding a new variant).
- Loosening a regex.
- Adding a new optional value to a discriminated union (a NEW union
  member is breaking for OLD readers, but the old reader rejects the
  unknown discriminator at parse time → handled by the matrix, NOT a
  schema bump).
- Adding a new top-level optional surface (e.g. `requiresAdapter` was
  added without bumping).

### Migration policy when bumping

When `manifestVersion: '2'` ships:

1. Add a new row to the matrix for the engine range that introduces v2
   support. The row's `manifestVersions` array lists `['1', '2']` if
   the new engine still reads v1, or `['2']` only if v1 support is
   dropped.
2. Update `packManifestSchema.manifestVersion` to
   `z.enum(['1', '2'])` (or `z.literal('2')` if dropping v1).
3. If both versions coexist in the schema, `parsePackManifest` MUST
   discriminate on the value and apply the appropriate downstream
   schema variant.
4. Bump `@stageflip/pack-format` minor (additive) or major (drops v1).
5. Update this handover doc's matrix table.

## The two-gate model

The pack-loader runs TWO independent compatibility gates back-to-back
(both surface as `LF-PACK-INCOMPATIBLE-VERSION`):

### Gate 2a — manifest-declared `platformCompatibility` range

The pack's manifest declares the engine semver range it wants. Example:
`platformCompatibility: '^2.0.0'`. The loader rejects if the host
engine is outside the range. This is the publisher's declaration of
intent.

### Gate 2b — workspace compatibility-matrix lookup

The matrix is consulted as a SECOND check: even if the pack admits the
engine, the engine must appear in some matrix row that lists the pack's
`manifestVersion`. This is the platform's declaration of capability.

Both gates must pass. The detail string is differentiated so debugging
tooling can tell which sub-check failed.

#### Why two gates?

Consider a future scenario: `manifestVersion: '2'` ships behind a
flag, but the rollout matrix says engine `>=3.0.0` reads
`manifestVersion: '2'`. A pack with
`platformCompatibility: '>=2.0.0'` + `manifestVersion: '2'` would
satisfy gate 2a on a 2.5.0 engine (publisher claimed broad
compatibility) but fail gate 2b (matrix says 2.x engines do NOT read
v2). The matrix prevents the load.

The matrix is also the place to retroactively blacklist a
`manifestVersion` if a critical defect is discovered post-launch —
remove the version from a row without revoking individual packs.

## Currently dormant

Because `packManifestSchema.manifestVersion = z.literal('1')` and the
single matrix row covers `>=2.0.0 → ['1']`, no real-input pack can
fail gate 2b today. The gate is plumbed and tested; it activates when
`manifestVersion: '2'` ships.

The validate-command advisory (`compatibility-advisory` warn-level
issue) IS active today — it prints the matching row's `note` for every
valid pack as a positive confirmation, and warns if a pack declares a
`manifestVersion` not listed in any row.

## API surface (`@stageflip/pack-format`)

```typescript
import {
  COMPATIBILITY_MATRIX,
  type CompatibilityRow,
  isCompatible,
  matchingRows,
  readableManifestVersions,
  satisfiesRange,
} from '@stageflip/pack-format';
```

- `COMPATIBILITY_MATRIX` — readonly array, source of truth.
- `isCompatible(engineVersion, manifestVersion)` — boolean, the
  gate-2b predicate.
- `readableManifestVersions(engineVersion)` — array, for tooling that
  needs to know "what can this engine read?".
- `matchingRows(engineVersion)` — array of `CompatibilityRow`, for
  tooling that wants the `note` field.
- `satisfiesRange(version, range)` — moved here from
  `@stageflip/pack-loader` in T-502 so the matrix can reuse it
  without a circular dep. The loader re-exports it for back-compat.

## Pointers

- `packages/pack-format/src/compatibility.ts` — implementation.
- `packages/pack-format/src/compatibility.test.ts` — tests.
- `packages/pack-loader/src/load-pack.ts` — gate-2b call site.
- `packages/pack-publish-cli/src/commands/validate.ts` — advisory call
  site.
- `docs/decisions/ADR-012-bundle-format-license-runtime.md` §D2 / §D7
  — semantics of `manifestVersion` and `platformCompatibility`.
