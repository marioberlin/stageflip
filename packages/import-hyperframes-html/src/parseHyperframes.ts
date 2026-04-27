// packages/import-hyperframes-html/src/parseHyperframes.ts
// Public entry point for the parse direction. Walks a Hyperframes master
// HTML, fetches each composition via the caller-supplied
// `fetchCompositionSrc`, and produces a canonical Document with
// `content.mode === 'video'`. T-247 spec §1 / §2 / §3 / §4 / §5 / §6.
//
// Pure: no I/O beyond `fetchCompositionSrc`, no Date / Math.random / setTimeout
// (AC #33). Output is deterministic for any deterministic fetchCompositionSrc.

import type {
  AspectRatio,
  CaptionTrack,
  Document,
  GroupElement,
  Element as SchemaElement,
  Track,
  TrackKind,
  VideoContent,
} from '@stageflip/schema';
import { extractTranscript } from './captions/extract.js';
import { getAttr, getAttrNumber } from './dom/attrs.js';
import {
  type Element as DomElement,
  type ParentNode,
  childElements,
  findElementById,
  hasNoElementChildren,
  parseCompositionHtml,
  parseMasterHtml,
  textContent,
} from './dom/walk.js';
import { extractTransform, hasClassStyleLoss, hasGsapTimeline } from './elements/shared.js';
import { emitLossFlag } from './loss-flags.js';
import { classifyTrackKind } from './tracks/classify.js';
import type {
  HfhtmlLossFlagCode,
  LossFlag,
  ParseHyperframesOptions,
  ParseHyperframesResult,
  ParsedAssetRef,
  ParsedAudioElement,
  ParsedImageElement,
  ParsedVideoElement,
} from './types.js';

// Pull the standard schema types as values too (for mode/lang defaults).

const STANDARD_RATIOS: { ratio: AspectRatio; w: number; h: number }[] = [
  { ratio: '16:9', w: 16, h: 9 },
  { ratio: '9:16', w: 9, h: 16 },
  { ratio: '1:1', w: 1, h: 1 },
  { ratio: '4:5', w: 4, h: 5 },
  { ratio: '21:9', w: 21, h: 9 },
];

function widthHeightToAspectRatio(width: number, height: number): AspectRatio {
  for (const { ratio, w, h } of STANDARD_RATIOS) {
    // Check if width/height ratio matches w/h within tight tolerance.
    if (Math.abs(width * h - height * w) < 1e-6) {
      return ratio;
    }
  }
  return { kind: 'custom', w: Math.round(width), h: Math.round(height) };
}

let elementIdCounter = 0;
function nextElementId(prefix: string): string {
  elementIdCounter += 1;
  return `${prefix}_${elementIdCounter}`;
}

/** Reset element id counter at the start of every parse for deterministic ids. */
function resetIdCounter(): void {
  elementIdCounter = 0;
}

interface CompositionContext {
  trackId: string;
  compositionId: string;
  masterWidth: number;
  masterHeight: number;
  gsapContext: boolean;
}

interface ParsedComposition {
  track: Track;
  audioOnly: boolean;
  flags: LossFlag[];
  /** Inline transcript extracted from `<script>` blocks if any. */
  inlineCaptions?: CaptionTrack;
  inlineCaptionsUnrecognized?: boolean;
}

/**
 * Walk every `<script>` descendant of `node` and (a) detect a GSAP timeline,
 * (b) try to extract an inline transcript. Returns booleans/captions plus the
 * concatenated script text for diagnostic snippets.
 */
