<!-- docs/pack-release-process.md — Per-pack release process: semver rules + changelog format (T-552). -->

# Per-Pack Release Process

Companion to [pack-author-guide.md](./pack-author-guide.md). This doc
defines the release contract a third-party pack publisher MUST follow:
semantic-versioning rules, changelog format, prerelease channels, and
the publisher-side checklist that runs before tag-and-publish.

If you are extending the workspace itself (first-party pack), read
`CLAUDE.md` first and treat this as advisory.

---

## 1. Overview

A **pack release** is the atomic unit of distribution. A release
consists of:

1. A **manifest version bump** (`manifest.version`, SemVer 2.0).
2. A **signed SFPACK1 archive** produced by `stageflip-pack-sign`
   (T-498). Archive integrity-hash is recomputed for every release.
3. A **changelog entry** at
   `packs/stageflip/<publisher>/<id>/CHANGELOG.md` per §4.
4. A **git tag** of the form `pack-<id>@<version>`.

Two release channels exist:

| Channel | Version pattern | Loader behavior |
|---|---|---|
| **stable** | `<MAJOR>.<MINOR>.<PATCH>` | Eligible for default upgrade path. |
| **prerelease** | `<MAJOR>.<MINOR>.<PATCH>-rc.<N>` or `-beta.<N>` | Opt-in per-tenant only; never auto-installed. |

The `manifestVersion` field (literal `"1"`) is **independent** of the
pack's semver — it tracks the SFPACK1 manifest schema (T-498), not the
pack content. Bumping `manifestVersion` is a registry-coordinated
event, not a publisher-driven one. See `packages/pack-format/src/manifest.ts`.

---

## 2. Semantic versioning rules

Pack versions follow SemVer 2.0. The triggers below are normative.

### 2.1 MAJOR — breaking

| Trigger | Notes |
|---|---|
| Breaking preset binding shape change | A clip kind that previously consumed shape A now requires shape B; existing tenants render blank or error. |
| Removal of a preset | Drop a row from `contributes.presets`. Tenants relying on the preset id break. |
| New required tier | Pack flips `license.kind` from `open` to `paid-per-tenant`, OR raises required `TenantTier` (per `@stageflip/marketplace-tier`, T-543). |
| Manifest schema major bump | The `manifestVersion` literal moves from `"1"` to `"2"` (registry-coordinated). |
| Removal of a contributed clipKind, font, asset, tool, adapter, or themePack | Any subtraction from `contributes` is breaking. |

### 2.2 MINOR — additive

| Trigger | Notes |
|---|---|
| New preset added | Append a row to `contributes.presets`. Existing presets unchanged. |
| New concept skill or preset-id-level skill added under `skills/concepts/pack-<id>/` | T-547 surface extension. |
| New optional pack-shipped clipKind primitive | Append to `contributes.clipKinds`. Existing clip kinds unchanged. |
| New opt-in tier feature | Adds capability without requiring a tier upgrade for existing tenants. |
| New optional manifest field consumed | Provided the loader treats absence as the prior default. |
| Re-baselining parity fixtures with NEW fixtures shipped | Existing fixtures unchanged; new ones land via §6 sign-off. |

### 2.3 PATCH — fix-only

| Trigger | Notes |
|---|---|
| Bugfix to existing preset render | Output observably converges to intent without changing binding shape. |
| Parity-fixture re-baseline within cluster threshold | Per §6 — must stay within `DEFAULT_CLUSTER_THRESHOLDS` (T-549). |
| Skill copy edit (no behavior change) | Wording, typo, formatting only. |
| Documentation-only change in `skills/concepts/pack-<id>/` | Pure prose; no compiled-into-RIR effect. |
| Internal refactor with no observable change | Build script, test scaffolding, etc. |

When unsure between MINOR and PATCH, prefer MINOR — the cost of a
spurious MINOR is one extra `needs-upgrade` notification per tenant;
the cost of a missed MINOR is silent capability drift.

---

## 3. Prerelease channels

Prerelease tags follow SemVer 2.0 build-metadata syntax:

```
<MAJOR>.<MINOR>.<PATCH>-rc.<N>      # release candidate
<MAJOR>.<MINOR>.<PATCH>-beta.<N>    # beta / preview
```

- `N` is a monotonically increasing integer per `<MAJOR>.<MINOR>.<PATCH>` line.
- A prerelease MUST NOT graduate to the stable version of the same triple — bump PATCH on graduation (e.g. `2.4.0-rc.3` → `2.4.0` is forbidden; ship `2.4.1` instead, or rebuild from a fresh `2.4.0`).
- Prereleases MUST be opted into per-tenant. The `@stageflip/pack-loader` (T-495) honors prereleases only when the tenant has explicitly enabled them; default behavior treats prerelease versions as ineligible.
- A prerelease that increments `manifestVersion` against an installed loader returns `manifest-version-incompatible` from `planUpgrade` (T-540, `packages/pack-loader/src/upgrade-planner.ts`).

Prereleases do NOT register first-party telemetry against the stable
channel — `@stageflip/pack-telemetry` (T-503) tags the event with the
full version string.

