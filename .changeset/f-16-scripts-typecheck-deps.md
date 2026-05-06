---
"@stageflip/scripts": patch
---

F-16 — declare `@stageflip/scripts`'s workspace dependencies so CI's `pnpm typecheck` builds them first.

`scripts/generate-preset-parity-fixture-prod.ts` reaches `@stageflip/parity-cli/src/*.ts` via relative imports; those source files import `@stageflip/{rir,cdp-host-bundle,renderer-cdp,parity,testing}` by package name. With no workspace deps declared on `@stageflip/scripts`, turbo's `^build` ran no upstream builds before `@stageflip/scripts:typecheck`, and the un-built `dist/*.d.ts` files of those packages weren't resolvable in CI's clean checkout (`error TS2307: Cannot find module '@stageflip/rir'`). Local tsc passed only because dist outputs persisted between runs.

Adding the seven workspace deps fixes the CI gate `typecheck · lint · test · gates` failure that has shadowed every recent merge. Reproduced clean-state locally via `rm -rf packages/{rir,parity,cdp-host-bundle,renderer-cdp,parity-cli,schema}/dist .turbo` then `pnpm typecheck` → 118/118 successful.
