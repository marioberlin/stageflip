// packages/export-pptx/src/parts/doc-props.ts
// Emit `docProps/app.xml` and `docProps/core.xml` — minimal Office metadata.
// Both use the `modifiedAt` parameter so two consecutive exports are
// byte-identical when the same `modifiedAt` is provided.

import { XML_PROLOG, escapeText } from '../xml/emit.js';

/**
 * `docProps/app.xml` — extended properties. Carries the creator/application
 * name. We hard-code application = 'StageFlip'; the optional `creator` from
 * `ExportPptxOptions` lands in `core.xml` as the document author.
 */
export function emitAppProps(): string {
  const NS_EXT = 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties';
  const NS_VT = 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes';
  const body = `<Properties xmlns="${NS_EXT}" xmlns:vt="${NS_VT}">\
<Application>StageFlip</Application>\
<AppVersion>0.1.0</AppVersion>\
</Properties>`;
  return `${XML_PROLOG}${body}`;
}

/** Format a `Date` as ISO 8601 UTC with seconds (no fractional, no offset). */
function isoUtcSeconds(d: Date): string {
  return `${d.toISOString().slice(0, 19)}Z`;
}

/**
 * `docProps/core.xml` — Dublin Core metadata. Pins creator + last-modified
 * timestamp. Both `created` and `modified` are stamped from `modifiedAt`
 * so the part itself is byte-identical across calls.
 */
export function emitCoreProps(opts: { creator: string; modifiedAt: Date; title?: string }): string {
  const NS_CP = 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties';
  const NS_DC = 'http://purl.org/dc/elements/1.1/';
  const NS_DCTERMS = 'http://purl.org/dc/terms/';
  const NS_XSI = 'http://www.w3.org/2001/XMLSchema-instance';
  const ts = isoUtcSeconds(opts.modifiedAt);
  const titleNode = opts.title ? `<dc:title>${escapeText(opts.title)}</dc:title>` : '';
  const body = `<cp:coreProperties xmlns:cp="${NS_CP}" xmlns:dc="${NS_DC}" xmlns:dcterms="${NS_DCTERMS}" xmlns:xsi="${NS_XSI}">\
${titleNode}\
<dc:creator>${escapeText(opts.creator)}</dc:creator>\
<cp:lastModifiedBy>${escapeText(opts.creator)}</cp:lastModifiedBy>\
<dcterms:created xsi:type="dcterms:W3CDTF">${ts}</dcterms:created>\
<dcterms:modified xsi:type="dcterms:W3CDTF">${ts}</dcterms:modified>\
</cp:coreProperties>`;
  return `${XML_PROLOG}${body}`;
}
