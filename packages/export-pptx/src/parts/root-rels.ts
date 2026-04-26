// packages/export-pptx/src/parts/root-rels.ts
// Emit `_rels/.rels` — the package-level relationships file. Points at
// `ppt/presentation.xml` (the document root) plus the two docProps parts.

import { XML_PROLOG, emitElement, emitSelfClosing } from '../xml/emit.js';

const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const TYPE_OFFICE_DOC =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';
const TYPE_CORE_PROPS =
  'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties';
const TYPE_APP_PROPS =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties';

/** Build `_rels/.rels`. */
export function emitRootRels(): string {
  const rows = [
    emitSelfClosing('Relationship', {
      Id: 'rId1',
      Type: TYPE_OFFICE_DOC,
      Target: 'ppt/presentation.xml',
    }),
    emitSelfClosing('Relationship', {
      Id: 'rId2',
      Type: TYPE_CORE_PROPS,
      Target: 'docProps/core.xml',
    }),
    emitSelfClosing('Relationship', {
      Id: 'rId3',
      Type: TYPE_APP_PROPS,
      Target: 'docProps/app.xml',
    }),
  ];
  const body = emitElement('Relationships', { xmlns: REL_NS }, rows);
  return `${XML_PROLOG}${body}`;
}
