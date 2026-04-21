// packages/renderer-cdp/src/asset-refs.ts
// Pure traversal of an RIRDocument to collect every URL-bearing content
// reference (images, videos, audio, embeds) and, given a resolution map,
// to produce a rewritten document whose URLs point at local file:// paths.
//
// No IO here. The actual fetch-and-cache step lives in asset-resolver.ts,
// which consumes these refs and produces the map that this module's
// rewriter applies.

import type { RIRDocument, RIRElement, RIRElementContent } from '@stageflip/rir';

/** Category of asset we know how to resolve. Font fetching lives elsewhere. */
export type AssetKind = 'image' | 'video' | 'audio' | 'embed';

export interface AssetRef {
  readonly kind: AssetKind;
  readonly url: string;
  /** First element id that referenced this URL (order of tree traversal). */
  readonly firstSeenElementId: string;
  /** Every element that referenced this URL — includes `firstSeenElementId`. */
  readonly referencedBy: readonly string[];
}

/**
 * Walk every element in the document (recursing into groups) and return a
 * deduplicated list of asset refs, one per unique URL, annotated with which
 * elements referenced each URL. Tree order preserved; non-URL-bearing
 * content (text, shape, chart, table, code, clip params, group itself) is
 * skipped.
 */
export function collectAssetRefs(document: RIRDocument): readonly AssetRef[] {
  const order: string[] = []; // URLs in first-seen order
  const refs = new Map<
    string,
    { kind: AssetKind; firstSeenElementId: string; referencedBy: string[] }
  >();

  for (const element of walk(document.elements)) {
    const hit = extractUrlFromContent(element.content);
    if (hit === null) continue;

    const existing = refs.get(hit.url);
    if (existing === undefined) {
      order.push(hit.url);
      refs.set(hit.url, {
        kind: hit.kind,
        firstSeenElementId: element.id,
        referencedBy: [element.id],
      });
    } else {
      existing.referencedBy.push(element.id);
    }
  }

  return order.map((url): AssetRef => {
    const v = refs.get(url);
    // safe: v was just set above during the same traversal
    if (v === undefined) throw new Error('asset-refs: internal invariant violated');
    return {
      kind: v.kind,
      url,
      firstSeenElementId: v.firstSeenElementId,
      referencedBy: v.referencedBy.slice(),
    };
  });
}

/**
 * Produce a new RIRDocument with every URL-bearing content field rewritten
 * per `resolutionMap` (keyed by original URL, valued by replacement URL —
 * typically a `file://` path produced by the asset resolver). URLs not
 * present in the map are left untouched.
 */
export function rewriteDocumentAssets(
  document: RIRDocument,
  resolutionMap: Readonly<Record<string, string>>,
): RIRDocument {
  return {
    ...document,
    elements: document.elements.map((el) => rewriteElement(el, resolutionMap)),
  };
}

// ----- internals ------------------------------------------------------------

function* walk(elements: readonly RIRElement[]): Generator<RIRElement> {
  for (const el of elements) {
    yield el;
    if (el.content.type === 'group') {
      yield* walk(el.content.children);
    }
  }
}

function extractUrlFromContent(
  content: RIRElementContent,
): { kind: AssetKind; url: string } | null {
  switch (content.type) {
    case 'image':
      return { kind: 'image', url: content.srcUrl };
    case 'video':
      return { kind: 'video', url: content.srcUrl };
    case 'audio':
      return { kind: 'audio', url: content.srcUrl };
    case 'embed':
      return { kind: 'embed', url: content.src };
    default:
      return null;
  }
}

function rewriteElement(element: RIRElement, map: Readonly<Record<string, string>>): RIRElement {
  const content = rewriteContent(element.content, map);
  return content === element.content ? element : { ...element, content };
}

function rewriteContent(
  content: RIRElementContent,
  map: Readonly<Record<string, string>>,
): RIRElementContent {
  switch (content.type) {
    case 'image': {
      const replaced = map[content.srcUrl];
      return replaced === undefined ? content : { ...content, srcUrl: replaced };
    }
    case 'video': {
      const replaced = map[content.srcUrl];
      return replaced === undefined ? content : { ...content, srcUrl: replaced };
    }
    case 'audio': {
      const replaced = map[content.srcUrl];
      return replaced === undefined ? content : { ...content, srcUrl: replaced };
    }
    case 'embed': {
      const replaced = map[content.src];
      return replaced === undefined ? content : { ...content, src: replaced };
    }
    case 'group':
      return {
        ...content,
        children: content.children.map((child) => rewriteElement(child, map)),
      };
    default:
      return content;
  }
}
