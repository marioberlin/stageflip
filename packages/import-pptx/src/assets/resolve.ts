// packages/import-pptx/src/assets/resolve.ts
// T-243 — walk the parser-side tree, upload every `ParsedAssetRef.unresolved`
// payload through the abstract `AssetStorage`, and return a new tree where
// those refs are rewritten as schema-typed `{ kind: 'resolved', ref: 'asset:<id>' }`.
// Drops `LF-PPTX-UNRESOLVED-ASSET` flags for refs we resolved; emits
// `LF-PPTX-MISSING-ASSET-BYTES` for refs whose ZIP entry is absent.
// Idempotent via `tree.assetsResolved`.

import { createHash } from 'node:crypto';
import { emitLossFlag } from '../loss-flags.js';
import type {
  CanonicalSlideTree,
  LossFlag,
  ParsedAssetRef,
  ParsedElement,
  ParsedGroupElement,
  ParsedImageElement,
  ParsedSlide,
  ParsedVideoElement,
} from '../types.js';
import type { ZipEntries } from '../zip.js';
import { inferContentType } from './content-type.js';
import type { AssetStorage } from './types.js';
import { AssetResolutionError } from './types.js';

/**
 * Walk a tree and resolve every unresolved asset ref. See file header for
 * the full contract.
 */
export async function resolveAssets(
  tree: CanonicalSlideTree,
  entries: ZipEntries,
  storage: AssetStorage,
): Promise<CanonicalSlideTree> {
  if (tree.assetsResolved === true) {
    return {
      slides: tree.slides,
      layouts: tree.layouts,
      masters: tree.masters,
      lossFlags: tree.lossFlags,
      ...(tree.transformsAccumulated === true ? { transformsAccumulated: true } : {}),
      assetsResolved: true,
    };
  }

  // Pass 1: collect every distinct unresolved oocxmlPath. The tree may
  // reference the same path many times (slides + layouts + masters); we
  // upload once per content-hash.
  const pathToRef = new Map<string, ParsedAssetRef>();
  const missingPaths = new Set<string>();
  const resolvedByPath = new Map<string, ParsedAssetRef>();

  collectPaths(tree, pathToRef);

  // Pass 2: hash + upload distinct paths. Dedup by content-hash so two
  // distinct paths that happen to share bytes still produce one upload.
  const hashToResolved = new Map<string, ParsedAssetRef>();
  for (const [path] of pathToRef) {
    const bytes = entries[path];
    if (bytes === undefined) {
      missingPaths.add(path);
      continue;
    }
    const contentHash = createHash('sha256').update(bytes).digest('hex');
    let resolved = hashToResolved.get(contentHash);
    if (resolved === undefined) {
      let putResult: { id: string };
      try {
        putResult = await storage.put(bytes, {
          contentType: inferContentType(path),
          contentHash,
        });
      } catch (err) {
        throw new AssetResolutionError('STORAGE_UPLOAD_FAILED', `storage.put failed for ${path}`, {
          cause: err,
        });
      }
      resolved = { kind: 'resolved', ref: `asset:${putResult.id}` };
      hashToResolved.set(contentHash, resolved);
    }
    resolvedByPath.set(path, resolved);
  }

  // Pass 3: rewrite the tree, drop resolved unresolved-asset flags, emit
  // missing-asset-bytes flags for paths whose entries were absent.
  const newSlides = tree.slides.map((s) => rewriteSlide(s, resolvedByPath));
  const newLayouts = mapRecord(tree.layouts, (s) => rewriteSlide(s, resolvedByPath));
  const newMasters = mapRecord(tree.masters, (s) => rewriteSlide(s, resolvedByPath));

  const flagsAfterDrop = tree.lossFlags.filter((flag) => {
    if (flag.code !== 'LF-PPTX-UNRESOLVED-ASSET' && flag.code !== 'LF-PPTX-UNRESOLVED-VIDEO') {
      return true;
    }
    const path = flag.location.oocxmlPath;
    if (path === undefined) return true;
    return !resolvedByPath.has(path);
  });
  const missingFlags: LossFlag[] = [];
  for (const path of missingPaths) {
    missingFlags.push(
      emitLossFlag({
        code: 'LF-PPTX-MISSING-ASSET-BYTES',
        location: { oocxmlPath: path },
        message: `asset path "${path}" referenced by import but absent from the PPTX package`,
        originalSnippet: path,
      }),
    );
  }

  return {
    slides: newSlides,
    layouts: newLayouts,
    masters: newMasters,
    lossFlags: [...flagsAfterDrop, ...missingFlags],
    ...(tree.transformsAccumulated === true ? { transformsAccumulated: true } : {}),
    assetsResolved: true,
  };
}

/** Visit every element and record unresolved-asset paths into `out`. */
function collectPaths(tree: CanonicalSlideTree, out: Map<string, ParsedAssetRef>): void {
  const visit = (e: ParsedElement): void => {
    if (e.type === 'image') {
      const img = e as ParsedImageElement;
      if (img.src.kind === 'unresolved') out.set(img.src.oocxmlPath, img.src);
      return;
    }
    if (e.type === 'video') {
      const vid = e as ParsedVideoElement;
      if (vid.src.kind === 'unresolved') out.set(vid.src.oocxmlPath, vid.src);
      return;
    }
    if (e.type === 'group') {
      for (const c of (e as ParsedGroupElement).children) visit(c);
    }
  };
  for (const s of tree.slides) for (const e of s.elements) visit(e);
  for (const s of Object.values(tree.layouts)) for (const e of s.elements) visit(e);
  for (const s of Object.values(tree.masters)) for (const e of s.elements) visit(e);
}

function rewriteSlide(
  slide: ParsedSlide,
  resolvedByPath: Map<string, ParsedAssetRef>,
): ParsedSlide {
  return { ...slide, elements: slide.elements.map((e) => rewriteElement(e, resolvedByPath)) };
}

function rewriteElement(
  element: ParsedElement,
  resolvedByPath: Map<string, ParsedAssetRef>,
): ParsedElement {
  if (element.type === 'image') {
    const img = element as ParsedImageElement;
    if (img.src.kind !== 'unresolved') return img;
    const resolved = resolvedByPath.get(img.src.oocxmlPath);
    if (resolved === undefined) return img; // missing-asset-bytes: leave as-is
    return { ...img, src: resolved };
  }
  if (element.type === 'video') {
    const vid = element as ParsedVideoElement;
    if (vid.src.kind !== 'unresolved') return vid;
    const resolved = resolvedByPath.get(vid.src.oocxmlPath);
    if (resolved === undefined) return vid; // missing-asset-bytes: leave as-is
    return { ...vid, src: resolved };
  }
  if (element.type === 'group') {
    const grp = element as ParsedGroupElement;
    return {
      ...grp,
      children: grp.children.map((c) => rewriteElement(c, resolvedByPath)),
    };
  }
  return element;
}

function mapRecord<T>(record: Record<string, T>, fn: (v: T) => T): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(record)) out[k] = fn(v);
  return out;
}