---

## 4. Changelog format

Every release MUST add an entry to
`packs/stageflip/<publisher>/<id>/CHANGELOG.md` following
[Keep a Changelog v1.1.0](https://keepachangelog.com/en/1.1.0/).

### 4.1 File template

```markdown
# Changelog

All notable changes to this pack are documented in this file.

The format is based on Keep a Changelog v1.1.0, and this pack
adheres to Semantic Versioning 2.0.

## [Unreleased]

## [1.2.0] - 2026-05-14

### Added
- New preset `vintage-news-ticker` for cluster A.
- Concept-skill entry for the new preset under
  `skills/concepts/pack-acmecorp-news-pro/preset-vintage-news-ticker/SKILL.md`.

### Changed
- Re-tuned `LF-LICENSE-TRIAL-ACTIVE` watermark opacity for
  `premium-news-ticker`.

### Fixed
- `sky-news-pro-register` no longer drops the second register on
  aspect ratio 9:16.

### LF impact
- `LF-LICENSE-TRIAL-ACTIVE` (warn) — watermark opacity tuned;
  no severity change.

## [1.1.3] - 2026-04-30
...
```

### 4.2 Required sections

Each `## [VERSION] - YYYY-MM-DD` block MAY contain any subset of:

- `### Added` — new contributions, presets, skills.
- `### Changed` — modifications to existing contributions.
- `### Deprecated` — soon-to-be-removed contributions (see §9).
- `### Removed` — contributions removed in this release (MAJOR-only).
- `### Fixed` — bugfixes.
- `### Security` — security-relevant fixes.
- `### LF impact` — see §5.

The date is ISO 8601 (`YYYY-MM-DD`), matching the day the SFPACK1 archive was signed.

---

## 5. Loss-flag impact field

A release that introduces, removes, or changes when any of the eight
LF-* codes from `@stageflip/pack-format` (`PACK_FORMAT_LF_CODES`,
`packages/pack-format/src/loss-flags.ts`) surface MUST include an
`### LF impact` section listing the affected codes.

The eight codes:

- `LF-LICENSE-PACK-DENIED`
- `LF-LICENSE-CLIP-REVOKED`
- `LF-PACK-SIGNATURE-INVALID`
- `LF-PACK-INCOMPATIBLE-VERSION`
- `LF-PACK-MANIFEST-PARSE-ERROR`
- `LF-LICENSE-TRIAL-ACTIVE`
- `LF-LICENSE-TRIAL-EXPIRED`
- `LF-NPM-TOKEN-MISSING`

Severities and triggers are defined per-code in
`@stageflip/pack-format` (see [pack-author-guide.md §14](./pack-author-guide.md)).
The release MAY only call out *which* codes are affected and *how* —
the catalogue itself is the authority on severity. Releases that
re-classify severity require coordinator review (see CLAUDE.md §6
escalation rules).

---

## 6. Parity-fixture re-baseline policy

For packs that ship parity fixtures (typically Cluster D, G, or any
custom-cluster pack — see [pack-author-guide.md §5](./pack-author-guide.md)):

| Release tier | Permitted fixture change |
|---|---|
| **PATCH** | Re-render existing fixtures; output MUST stay within the cluster's `DEFAULT_CLUSTER_THRESHOLDS` (T-549, `packages/pack-parity-validator/src/thresholds/cluster-thresholds.ts`). PSNR + SSIM gates are non-negotiable. |
| **MINOR** | Add NEW fixtures alongside unchanged old ones. New fixtures sign off via the **per-pack** `docs/parity-fixture-signoff.md` inside the publisher's repo. |
| **MAJOR** | Re-baseline + remove fixtures permitted; full sign-off required for every changed/added fixture. |

Run `validatePackFixtures` from `@stageflip/pack-parity-validator` on
every release; the install-time loader runs the same module against
the published fixtures.

**Do not** write to the workspace-level `docs/ops/parity-fixture-signoff.md`
from a third-party pack release flow. That file is procedural and
managed in-workspace; sign-off for shipped first-party preset frontmatter
lives there. Per-pack sign-off lives in the pack's own repo.

---

## 7. Skill drift between releases

Every release MUST update `skills/concepts/pack-<id>/SKILL.md` (and any
preset-id-level skill entry) when the behavior surface changes —
contributions added, removed, or re-shaped.

- T-547 — installed packs extend the in-context skill tree; tenants
  see the pack's skills as part of their effective context.
- T-548 — workspace `pnpm check-skill-drift` surfaces per-pack drift
  as **warnings only**, never fail-build. The tier-coverage invariant
  remains core-only.

Pack authors SHOULD treat per-pack skill drift as **gating** their own
publish flow — even though the workspace gate is non-blocking, a
tenant installing your pack expects its skill files to match its
behavior. Run your own equivalent of `check-skill-drift` against
`skills/concepts/pack-<id>/**` before tagging.

A copy-edit-only skill change is `### Changed` in the changelog with
no LF impact and qualifies as PATCH.

---

## 8. Tag and publish flow

### 8.1 Tag

```bash
git tag pack-<id>@<version>     # e.g. pack-acmecorp-news-pro@1.2.0
git push origin pack-<id>@<version>
```

Tag once per release. Re-tagging is forbidden — the registry rejects
duplicate `(packId, version)` with `409 conflict /
version-already-published` (see [pack-author-guide.md §7](./pack-author-guide.md)).

### 8.2 Sign

```bash
stageflip-pack-sign sign ./my-pack \
  --key ./keys/publisher.private.pem \
  --out ./dist/my-pack.sfpack
```

The signature is computed over the new archive bytes. Integrity-hash
computation **excludes** the manifest's own `integrity` entry (T-498,
ADR-012 §D3): the manifest is built with a 64-zero placeholder hash,
archived, hashed, then patched.

