# Launch Packs Catalogue

Row-level inventory of StageFlip's **first-party launch packs** —
content packages owned + published by StageFlip itself (`publisher.id
= "stageflip"`), distinct from third-party packs the marketplace
admits via the normal pack-loader gate.

Each row lists the pack's identity (`id` / `publisher` / `version`),
the SKU it ships under, the clusters it extends, and a one-line
status describing where the pack is in its delivery arc.

This catalogue is the human-readable companion to
ADR-013 (First-party Pack Catalogue & Pricing Tiers). ADR-013 declares
the policy + pricing tiers; this file records the on-disk inventory.
Updates land in the same PR as the task that materializes the change.

## Packs

| Pack ID | Publisher | Version | SKU | License tier | Clusters | Status |
|---|---|---|---|---|---|---|
| `news-pro` | `stageflip` | `0.1.0` | `news-pro-1y` | `paid-per-tenant` (commercial-subscription) | `cluster-a` | Skeleton landed in T-506; registers filled by T-507 / T-508 / T-509; news-ticker preset T-510. |

## Schema notes

- **Pack ID** — `manifest.id`, lowercase kebab-case, unique per
  publisher.
- **Publisher** — `manifest.publisher.id`. `stageflip` for first-party
  packs.
- **Version** — `manifest.version`, semver.
- **SKU** — `manifest.license.sku` when `kind === 'paid-per-tenant'`
  or `'enterprise'`; `—` for `'open'` packs.
- **License tier** — the `kind` in `manifest.license` plus the
  `pack-publish-cli` tier ID it was rendered from.
- **Clusters** — derived from `manifest.contributes.presets[].cluster`
  (deduplicated).
- **Status** — free-text — task IDs delivering the pack, plus where
  in the arc the pack currently is.

## Maintenance

Append a new row when a launch pack lands its skeleton task. Update
the status string each time a subsequent task in the pack's arc
merges (e.g. when T-507 fills in the Sky News register, update the
news-pro row's status to "Sky News register signed off in T-507; ITV
+ RAI + ticker remain"). The PR that lands the last task of the arc
flips the status to a stable "v0.1.0 GA".
