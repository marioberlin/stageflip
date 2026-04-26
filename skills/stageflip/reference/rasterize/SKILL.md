---
title: Reference — @stageflip/rasterize
id: skills/stageflip/reference/rasterize
tier: reference
status: substantive
last_updated: 2026-04-26
owner_task: T-245
related:
  - skills/stageflip/reference/import-google-slides
  - skills/stageflip/concepts/loss-flags
  - skills/stageflip/concepts/determinism
---

# Reference — `@stageflip/rasterize`

Pure-TS PNG-crop primitive. Takes a rendered slide page (PNG `Uint8Array`)
plus a pixel-space bounding box, crops the box (with optional padding), and
returns the cropped bytes plus a content-hashed asset id ready for
`AssetStorage.put`.

The package has **no awareness of import or export semantics** — no Slides
API knowledge, no Drawing ML knowledge, no loss flags. It just crops PNG
bytes deterministically. Consumers attach the loss-flag emission and the
`AssetStorage` upload at their layer.

## Public surface

```ts
import {
  rasterizeFromThumbnail,
  RasterizeError,
  DEFAULT_PADDING_PX,
  DEFAULT_COMPRESSION_LEVEL,
  DEFAULT_FILTER_TYPE,
} from '@stageflip/rasterize';
import type {
  BboxPx,
  RasterizeOptions,
  RasterizedAsset,
  RasterizeErrorCode,
} from '@stageflip/rasterize';
```

### `rasterizeFromThumbnail(pageImage, bboxPx, opts?) => Promise<RasterizedAsset>`

```ts
function rasterizeFromThumbnail(
  pageImage: Uint8Array,        // PNG bytes (any size)
  bboxPx: BboxPx,               // pixel-space bbox; NOT EMUs
  opts?: RasterizeOptions,      // paddingPx / compressionLevel / filterType
): Promise<RasterizedAsset>;
```

`RasterizedAsset` shape:

```ts
{
  bytes: Uint8Array;            // cropped PNG bytes
  contentType: 'image/png';     // always 'image/png' in v1
  contentHashId: string;        // sha256 hex, FULL 64 chars (NOT truncated)
  width: number;                // post-padding, post-clamp
  height: number;
}
```

### Default options (pinned for byte-determinism)

| Option | Default | Rationale |
|---|---|---|
| `paddingPx` | 16 | Recovers anti-aliased edges + small overflows the source bbox didn't include. |
| `compressionLevel` | 6 | pngjs's reasonable size/speed compromise; matches its default. |
| `filterType` | `-1` (pngjs 7 sentinel for "all filters / per-row adaptive") | Best size for general images. pngjs 7 doesn't publish a `constants.PNG_ALL_FILTERS` symbol; `-1` is the canonical sentinel (see `pngjs/lib/filter-pack.js`). |

Different option values produce different output bytes. The byte-determinism
contract is **per-(input, options)**: same input + same options → byte-identical
output.

## Algorithm

```
1. Validate bbox + options (early-throw on NaN, negative dims, etc.).
2. Decode pageImage → ImageData via pngjs.
3. Compute the padded bbox:
     padded.x = max(0, bboxPx.x - paddingPx)
     padded.y = max(0, bboxPx.y - paddingPx)
     padded.width  = min(image.width  - padded.x, bboxPx.width  + 2*paddingPx)
     padded.height = min(image.height - padded.y, bboxPx.height + 2*paddingPx)
4. If width <= 0 or height <= 0 → throw RasterizeError('BBOX_OUT_OF_BOUNDS').
5. Allocate cropped pixel buffer (padded.width × padded.height × 4 bytes).
6. Copy rows from the source's RGBA buffer.
7. Encode cropped pixel buffer → PNG bytes via pngjs (pinned options).
8. Compute sha256(bytes) hex (full 64 chars).
9. Return RasterizedAsset.
```

### Clamp behavior — visible region only

A bbox extending off the source clamps to the visible region. The cropped
output dimensions are the **visible region only** — coordinates outside the
source are NOT zero-padded. A bbox `{x:-10, y:-10, width:20, height:20}` on
a 100×100 source produces a 10×10 PNG, NOT a 20×20 PNG with transparent
borders.

