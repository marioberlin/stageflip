// packages/import-hyperframes-html/src/exportHyperframes.ts
// Reverse direction: canonical Document (video mode) -> Hyperframes-style
// HTML. Output is deterministic per T-247 spec §7 / AC #30: stable attribute
// order, canonical 4-space indent, LF line endings, no per-call timestamps.
//
// The export reuses the producer's structural conventions:
//   - <div id="master-root" data-composition-id="master" ...> at the top.
//   - One composition div per Track, with data-* attrs.
//   - Elements emitted as <img> / <video> / <audio> / <div> with inline
//     `style="left:..; top:..; width:..; height:.."`.
//   - Captions inline a <script> block matching the inbound shape.
//   - Animations are NOT emitted (dropped on import).

import type {
  AspectRatio,
  CaptionTrack,
  Document,
  GroupElement,
  Element as SchemaElement,
  Track,
  VideoContent,
} from '@stageflip/schema';
import { emitTranscriptScript } from './captions/emit.js';
import type {
  ExportHyperframesOptions,
  ExportHyperframesResult,
  LossFlag,
  ParsedAssetRef,
} from './types.js';

const INDENT_UNIT = '  ';

/** Aspect-ratio shape -> [width, height] in px. */
function aspectRatioToDimensions(ar: AspectRatio): { w: number; h: number } {
  if (typeof ar === 'string') {
    switch (ar) {
      case '16:9':
        return { w: 1920, h: 1080 };
      case '9:16':
        return { w: 1080, h: 1920 };
      case '1:1':
        return { w: 1080, h: 1080 };
      case '4:5':
        return { w: 1080, h: 1350 };
      case '21:9':
        return { w: 2520, h: 1080 };
      default:
        return { w: 1920, h: 1080 };
    }
  }
  return { w: ar.w, h: ar.h };
}

/** Escape the small set of characters that matter inside double-quoted attrs. */
function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Escape `<`, `&` for text-node content. */
function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Build an inline style string from a transform record. */
function transformToStyle(t: SchemaElement['transform']): string {
  const parts: string[] = [];
  parts.push('position: absolute');
  parts.push(`left: ${t.x}px`);
  parts.push(`top: ${t.y}px`);
  parts.push(`width: ${t.width}px`);
  parts.push(`height: ${t.height}px`);
  if (t.rotation !== 0) parts.push(`transform: rotate(${t.rotation}deg)`);
  if (t.opacity !== 1) parts.push(`opacity: ${t.opacity}`);
  return parts.join('; ');
}

function indentBlock(block: string, depth: number): string {
  if (block.length === 0) return '';
  const pad = INDENT_UNIT.repeat(depth);
  return block
    .split('\n')
    .map((line) => (line.length === 0 ? '' : pad + line))
    .join('\n');
}

/** Resolve a parser-side ParsedAssetRef back to an asset string. */
function refToString(ref: string | ParsedAssetRef): string {
  if (typeof ref === 'string') return ref;
  if (ref.kind === 'unresolved') return ref.oocxmlPath;
  return ref.ref;
}

function classAttr(el: SchemaElement): string {
  if (el.name === undefined || el.name.trim().length === 0) return '';
  return ` class="${escapeAttr(el.name.trim())}"`;
}