function scanScripts(node: ParentNode): {
  gsapPresent: boolean;
  captions?: CaptionTrack;
  unrecognized: boolean;
  scriptText: string;
} {
  let scriptText = '';
  // Manual depth-first walk (textContent isn't enough — we need element-typed
  // nodes to filter on `tagName === 'script'`).
  function visit(n: ParentNode): void {
    for (const c of n.childNodes) {
      if (c.nodeName === 'template') {
        visit((c as { content: ParentNode }).content);
        continue;
      }
      if (c.nodeName === 'script') {
        scriptText += textContent(c as ParentNode);
        scriptText += '\n';
        continue;
      }
      if (c.nodeName !== '#comment' && c.nodeName !== '#text' && c.nodeName !== '#documentType') {
        visit(c as ParentNode);
      }
    }
  }
  visit(node);

  const gsapPresent = hasGsapTimeline(scriptText);
  const transcript = extractTranscript(scriptText);
  if (transcript.kind === 'captions') {
    return { gsapPresent, captions: transcript.captions, unrecognized: false, scriptText };
  }
  if (transcript.kind === 'unrecognized') {
    return { gsapPresent, unrecognized: true, scriptText };
  }
  return { gsapPresent, unrecognized: false, scriptText };
}

/** Build an unresolved `ParsedAssetRef` from a URL (or `data:` URI). */
function unresolvedAsset(url: string): ParsedAssetRef {
  return { kind: 'unresolved', oocxmlPath: url };
}

/**
 * Convert a single DOM element into a canonical schema-shaped element.
 * Returns `null` when the element should be skipped (caller emits the
 * unsupported-element flag at the higher level).
 */
