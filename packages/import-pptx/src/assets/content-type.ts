// packages/import-pptx/src/assets/content-type.ts
// Map an OOXML asset path to a MIME type. Coverage is deliberately narrow —
// the importer only uploads what the parser surfaces (image variants from
// T-243; videos from T-243b; fonts arrive with T-243c). Anything outside the
// table falls back to `application/octet-stream` so storage adapters can
// still write the bytes.
//
// Video MIME entries pin the IANA media-type registry values:
//   https://www.iana.org/assignments/media-types/media-types.xhtml#video

const EXTENSION_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  // T-243b — embedded video MIME map.
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
};

/**
 * Infer a MIME type from a file path's extension. Case-insensitive on the
 * extension. Unknown extensions return `application/octet-stream` so callers
 * can still upload the bytes.
 */
export function inferContentType(path: string): string {
  const dot = path.lastIndexOf('.');
  if (dot === -1 || dot === path.length - 1) return 'application/octet-stream';
  const ext = path.slice(dot + 1).toLowerCase();
  return EXTENSION_TYPES[ext] ?? 'application/octet-stream';
}
