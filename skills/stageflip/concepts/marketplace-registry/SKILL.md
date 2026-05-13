---
title: Marketplace registry
id: skills/stageflip/concepts/marketplace-registry
tier: concept
status: substantive
last_updated: 2026-05-13
owner_task: T-536
related:
  - skills/stageflip/concepts/bundles/SKILL.md
  - skills/stageflip/concepts/licensing/SKILL.md
---

# Marketplace registry

`@stageflip/marketplace-registry` is the server-side library that
backs `marketplace.stageflip.dev` per ADR-014. It is NOT a running
service — it is the route-handler bundle that T-550 (marketplace GA)
wires into a Cloud-Run-deployable host. T-536 ships the library +
the in-memory shim implementations sufficient for unit testing the
contract today.

## Surface

The package exposes:

- **`StorageAdapter`** — abstract artifact store. Production uses
  Google Cloud Storage; tests use `InMemoryStorageAdapter`.
  Archive / signature / manifest blobs live behind this interface.
- **`PublisherKeyRegistry`** — TOFU (trust-on-first-use) per
  ADR-014 §D2. First publish from a publisher id binds the
  publisher's Ed25519 public key; subsequent publishes verify the
  supplied key matches.
- **`TokenStore`** — bearer-token validation. Tokens are stored as
  SHA-256 hashes — plaintext NEVER persists. Each binding maps a
  hash → publisher id.
- **`composeHandler(deps)`** — single express-like `RouteHandler`
  combining the route table.
- **`createInMemoryRegistry()`** — convenience constructor wiring
  the three in-memory stores; primarily for tests + dev.

## Routes

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/packs` | Publish a new pack version |
| `GET` | `/api/v1/packs[?publisher=<id>]` | List published packs |
| `GET` | `/api/v1/packs/:publisher/:pack/:version` | Manifest + signed-URL grant |
| `GET` | `/api/v1/packs/:publisher/:pack/:version/archive` | 302 → CDN |

Every route requires a bearer token in the `Authorization` header.
Missing / invalid bearers return `401`. The publish route additionally
enforces that the bearer's bound publisher id matches the manifest's
`publisher.id` — a token can only publish for its own publisher.

## Publish flow

```
POST /api/v1/packs
Authorization: Bearer <token>
{
  "packId":   "<manifest.id>",
  "version":  "<manifest.version>",
  "manifest": { ... },
  "archiveBase64":         "<base64 archive>",
  "signatureBase64":       "<base64 detached signature>",
  "publisherPublicKeyPem": "<PEM Ed25519 public key>"
}
```

The handler:
1. Validates the bearer token → resolves publisher id.
2. Parses the JSON body + the manifest via `parsePackManifest`.
3. Cross-checks `packId` / `version` against the manifest.
4. Confirms `manifest.publisher.id === bearer-bound publisher`.
5. Records-or-verifies the publisher key via TOFU.
6. Verifies the Ed25519 signature against the archive bytes +
   public key.
7. Rejects with 409 if the version is already published (per
   ADR-014 §D3 version-immutability).
8. Persists archive + signature + canonicalized manifest into the
   `StorageAdapter`.

## Storage key conventions

| Kind | Key |
|---|---|
| Archive | `archives/<publisher>/<pack>/<version>/archive.sfpack` |
| Signature | `signatures/<publisher>/<pack>/<version>/signature.bin` |
| Manifest | `manifests/<publisher>/<pack>/<version>/manifest.json` |

Publisher keys are NOT a `StorageAdapter` concern — they live
inside the `PublisherKeyRegistry` implementation.

## What's NOT in T-536

- **No deployment.** T-536 ships the library; T-550 wires it into
  a Cloud-Run service + Firestore-backed `StorageAdapter` /
  `PublisherKeyRegistry` / `TokenStore` implementations.
- **No rate limiting.** ADR-014 calls for 100 req/min per token;
  the limiter is deferred to T-550.
- **No third-party publisher onboarding.** First-party publishers
  only at v1; the third-party flow lands via T-498 / T-540+.
- **No tenant entitlement enforcement.** The marketplace download
  routes are open to any valid token at T-536; tenant-scoped
  entitlement gating arrives with T-543 (tier system).

## Determinism perimeter

`packages/marketplace-registry/**` lives OUTSIDE the determinism
perimeter per CLAUDE.md §3. The registry is host-side / server-side;
no clip / runtime code lives in this package.
