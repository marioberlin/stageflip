# `@stageflip/pack-wedding-events` — Development Signing Keys

## Status (T-526)

This directory will hold the Ed25519 keypair the
`scripts/build-pack.ts` build script uses to sign the pack archive
during local dev + CI roundtrip:

- `wedding-events-dev.public.pem` — public key (committed for reproducibility).
- `wedding-events-dev.private.pem` — private key (committed for reproducibility).

**Both files are intentionally NOT present in this commit.** T-526
ships the package skeleton only; the orchestrator generates the
dev keypair and commits it in a follow-up step, then runs

```sh
pnpm --filter @stageflip/pack-wedding-events build:pack
```

to materialize `archive.sfpack` + `signature.bin` + the final
`manifest.json` at `packs/stageflip/wedding-events/0.1.0/`. The
`check-pack-integrity` gate validates the resulting artefacts.

## DEV-ONLY policy

The keypair landed in this directory is **DEVELOPMENT-ONLY**:

- Used only for local CI roundtrip + `pnpm --filter
  @stageflip/pack-wedding-events test`.
- NEVER used to sign packs distributed to production tenants.
- ROTATED at marketplace launch (T-543), at which point the real
  publisher keypair is generated in a hardware-backed enclave per
  ADR-013 §D5 and this directory is replaced (or wiped) accordingly.

The compromise risk is acceptable for a dev keypair because:

1. The pack itself is a skeleton until T-530 — its production payload
   is not the dev archive.
2. The loader gate (`@stageflip/pack-loader` `load-pack.ts` gate 4)
   pins the trusted-publisher public key list per tenant; the dev key
   has no entry in any production tenant config.
3. T-499 forward-compat keeps the `check-pack-integrity` gate dormant
   so a leaked dev signature is functionally inert.

## Generating the keypair (orchestrator runbook)

```sh
# from packages/pack-wedding-events/keys/
pnpm --filter @stageflip/pack-signing run-cli generate-keys --out .
mv stageflip-pack.private.pem wedding-events-dev.private.pem
mv stageflip-pack.public.pem wedding-events-dev.public.pem
```

…or equivalently, via Node's `crypto.generateKeyPairSync('ed25519')`.