### 8.3 Publish — registry path

```bash
stageflip-pack-publish publish ./dist/my-pack.sfpack \
  --registry https://marketplace.stageflip.dev \
  --token MY_PUBLISHER_TOKEN \
  --publisher-key ./keys/publisher.public.pem
```

`@stageflip/marketplace-registry` (T-536) `POST /api/v1/packs` accepts
the new version. Versions are immutable; publish fails with `409
conflict` on duplicate.

### 8.4 Publish — npm-path

```bash
npm publish --access public      # under your @scope
```

`@stageflip/marketplace-npm` (T-539) verifies the license claim
locally on tenant install. **New versions inherit prior tenant-scoped
npm-token bindings** unless the publisher explicitly rotates the
publisher scope's tokens. Token rotation is out-of-band — coordinate
with affected tenants before rotating.

---

## 9. Deprecation flow

The current `packManifestSchema` (`packages/pack-format/src/manifest.ts`)
does not yet expose a `deprecated` field on contribution rows. The
intended future shape — to be wired through at the next manifest minor
bump — is:

```json
{
  "deprecated": {
    "reason": "Superseded by line-chart-clean-v2; vector field changed.",
    "supersededBy": "line-chart-clean-v2",
    "sunsetDate": "2026-12-31"
  }
}
```

When introduced, the `deprecated` field is added at a **MINOR** bump
(additive). The `@stageflip/pack-loader` upgrade planner (T-540)
surfaces it via the `needs-upgrade` status. Removal of the
contribution itself happens at the next **MAJOR**.

Until the field exists, communicate deprecation via:

- A `### Deprecated` section in the changelog.
- A `### Changed` note in `skills/concepts/pack-<id>/SKILL.md`.
- Out-of-band publisher-channel notice (mailing list, dashboard).

---

## 10. Tenant upgrade contract

`@stageflip/pack-loader`'s `planUpgrade`
(`packages/pack-loader/src/upgrade-planner.ts`, T-540) classifies each
installed pack against a target engine version into one of four
`PackUpgradeStatus` values:

| Status | Trigger | Tenant action |
|---|---|---|
| `compatible` | engine + manifest both satisfied | Auto-upgradable; no action required. |
| `needs-upgrade` | newer pack version available within current major | Opt-in upgrade; tenant accepts in-app. |
| `blocked` | new MAJOR or new tier requirement | Admin action: raise tier, accept breaking change, or stay on prior version. |
| `manifest-version-incompatible` | pack `manifestVersion` newer than installed loader can read | Engine upgrade required before pack can be loaded. |

Pack authors are responsible for ensuring version bumps map cleanly
to these states:

- A bump that doesn't change `platformCompatibility` and doesn't
  raise `license.kind` SHOULD resolve to `compatible` or
  `needs-upgrade` for current tenants.
- A bump that tightens `platformCompatibility` or adds a tier
  requirement WILL resolve to `blocked` for affected tenants —
  callable expectation, called out in the changelog.

---

## 11. Release checklist

Copy this into your release PR description and tick before tagging.

- [ ] Version bumped per §2 rules
- [ ] CHANGELOG.md entry for new version (Keep a Changelog v1.1.0)
- [ ] LF-* impact section if applicable
- [ ] `skills/concepts/pack-<id>/SKILL.md` updated if behavior surface changed
- [ ] Parity fixtures re-validated via `@stageflip/pack-parity-validator` (Cluster D-style packs)
- [ ] `stageflip-pack-sign` produced new signature
- [ ] Per-pack typecheck/lint/test green
- [ ] Integrity hash matches expected (excludes manifest entry per T-498)
- [ ] Deprecation field set if removing a preset at next MAJOR
- [ ] Tenant upgrade-plan dry-run shows expected `planUpgrade` status

---

## Further reading

- [pack-author-guide.md](./pack-author-guide.md) — full third-party publisher journey
- [implementation-plan.md](./implementation-plan.md) — task-level spec for T-494…T-552
- [ADR-012](decisions/ADR-012-bundle-format-license-runtime.md) — bundle format, license-runtime
- [ADR-013](decisions/ADR-013-pack-catalogue-pricing-tiers.md) — pack catalogue, pricing tiers
- [ADR-014](decisions/ADR-014-marketplace.md) — marketplace