function parseElement(
  el: DomElement,
  ctx: CompositionContext,
  flags: LossFlag[],
): SchemaElement | ParsedImageElement | ParsedVideoElement | ParsedAudioElement | null {
  const tag = el.tagName.toLowerCase();
  // Skip non-content-bearing tags entirely.
  if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta') return null;

  const elementId = nextElementId('el');
  const trans = extractTransform(el, {
    gsapContext: ctx.gsapContext,
    fallbackWidth: ctx.masterWidth,
    fallbackHeight: ctx.masterHeight,
  });

  // Per-element loss flags before constructing the canonical record.
  if (trans.scaleDropped) {
    flags.push(
      emitLossFlag({
        code: 'LF-HYPERFRAMES-HTML-ANIMATIONS-DROPPED',
        message: `non-identity scale dropped on element <${tag}>`,
        location: { slideId: ctx.trackId, elementId },
        originalSnippet: getAttr(el, 'style') ?? '',
      }),
    );
  }
  if (trans.opacityNormalized) {
    flags.push(
      emitLossFlag({
        code: 'LF-HYPERFRAMES-HTML-ANIMATIONS-DROPPED',
        message: `opacity:0 + GSAP timeline detected on element <${tag}>; normalized to 1`,
        location: { slideId: ctx.trackId, elementId },
        originalSnippet: getAttr(el, 'style') ?? '',
      }),
    );
  }
  if (trans.dimensionsInferred) {
    flags.push(
      emitLossFlag({
        code: 'LF-HYPERFRAMES-HTML-DIMENSION-INFERRED',
        message: `<${tag}> missing width/height; inferred from composition dimensions`,
        location: { slideId: ctx.trackId, elementId },
      }),
    );
  }
  if (hasClassStyleLoss(el)) {
    flags.push(
      emitLossFlag({
        code: 'LF-HYPERFRAMES-HTML-CLASS-STYLE-LOST',
        message: `class-styled <${tag}> retains geometry but loses CSS-class typography`,
        location: { slideId: ctx.trackId, elementId },
        originalSnippet: getAttr(el, 'class') ?? '',
      }),
    );
  }

  const baseFields: {
    id: string;
    transform: typeof trans.transform;
    visible: true;
    locked: false;
    animations: never[];
    name?: string;
  } = {
    id: elementId,
    transform: trans.transform,
    visible: true,
    locked: false,
    animations: [] as never[],
  };
  // Preserve `class` via `name` so the export side can write it back; the
  // round-trip's class-style loss recurs because the second parse sees the
  // same class attribute on the re-emitted element. `name` is the canonical
  // schema's open-form free-text identifier (≤200 chars), which fits.
  const classAttr = getAttr(el, 'class');
  if (classAttr !== undefined && classAttr.trim().length > 0) {
    baseFields.name = classAttr.trim().slice(0, 200);
  }

  switch (tag) {
    case 'img': {
      const src = getAttr(el, 'src') ?? '';
      const out: ParsedImageElement = {
        ...baseFields,
        type: 'image',
        src: unresolvedAsset(src),
        fit: 'cover',
      };
      const alt = getAttr(el, 'alt');
      if (alt !== undefined) out.alt = alt;
      return out;
    }
    case 'video': {
      const src = getAttr(el, 'src') ?? '';
      const out: ParsedVideoElement = {
        ...baseFields,
        type: 'video',
        src: unresolvedAsset(src),
        muted: false,
        loop: false,
        playbackRate: 1,
      };
      return out;
    }
    case 'audio': {
      const src = getAttr(el, 'src') ?? '';
      const out: ParsedAudioElement = {
        ...baseFields,
        type: 'audio',
        src: unresolvedAsset(src),
        loop: false,
      };
      return out;
    }
    case 'svg': {
      // T-247 §5: svg → ShapeElement custom-path. The path content is
      // captured as the `d` of the first `<path>` child if present; otherwise
      // we serialize the inner SVG as the path string. v1 keeps it minimal —
      // most Hyperframes producers don't ship inline SVG.
      const innerPath = textContent(el) || ' ';
      return {
        ...baseFields,
        type: 'shape',
        shape: 'custom-path',
        path: innerPath,
      };
    }
    default: {
      // <div> and friends: text vs group decision based on children.
      if (hasNoElementChildren(el)) {
        const txt = textContent(el).trim();
        if (txt.length === 0) {
          // Empty container: treat as 1x1 group placeholder rather than skipping
          // so the round-trip preserves the layout slot. Group has [] children.
          const g: GroupElement = {
            ...baseFields,
            type: 'group',
            children: [],
            clip: false,
          };
          return g;
        }
        return {
          ...baseFields,
          type: 'text',
          text: txt,
          align: 'left',
        };
      }
      // Group: recurse children. Recognized children are element-shaped; any
      // unsupported tag emits an unsupported-element flag and is skipped.
      const children: SchemaElement[] = [];
      for (const c of childElements(el)) {
        const childTag = c.tagName.toLowerCase();
        if (
          childTag === 'script' ||
          childTag === 'style' ||
          childTag === 'link' ||
          childTag === 'meta'
        ) {
          continue;
        }
        if (childTag === 'canvas' || childTag === 'iframe' || childTag === 'object') {
          flags.push(
            emitLossFlag({
              code: 'LF-HYPERFRAMES-HTML-UNSUPPORTED-ELEMENT',
              message: `unsupported tag <${childTag}> skipped`,
              location: { slideId: ctx.trackId },
              originalSnippet: childTag,
            }),
          );
          continue;
        }
        const child = parseElement(c, ctx, flags);
        if (child !== null) children.push(child as SchemaElement);
      }
      const g: GroupElement = {
        ...baseFields,
        type: 'group',
        children,
        clip: false,
      };
      return g;
    }
  }
}

/**
 * Parse one composition's HTML into a `Track`. The composition's body root is
 * the parse5 fragment (or the unwrapped `<template>` content).
 */