function emitElement(el: SchemaElement, depth: number): string {
  const style = transformToStyle(el.transform);
  const cls = classAttr(el);
  switch (el.type) {
    case 'image': {
      // ParsedImageElement / ImageElement both end up here; we reach into
      // `src` as either a string or a ParsedAssetRef.
      const src = refToString(el.src as unknown as string | ParsedAssetRef);
      const alt = el.alt !== undefined ? ` alt="${escapeAttr(el.alt)}"` : '';
      return `${INDENT_UNIT.repeat(depth)}<img src="${escapeAttr(src)}"${alt}${cls} style="${escapeAttr(
        style,
      )}" data-element-id="${escapeAttr(el.id)}" />`;
    }
    case 'video': {
      const src = refToString(el.src as unknown as string | ParsedAssetRef);
      return `${INDENT_UNIT.repeat(depth)}<video src="${escapeAttr(src)}"${cls} style="${escapeAttr(
        style,
      )}" data-element-id="${escapeAttr(el.id)}"></video>`;
    }
    case 'audio': {
      const src = refToString(el.src as unknown as string | ParsedAssetRef);
      return `${INDENT_UNIT.repeat(depth)}<audio src="${escapeAttr(src)}"${cls} style="${escapeAttr(
        style,
      )}" data-element-id="${escapeAttr(el.id)}"></audio>`;
    }
    case 'text': {
      return `${INDENT_UNIT.repeat(depth)}<div${cls} style="${escapeAttr(
        style,
      )}" data-element-id="${escapeAttr(el.id)}">${escapeText(el.text)}</div>`;
    }
    case 'group': {
      const group = el as GroupElement;
      const childLines = group.children.map((c) => emitElement(c, depth + 1)).join('\n');
      const open = `${INDENT_UNIT.repeat(depth)}<div${cls} style="${escapeAttr(
        style,
      )}" data-element-id="${escapeAttr(group.id)}" data-group="1">`;
      const close = `${INDENT_UNIT.repeat(depth)}</div>`;
      if (childLines.length === 0) {
        return `${open}\n${close}`;
      }
      return `${open}\n${childLines}\n${close}`;
    }
    case 'shape': {
      // Shape -> minimal SVG wrapper. Emission is best-effort; reverse-import
      // recovers a custom-path shape via the inner text.
      return `${INDENT_UNIT.repeat(depth)}<svg${cls} style="${escapeAttr(
        style,
      )}" data-element-id="${escapeAttr(el.id)}">${escapeText(el.path ?? '')}</svg>`;
    }
    default: {
      // Fallback: render a styled <div> placeholder so the layout slot persists.
      return `${INDENT_UNIT.repeat(depth)}<div${cls} style="${escapeAttr(
        style,
      )}" data-element-id="${escapeAttr(el.id)}" data-stub-type="${escapeAttr(
        (el as { type: string }).type,
      )}"></div>`;
    }
  }
}

/** Build a composition body's inner HTML. */
function emitCompositionBody(
  track: Track,
  compositionId: string,
  width: number,
  height: number,
  durationSec: number,
): string {
  const headerAttrs = `data-composition-id="${escapeAttr(
    compositionId,
  )}" data-width="${width}" data-height="${height}" data-duration="${durationSec}"`;
  const elementLines = track.elements.map((e) => emitElement(e, 2)).join('\n');
  const inner = elementLines.length === 0 ? '' : `\n${elementLines}\n${INDENT_UNIT}`;
  return `${INDENT_UNIT}<div ${headerAttrs}>${inner}</div>`;
}

/** Build a composition file's HTML wrapped in a <template>. */
function emitCompositionFile(
  track: Track,
  compositionId: string,
  width: number,
  height: number,
  durationSec: number,
): string {
  const body = emitCompositionBody(track, compositionId, width, height, durationSec);
  return [`<template id="${escapeAttr(compositionId)}-template">`, body, '</template>', ''].join(
    '\n',
  );
}

