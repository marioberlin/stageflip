// packages/pack-loader/src/semver-range.ts
// Back-compat re-export shim. `satisfiesRange` lives in
// `@stageflip/pack-format` since T-502 (compatibility matrix needs it
// too; co-locating in pack-format avoids a pack-format → pack-loader
// circular dep). Consumers can import from either package.

export { satisfiesRange } from '@stageflip/pack-format';