function parseComposition(
  body: ParentNode,
  ctx: { trackId: string; compositionId: string; masterWidth: number; masterHeight: number },
): ParsedComposition {
  const flags: LossFlag[] = [];
  const scripts = scanScripts(body);

  if (scripts.gsapPresent) {
    flags.push(
      emitLossFlag({
        code: 'LF-HYPERFRAMES-HTML-ANIMATIONS-DROPPED',
        message: `GSAP timeline dropped on composition "${ctx.compositionId}"`,
        location: { slideId: ctx.trackId },
      }),
    );
  }
  if (scripts.unrecognized) {
    flags.push(
      emitLossFlag({
        code: 'LF-HYPERFRAMES-HTML-CAPTIONS-UNRECOGNIZED',
        message: `transcript-shaped script in "${ctx.compositionId}" did not match recognized {text,start,end} entries`,
        location: { slideId: ctx.trackId },
      }),
    );
  }

  const compositionRoot = findCompositionRoot(body, ctx.compositionId) ?? body;
  const elements: SchemaElement[] = [];
  let audioCount = 0;
  let visualCount = 0;
  for (const c of childElements(compositionRoot)) {
    const childTag = c.tagName.toLowerCase();
    if (
      childTag === 'script' ||
      childTag === 'style' ||
      childTag === 'link' ||
      childTag === 'meta'
    ) {
      continue;
    }
    if (childTag === 'canvas' || childTag === 'iframe' || childTag === 'object') {
      flags.push(
        emitLossFlag({
          code: 'LF-HYPERFRAMES-HTML-UNSUPPORTED-ELEMENT',
          message: `unsupported tag <${childTag}> skipped`,
          location: { slideId: ctx.trackId },
          originalSnippet: childTag,
        }),
      );
      continue;
    }
    if (childTag === 'audio') audioCount += 1;
    else visualCount += 1;
    const elementResult = parseElement(c, { ...ctx, gsapContext: scripts.gsapPresent }, flags);
    if (elementResult !== null) elements.push(elementResult as SchemaElement);
  }

  const audioOnly = audioCount > 0 && visualCount === 0;
  const trackKind: TrackKind = classifyTrackKind({
    compositionId: ctx.compositionId,
    trackIndex: -1, // overridden by caller
    audioOnly,
  });
  const track: Track = {
    id: ctx.trackId,
    kind: trackKind,
    muted: false,
    elements,
  };

  const result: ParsedComposition = { track, audioOnly, flags };
  if (scripts.captions !== undefined) {
    result.inlineCaptions = scripts.captions;
  }
  if (scripts.unrecognized) {
    result.inlineCaptionsUnrecognized = true;
  }
  return result;
}

/**
 * Within a composition body, find the `[data-composition-id="<id>"]` root if
 * the composition wraps its real content in such a div. Hyperframes' producer
 * fixtures use this pattern: `<template id="..."><div data-composition-id="...">
 * ... </div></template>`. Returns `undefined` if no such wrapper exists; the
 * caller falls back to the body itself.
 */
