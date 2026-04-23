// packages/editor-shell/src/assets/index.ts
// Barrel for the editor asset registry (T-139b).

export {
  addAssetAtom,
  assetsAtom,
  removeAssetAtom,
  replaceAssetsAtom,
  selectedAssetAtom,
  selectedAssetIdAtom,
} from './assets-atom';
export type { Asset, AssetKind } from './types';