/** Build the master HTML page. */
function emitMasterHtml(args: {
  width: number;
  height: number;
  durationSec: number;
  tracks: { compositionId: string; src: string; trackIndex: number }[];
  inlinedCompositions: Record<string, string>;
  captions?: CaptionTrack;
}): string {
  const { width, height, durationSec, tracks, inlinedCompositions, captions } = args;
  const lines: string[] = [];
  lines.push('<!doctype html>');
  lines.push('<html lang="en">');
  lines.push('  <head>');
  lines.push('    <meta charset="UTF-8" />');
  lines.push('    <title>StageFlip Hyperframes Export</title>');
  lines.push('  </head>');
  lines.push('  <body>');
  lines.push(
    `    <div id="master-root" data-composition-id="master" data-width="${width}" data-height="${height}" data-duration="${durationSec}">`,
  );
  for (const t of tracks) {
    if (t.src.length > 0) {
      lines.push(
        `      <div data-composition-id="${escapeAttr(
          t.compositionId,
        )}" data-composition-src="${escapeAttr(t.src)}" data-start="0" data-duration="${durationSec}" data-track-index="${t.trackIndex}"></div>`,
      );
    } else {
      // Inlined: emit the body directly inside the master.
      lines.push(
        `      <div data-composition-id="${escapeAttr(
          t.compositionId,
        )}" data-start="0" data-duration="${durationSec}" data-track-index="${t.trackIndex}">`,
      );
      const inlined = inlinedCompositions[t.compositionId];
      if (inlined !== undefined) {
        lines.push(indentBlock(inlined, 4));
      }
      lines.push('      </div>');
    }
  }
  lines.push('    </div>');
  if (captions !== undefined) {
    lines.push('    <script>');
    lines.push(indentBlock(emitTranscriptScript(captions), 3));
    lines.push('    </script>');
  }
  lines.push('  </body>');
  lines.push('</html>');
  lines.push('');
  return lines.join('\n');
}

/**
 * Public export entry point. Pure: no Date / no Math.random / no setTimeout.
 * Output is byte-deterministic (AC #30).
 */
export async function exportHyperframes(
  doc: Document,
  opts?: ExportHyperframesOptions,
): Promise<ExportHyperframesResult> {
  const flags: LossFlag[] = [];
  const outputMode = opts?.outputMode ?? 'multi-file';
  if (doc.content.mode !== 'video') {
    throw new Error('exportHyperframes: only video-mode Documents are supported');
  }
  const video = doc.content as VideoContent;
  const { w: width, h: height } = aspectRatioToDimensions(video.aspectRatio);
  const durationSec = video.durationMs / 1000;

  const compositions: Record<string, string> = {};
  const inlinedBlocks: Record<string, string> = {};
  const trackHeaders: { compositionId: string; src: string; trackIndex: number }[] = [];

  for (let i = 0; i < video.tracks.length; i += 1) {
    const track = video.tracks[i];
    if (track === undefined) continue;
    const compositionId = trackKindToCompositionId(track, i);
    const relPath = `compositions/${compositionId}.html`;
    if (outputMode === 'multi-file') {
      compositions[relPath] = emitCompositionFile(track, compositionId, width, height, durationSec);
      trackHeaders.push({ compositionId, src: relPath, trackIndex: i });
    } else {
      // Inlined: keep the composition body inline in the master under a
      // <template> block.
      inlinedBlocks[compositionId] = emitCompositionFile(
        track,
        compositionId,
        width,
        height,
        durationSec,
      );
      trackHeaders.push({ compositionId, src: '', trackIndex: i });
    }
  }

  const masterHtml = emitMasterHtml({
    width,
    height,
    durationSec,
    tracks: trackHeaders,
    inlinedCompositions: inlinedBlocks,
    ...(video.captions !== undefined ? { captions: video.captions } : {}),
  });

  return { masterHtml, compositions, lossFlags: flags };
}

/**
 * Stable composition-id derivation. Uses the track's kind as the base and
 * disambiguates duplicates by suffixing the index. Must be deterministic so
 * round-trip parses produce stable composition file names.
 */
function trackKindToCompositionId(track: Track, index: number): string {
  switch (track.kind) {
    case 'visual':
      return index === 0 ? 'main-orchestration' : `main-${index}`;
    case 'caption':
      return index === 0 ? 'captions' : `captions-${index}`;
    case 'audio':
      return `audio-${index}`;
    case 'overlay':
      return `graphics-${index}`;
    default:
      return `track-${index}`;
  }
}