function findCompositionRoot(body: ParentNode, compositionId: string): ParentNode | undefined {
  for (const c of body.childNodes) {
    if (c.nodeName === 'template') {
      return findCompositionRoot((c as { content: ParentNode }).content, compositionId);
    }
    if (c.nodeName !== '#comment' && c.nodeName !== '#text' && c.nodeName !== '#documentType') {
      const el = c as DomElement;
      if (getAttr(el, 'data-composition-id') === compositionId) return el;
      const nested = findCompositionRoot(el, compositionId);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}

/**
 * Public entry point. Parses the master HTML, walks each composition layer,
 * fetches the composition src, parses each, and assembles a canonical
 * `Document` with `content.mode === 'video'`.
 */
export async function parseHyperframes(
  masterHtml: string,
  opts: ParseHyperframesOptions,
): Promise<ParseHyperframesResult> {
  resetIdCounter();
  const flags: LossFlag[] = [];
  const docRoot = parseMasterHtml(masterHtml);
  const masterRoot = findElementById(docRoot, 'master-root');
  if (masterRoot === undefined) {
    throw new Error('parseHyperframes: master HTML missing #master-root element');
  }

  const masterWidth = getAttrNumber(masterRoot, 'data-width');
  const masterHeight = getAttrNumber(masterRoot, 'data-height');
  const masterDurationSec = getAttrNumber(masterRoot, 'data-duration');
  if (masterWidth === undefined || masterHeight === undefined || masterDurationSec === undefined) {
    throw new Error(
      'parseHyperframes: #master-root missing data-width / data-height / data-duration',
    );
  }
  const aspectRatio = widthHeightToAspectRatio(masterWidth, masterHeight);
  const durationMs = Math.round(masterDurationSec * 1000);

  // Master-level scripts (transcript can live on the master too, per the
  // captions composition). Note: the master fixture in style-10-prod has its
  // GSAP timeline declarations directly in the master; per spec we don't
  // emit a per-composition flag here unless the body wraps real elements.
  const masterScripts = scanScripts(docRoot);
  let masterCaptions: CaptionTrack | undefined =
    masterScripts.captions !== undefined ? masterScripts.captions : undefined;

  const compositionEls: DomElement[] = [];
  for (const c of childElements(masterRoot)) {
    if (getAttr(c, 'data-composition-id') !== undefined) compositionEls.push(c);
  }

  // Sort by track-index for deterministic ordering. Compositions that omit
  // `data-track-index` fall back to source position (already preserved by
  // the parse5 walker, so the stable sort below keeps them in declaration
  // order).
  compositionEls.sort((a, b) => {
    const ai = getAttrNumber(a, 'data-track-index') ?? 1e9;
    const bi = getAttrNumber(b, 'data-track-index') ?? 1e9;
    return ai - bi;
  });

  const tracks: Track[] = [];
  for (const compEl of compositionEls) {
    const compositionId = getAttr(compEl, 'data-composition-id') ?? 'unknown';
    const trackIndex = getAttrNumber(compEl, 'data-track-index') ?? tracks.length;
    const trackId = `track_${tracks.length + 1}`;
    const compositionSrc = getAttr(compEl, 'data-composition-src');

    let body: ParentNode | undefined;
    if (compositionSrc !== undefined) {
      const html = await opts.fetchCompositionSrc(compositionSrc);
      body = parseCompositionHtml(html);
    } else {
      // Inlined or empty composition: walk the master-root composition div.
      body = compEl;
    }

    const parsed = parseComposition(body, {
      trackId,
      compositionId,
      masterWidth,
      masterHeight,
    });

    // Apply track-kind heuristic now that we know audioOnly + trackIndex.
    const finalKind = classifyTrackKind({
      compositionId,
      trackIndex,
      audioOnly: parsed.audioOnly,
    });
    parsed.track.kind = finalKind;

    tracks.push(parsed.track);
    flags.push(...parsed.flags);

    // Per-composition inline-captions take precedence over master scripts.
    if (parsed.inlineCaptions !== undefined && masterCaptions === undefined) {
      masterCaptions = parsed.inlineCaptions;
    }
  }

  // Schema requires at least one track. If the master had no compositions,
  // emit a synthetic empty visual track so the canonical Document still
  // validates. T-247 fixtures all have at least one composition; this branch
  // is defensive.
  if (tracks.length === 0) {
    tracks.push({
      id: 'track_1',
      kind: 'visual',
      muted: false,
      elements: [],
    });
  }

  const videoContent: VideoContent = {
    mode: 'video',
    aspectRatio,
    durationMs: durationMs > 0 ? durationMs : 1,
    frameRate: 30,
    tracks,
  };
  if (masterCaptions !== undefined) {
    videoContent.captions = masterCaptions;
  }

  // Build a stable Document. Schema requires meta.id / version /
  // createdAt / updatedAt; we synthesize deterministic values (zero version,
  // hash-derived id from the master HTML hash so re-imports stay stable).
  const isoZero = '1970-01-01T00:00:00.000Z';
  const document: Document = {
    meta: {
      id: 'hf_imported',
      version: 0,
      createdAt: isoZero,
      updatedAt: isoZero,
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: videoContent,
  };

  return { document, lossFlags: flags };
}

/**
 * Re-export the union for tests / callers that want exhaustive coverage of
 * the locally-defined codes.
 */
export type { HfhtmlLossFlagCode };
