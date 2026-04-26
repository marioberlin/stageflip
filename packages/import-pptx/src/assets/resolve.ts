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
  ParsedEmbeddedFont,
  ParsedGroupElement,
  ParsedImageElement,
  ParsedSlide,
  ParsedVideoElement,
} from '../types.js';
import type { ZipEntries } from '../zip.js';
import { inferContentType } from './content-type.js';
import type { AssetStorage } from './types.js';
import { AssetResolutionError } from './types.js';

const FACE_KEYS = ['regular', 'bold', 'italic', 'boldItalic'] as const;
type FaceKey = (typeof FACE_KEYS)[number];

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
      ...(tree.embeddedFonts !== undefined ? { embeddedFonts: tree.embeddedFonts } : {}),
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
  collectFontPaths(tree, pathToRef);

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
  const newEmbeddedFonts =
    tree.embeddedFonts !== undefined
      ? tree.embeddedFonts.map((f) => rewriteFont(f, resolvedByPath))
      : undefined;

  // Families whose every populated face is resolved → drop the family's
  // LF-PPTX-UNRESOLVED-FONT flag. Families with a broken-rel face or
  // missing bytes keep the flag so the editor can surface the gap.
  const fullyResolvedFamilies = new Set<string>();
  if (tree.embeddedFonts !== undefined) {
    for (const f of tree.embeddedFonts) {
      if (allFacesResolvable(f, resolvedByPath)) fullyResolvedFamilies.add(f.family);
    }
  }

  const flagsAfterDrop = tree.lossFlags.filter((flag) => {
    if (flag.code === 'LF-PPTX-UNRESOLVED-ASSET' || flag.code === 'LF-PPTX-UNRESOLVED-VIDEO') {
      const path = flag.location.oocxmlPath;
      if (path === undefined) return true;
      return !resolvedByPath.has(path);
    }
    if (flag.code === 'LF-PPTX-UNRESOLVED-FONT') {
      const family = flag.originalSnippet;
      if (family === undefined) return true;
      return !fullyResolvedFamilies.has(family);
    }
    return true;
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
    ...(newEmbeddedFonts !== undefined ? { embeddedFonts: newEmbeddedFonts } : {}),
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

/**
 * T-243c — collect every unresolved face path from `tree.embeddedFonts` into
 * the same `pathToRef` map the per-element walk uses. Sharing the map means
 * fonts go through the same dedup-by-content-hash + storage upload pipeline
 * as image / video bytes.
 */
function collectFontPaths(tree: CanonicalSlideTree, out: Map<string, ParsedAssetRef>): void {
  if (tree.embeddedFonts === undefined) return;
  for (const font of tree.embeddedFonts) {
    for (const key of FACE_KEYS) {
      const ref = font.faces[key];
      if (ref === undefined) continue;
      if (ref.kind === 'unresolved') out.set(ref.oocxmlPath, ref);
    }
  }
}

/** Rewrite a single font's face refs; missing bytes leave the slot untouched. */
function rewriteFont(
  font: ParsedEmbeddedFont,
  resolvedByPath: Map<string, ParsedAssetRef>,
): ParsedEmbeddedFont {
  const faces: ParsedEmbeddedFont['faces'] = {};
  for (const key of FACE_KEYS) {
    const ref = font.faces[key];
    if (ref === undefined) continue;
    if (ref.kind !== 'unresolved') {
      assignFace(faces, key, ref);
      continue;
    }
    const resolved = resolvedByPath.get(ref.oocxmlPath);
    assignFace(faces, key, resolved ?? ref);
  }
  const out: ParsedEmbeddedFont = { family: font.family, faces };
  if (font.panose !== undefined) out.panose = font.panose;
  return out;
}

function assignFace(faces: ParsedEmbeddedFont['faces'], key: FaceKey, ref: ParsedAssetRef): void {
  faces[key] = ref;
}

/**
 * Family is "fully resolvable" iff every face it ships has bytes in the
 * resolvedByPath map. Faces dropped at parse time (relId broken / external)
 * are absent from `font.faces` and don't block the resolve.
 */
function allFacesResolvable(
  font: ParsedEmbeddedFont,
  resolvedByPath: Map<string, ParsedAssetRef>,
): boolean {
  let any = false;
  for (const key of FACE_KEYS) {
    const ref = font.faces[key];
    if (ref === undefined) continue;
    any = true;
    if (ref.kind === 'resolved') continue;
    if (!resolvedByPath.has(ref.oocxmlPath)) return false;
  }
  return any;
}
