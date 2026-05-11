---
'@stageflip/runtimes-interactive': patch
---

T-437 — 3D→ThreeSceneClip GLB consumer. Generated GLB assets from
whitelisted 3D adapters (Tripo, Meshy) can now mount inside
`ThreeSceneClip` via a deterministic `cacheKey` lookup against
`@stageflip/asset-cache`. New `resolveAssetGenGlb()` resolver +
`ThreeSceneClipFactoryOptions.assetGenResolver` hook merge the
resolved bytes under `setupProps.__assetGen` for the author's
`ThreeClipSetup<P>` callback to consume. Schema-agnostic — no
runtime dep on `@stageflip/schema`, `@stageflip/asset-cache`, or the
3D adapter packages. NOT a §13 structural extension; existing
ThreeSceneClip mounts unchanged when the option is absent.