## Error taxonomy

`RasterizeError extends Error` with `.code: RasterizeErrorCode`:

| Code | When |
|---|---|
| `INVALID_PNG` | Empty bytes, bad signature, or pngjs decode threw. |
| `BBOX_OUT_OF_BOUNDS` | Bbox doesn't intersect the source at all. |
| `BBOX_INVALID` | Negative width/height, NaN in any field. |
| `OPTIONS_INVALID` | `paddingPx < 0`, `compressionLevel` outside 0..9, NaN. |
| `ENCODE_FAILED` | pngjs encode threw (unexpected). |

Errors do NOT emit loss flags. Consumers translate the code into their
domain's flags:

- T-244 (Google Slides import image-fallback) → `LF-GSLIDES-IMAGE-FALLBACK`
- T-252 (Google Slides export image-fallback) → `LF-GSLIDES-EXPORT-FALLBACK`

## Determinism

Same `pageImage` + `bboxPx` + `opts` → byte-identical `bytes` and
`contentHashId` across calls. Sources of non-determinism that are pinned:

- **`compressionLevel` + `filterType`**: explicit defaults, no entropy.
- **PNG metadata**: pngjs preserves source metadata; no per-call timestamps.
- **Hash function**: `node:crypto` `createHash('sha256').update(bytes).digest('hex')`.

The package's source is held to the same source-level discipline as
CLAUDE.md §3 (no `Date.now`, `Math.random`, `performance.now`,
`setTimeout`, `setInterval`, `new Date()` without an arg) even though it
isn't formally in the determinism-restricted scope. A grep test in
`rasterize.test.ts` enforces this.

## Hash length

`contentHashId` is the **full 64-char sha256 hex**, NOT truncated. Mirrors
`packages/import-pptx/src/assets/resolve.ts`'s asset-side precedent rather
than `packages/loss-flags/src/emit.ts`'s `slice(0, 12)`.

Reasoning: asset content has a large surface (slide-image fallbacks may run
thousands per deck across years of edits), so collision resistance matters;
loss-flag IDs have a small surface and are truncated for terseness.

## Boundary

T-245 ships the primitive. **Consumers wire the AssetStorage upload + loss-flag
emission at their layer.** This separation mirrors the
`parsePptx → resolveAssets` split in `@stageflip/import-pptx`:

- `parsePptx` is a pure structural transform.
- `resolveAssets` does the I/O (storage upload).

Same shape here:

- `rasterizeFromThumbnail` is a pure pixel transform.
- The consumer (T-244 / T-252) calls `AssetStorage.put(result.bytes, { contentType, contentHash: result.contentHashId })` and translates `RasterizeError` into its own loss flags.

## Usage example (consumer pattern)

```ts
import { rasterizeFromThumbnail, RasterizeError } from '@stageflip/rasterize';

async function emitImageFallback(
  pageImage: Uint8Array,
  bboxPx: BboxPx,
  storage: AssetStorage,
): Promise<{ ref: string } | { lossFlag: LossFlag }> {
  let asset: RasterizedAsset;
  try {
    asset = await rasterizeFromThumbnail(pageImage, bboxPx);
  } catch (err) {
    if (err instanceof RasterizeError) {
      return { lossFlag: emitLossFlag({ code: 'LF-GSLIDES-IMAGE-FALLBACK', /* ... */ }) };
    }
    throw err;
  }
  const { id } = await storage.put(asset.bytes, {
    contentType: asset.contentType,
    contentHash: asset.contentHashId,
  });
  return { ref: `asset:${id}` };
}
```

## Out of scope

- `AssetStorage.put` invocation — consumers handle this.
- Loss-flag emission — consumers translate `RasterizeError` codes into their flags.
- Re-encoding to formats other than PNG (WebP / AVIF deferred).
- Resampling / scaling — the primitive crops pixel-exact slices.
- Color-profile manipulation — ICC chunks pass through pngjs unchanged.
- Animated / multi-frame source — APNG / GIF would need a different surface.
- Native-binding implementations (`sharp`, `@napi-rs/canvas`) — pure-JS via
  `pngjs` keeps the install footprint small and the license whitelist clean.
